import {
  encodeFunctionData,
  formatUnits,
  isAddress,
  maxUint256,
  parseUnits,
  type Address,
} from "viem";
import type {
  CspActionAvailability,
  CspUserActions,
  CspUserPositionResponse,
  CspVaultResponse,
} from "@/lib/api";
import { ADDRESSES, CHAIN, ERC20_ABI } from "@/lib/contracts";
import type { BatchCall } from "@/hooks/useWallet";
import type { VaultConfig, VaultPosition, VaultPositionState } from "@/lib/vaults";

export const CSP_VAULT_KEY = process.env.NEXT_PUBLIC_CSP_VAULT_KEY || null;
export const CSP_VAULT_ADDRESS = process.env.NEXT_PUBLIC_CSP_VAULT_ADDRESS || null;

export const CSP_CHAIN_ID = 84532;
export const CSP_MIN_SHARES_BPS = 9_950;

function configuredCspVaultKey(): string | null {
  return process.env.NEXT_PUBLIC_CSP_VAULT_KEY || null;
}

function configuredCspVaultAddress(): string | null {
  return process.env.NEXT_PUBLIC_CSP_VAULT_ADDRESS || null;
}

export type CspActionKey =
  | "deposit"
  | "cancelPendingDeposit"
  | "withdrawIdle"
  | "requestWithdraw"
  | "claimWithdraw"
  | "claimAssignedWeth";

export type CspActionPlan = {
  key: Exclude<CspActionKey, "deposit">;
  mode: "withdraw";
  label: string;
  description: string;
  requiresAmount: boolean;
};

export const ETH_CSP_VAULT_ABI = [
  {
    type: "function",
    name: "deposit",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "minSharesOut", type: "uint256" },
    ],
    outputs: [{ name: "mintedShares", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "cancelPendingDeposit",
    inputs: [{ name: "receiver", type: "address" }],
    outputs: [{ name: "amount", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "withdrawIdle",
    inputs: [
      { name: "shares", type: "uint256" },
      { name: "receiver", type: "address" },
    ],
    outputs: [{ name: "amount", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "requestWithdraw",
    inputs: [{ name: "shares", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "claimWithdrawTo",
    inputs: [{ name: "receiver", type: "address" }],
    outputs: [
      { name: "usdcAmount", type: "uint256" },
      { name: "underlyingAmount", type: "uint256" },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "claimAssignedUnderlying",
    inputs: [{ name: "receiver", type: "address" }],
    outputs: [{ name: "amount", type: "uint256" }],
    stateMutability: "nonpayable",
  },
] as const;

export function rawAmount(raw: string | bigint | undefined, decimals: number): number {
  if (raw == null) return 0;
  try {
    return Number(formatUnits(typeof raw === "bigint" ? raw : BigInt(raw), decimals));
  } catch {
    return 0;
  }
}

export function parseCspUsdc(value: string, decimals: number): bigint {
  try {
    return parseUnits(value || "0", decimals);
  } catch {
    return BigInt(0);
  }
}

export function cspAction(actions: CspUserActions | null | undefined, key: CspActionKey) {
  return actions?.[key] ?? { available: false, reason: "NOT_CONNECTED", mode: null };
}

export function deriveCspPositionState(
  user: CspUserPositionResponse | null,
): VaultPositionState {
  if (!user) return "empty";
  const position = user.position;
  if (BigInt(position.claimableAssignedWeth) > BigInt(0)) return "claimable-weth";
  if (BigInt(position.withdrawal.wethAssets) > BigInt(0)) return "claimable-weth";
  if (
    BigInt(position.withdrawal.usdcAssets) > BigInt(0) ||
    user.actions.claimWithdraw.available
  ) return "claimable-usdc";
  if (BigInt(position.withdrawal.shares) > BigInt(0)) return "exiting";
  if (BigInt(position.pendingDepositAssets) > BigInt(0)) return "pending";
  if (BigInt(position.activeShares) > BigInt(0)) return "active";
  return "empty";
}

export function mapCspPosition(
  user: CspUserPositionResponse | null,
  depositDecimals: number,
  assignedDecimals: number,
): VaultPosition {
  if (!user) {
    return {
      state: "empty",
      activeUsd: 0,
      activeShares: 0,
      pendingUsd: 0,
      pendingWithdrawalShares: 0,
      claimableUsdc: 0,
      claimableWeth: 0,
    };
  }

  return {
    state: deriveCspPositionState(user),
    activeUsd: rawAmount(user.position.activeAssets, depositDecimals),
    activeShares: rawAmount(user.position.activeShares, depositDecimals),
    pendingUsd: rawAmount(user.position.pendingDepositAssets, depositDecimals),
    pendingWithdrawalShares: rawAmount(
      user.position.withdrawal.shares,
      depositDecimals,
    ),
    claimableUsdc: rawAmount(user.position.withdrawal.usdcAssets, depositDecimals),
    claimableWeth:
      rawAmount(user.position.claimableAssignedWeth, assignedDecimals) +
      rawAmount(user.position.withdrawal.wethAssets, assignedDecimals),
  };
}

export function hasCspPosition(user: CspUserPositionResponse | null): boolean {
  if (!user) return false;
  const position = user.position;
  return [
    position.activeShares,
    position.pendingDepositAssets,
    position.withdrawal.shares,
    position.withdrawal.usdcAssets,
    position.withdrawal.wethAssets,
    position.claimableAssignedWeth,
  ].some((value) => BigInt(value) > BigInt(0));
}

export function getCspWithdrawPlan(
  user: CspUserPositionResponse | null,
): CspActionPlan {
  if (user?.actions.claimAssignedWeth.available) {
    return {
      key: "claimAssignedWeth",
      mode: "withdraw",
      label: "Claim WETH",
      description: "Assigned WETH is ready to claim to your smart wallet.",
      requiresAmount: false,
    };
  }
  if (user?.actions.claimWithdraw.available) {
    const hasUsdc = BigInt(user.position.withdrawal.usdcAssets) > BigInt(0);
    const hasWeth = BigInt(user.position.withdrawal.wethAssets) > BigInt(0);
    return {
      key: "claimWithdraw",
      mode: "withdraw",
      label: hasUsdc && hasWeth ? "Claim assets" : hasWeth ? "Claim WETH" : "Claim USDC",
      description: "Your closed withdrawal is ready to claim.",
      requiresAmount: false,
    };
  }
  if (user?.actions.cancelPendingDeposit.available) {
    return {
      key: "cancelPendingDeposit",
      mode: "withdraw",
      label: "Cancel pending deposit",
      description: "Your queued USDC deposit can be cancelled before activation.",
      requiresAmount: false,
    };
  }
  if (user?.actions.withdrawIdle.available) {
    return {
      key: "withdrawIdle",
      mode: "withdraw",
      label: "Withdraw now",
      description: "Idle USDC can be withdrawn immediately.",
      requiresAmount: true,
    };
  }
  return {
    key: "requestWithdraw",
    mode: "withdraw",
    label: !user || user.actions.requestWithdraw.available ? "Request withdrawal" : "View exit",
    description: "Request an exit from the active vault position.",
    requiresAmount: true,
  };
}

export function mergeCspVaultConfig(
  base: VaultConfig,
  vault: CspVaultResponse | null,
  user: CspUserPositionResponse | null,
  walletUsdc: number | null,
): VaultConfig {
  const depositDecimals = vault?.assets.deposit.decimals ?? 6;
  const positionAssets = user
    ? rawAmount(user.position.activeAssets, depositDecimals) +
      rawAmount(user.position.pendingDepositAssets, depositDecimals) +
      rawAmount(user.position.withdrawal.usdcAssets, depositDecimals)
    : null;

  return {
    ...base,
    balance: positionAssets,
    balanceUsd: positionAssets,
    totalManagedUsd: vault
      ? rawAmount(vault.summary.totalManagedAssets, depositDecimals)
      : null,
    availableBalance: walletUsdc,
  };
}

export function cspSharesForAssets(
  rawAssets: bigint,
  user: CspUserPositionResponse,
): bigint {
  const activeAssets = BigInt(user.position.activeAssets);
  const activeShares = BigInt(user.position.activeShares);
  if (rawAssets <= BigInt(0) || activeAssets <= BigInt(0) || activeShares <= BigInt(0)) {
    return BigInt(0);
  }
  const shares = (rawAssets * activeShares) / activeAssets;
  if (shares <= BigInt(0)) return BigInt(1);
  return shares > activeShares ? activeShares : shares;
}

export function minSharesOutForDeposit(rawAssets: bigint, vault: CspVaultResponse): bigint {
  const sharePriceAssets = BigInt(vault.summary.sharePriceAssets || "0");
  const decimals = BigInt(10) ** BigInt(vault.assets.deposit.decimals);
  if (rawAssets <= BigInt(0) || sharePriceAssets <= BigInt(0)) return BigInt(0);
  const expectedShares = (rawAssets * decimals) / sharePriceAssets;
  return (expectedShares * BigInt(CSP_MIN_SHARES_BPS)) / BigInt(10_000);
}

export function assertCspWriteAllowed(
  vault: CspVaultResponse | null,
  user: CspUserPositionResponse | null,
  actionKey: CspActionKey,
  smartWalletAddress: Address,
): CspActionAvailability {
  if (!vault || !user) {
    throw new Error("Vault data is still loading.");
  }
  assertCspSnapshotTrusted(vault, user, smartWalletAddress);
  if (vault.stale || user.stale) {
    throw new Error("Vault data is stale. Refresh before submitting a transaction.");
  }
  const action = cspAction(user.actions, actionKey);
  if (!action.available) {
    throw new Error(action.reason ? `Action unavailable: ${action.reason}` : "Action unavailable.");
  }
  return action;
}

export function assertCspSnapshotTrusted(
  vault: CspVaultResponse,
  user: CspUserPositionResponse | null,
  smartWalletAddress?: Address,
): void {
  if (
    CHAIN.id !== CSP_CHAIN_ID ||
    vault.chainId !== CSP_CHAIN_ID ||
    (user !== null && user.chainId !== CSP_CHAIN_ID)
  ) {
    throw new Error("CSP vault is only enabled on Base Sepolia.");
  }
  const configuredVaultKey = configuredCspVaultKey();
  const configuredVaultAddress = configuredCspVaultAddress();
  if (!configuredVaultKey || !configuredVaultAddress) {
    throw new Error("CSP vault allowlist configuration is missing.");
  }
  if (!isAddress(configuredVaultAddress)) {
    throw new Error("CSP vault allowlist address is invalid.");
  }
  if (
    vault.vaultKey !== configuredVaultKey ||
    (user !== null && user.vaultKey !== configuredVaultKey)
  ) {
    throw new Error("CSP vault key does not match frontend configuration.");
  }
  if (
    !isAddress(vault.vaultAddress) ||
    (user !== null && vault.vaultAddress.toLowerCase() !== user.vaultAddress.toLowerCase())
  ) {
    throw new Error("CSP vault address mismatch. Transaction blocked.");
  }
  if (
    vault.vaultAddress.toLowerCase() !== configuredVaultAddress.toLowerCase()
  ) {
    throw new Error("CSP vault address does not match frontend configuration.");
  }
  if (
    vault.assets.deposit.symbol !== "USDC" ||
    vault.assets.deposit.decimals !== 6 ||
    !isAddress(vault.assets.deposit.address) ||
    vault.assets.deposit.address.toLowerCase() !== ADDRESSES.usdc.toLowerCase()
  ) {
    throw new Error("CSP deposit asset does not match configured USDC.");
  }
  if (
    vault.assets.assigned.symbol !== "WETH" ||
    vault.assets.assigned.decimals !== 18 ||
    !isAddress(vault.assets.assigned.address) ||
    vault.assets.assigned.address.toLowerCase() !== ADDRESSES.weth.toLowerCase()
  ) {
    throw new Error("CSP assigned asset does not match configured WETH.");
  }
  if (user !== null && (
    !smartWalletAddress ||
    !isAddress(smartWalletAddress) ||
    !isAddress(user.address) ||
    user.address.toLowerCase() !== smartWalletAddress.toLowerCase()
  )) {
    throw new Error("CSP position does not belong to the connected smart wallet.");
  }
}

export function transactionHashFromResult(result: unknown): `0x${string}` {
  if (typeof result !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(result)) {
    throw new Error("Smart wallet did not return a valid transaction hash.");
  }
  return result as `0x${string}`;
}

export function buildCspDepositCalls({
  vault,
  rawAssets,
  currentAllowance,
}: {
  vault: CspVaultResponse;
  rawAssets: bigint;
  currentAllowance: bigint;
}): BatchCall[] {
  const vaultAddress = vault.vaultAddress as Address;
  const token = vault.assets.deposit.address as Address;
  const calls: BatchCall[] = [];
  if (currentAllowance < rawAssets) {
    calls.push({
      to: token,
      data: encodeFunctionData({
        abi: ERC20_ABI,
        functionName: "approve",
        args: [vaultAddress, maxUint256],
      }),
    });
  }
  calls.push({
    to: vaultAddress,
    data: encodeFunctionData({
      abi: ETH_CSP_VAULT_ABI,
      functionName: "deposit",
      args: [rawAssets, minSharesOutForDeposit(rawAssets, vault)],
    }),
  });
  return calls;
}

export function buildCspActionCall({
  vault,
  user,
  actionKey,
  rawShares,
  receiver,
}: {
  vault: CspVaultResponse;
  user: CspUserPositionResponse;
  actionKey: Exclude<CspActionKey, "deposit">;
  rawShares?: bigint;
  receiver: Address;
}): BatchCall {
  const vaultAddress = vault.vaultAddress as Address;
  switch (actionKey) {
    case "cancelPendingDeposit":
      return {
        to: vaultAddress,
        data: encodeFunctionData({
          abi: ETH_CSP_VAULT_ABI,
          functionName: "cancelPendingDeposit",
          args: [receiver],
        }),
      };
    case "withdrawIdle":
      return {
        to: vaultAddress,
        data: encodeFunctionData({
          abi: ETH_CSP_VAULT_ABI,
          functionName: "withdrawIdle",
          args: [rawShares ?? BigInt(0), receiver],
        }),
      };
    case "requestWithdraw":
      return {
        to: vaultAddress,
        data: encodeFunctionData({
          abi: ETH_CSP_VAULT_ABI,
          functionName: "requestWithdraw",
          args: [rawShares ?? BigInt(0)],
        }),
      };
    case "claimWithdraw":
      return {
        to: vaultAddress,
        data: encodeFunctionData({
          abi: ETH_CSP_VAULT_ABI,
          functionName: "claimWithdrawTo",
          args: [receiver],
        }),
      };
    case "claimAssignedWeth":
      return {
        to: vaultAddress,
        data: encodeFunctionData({
          abi: ETH_CSP_VAULT_ABI,
          functionName: "claimAssignedUnderlying",
          args: [receiver],
        }),
      };
  }

  void user;
  throw new Error(`Unsupported CSP action: ${actionKey}`);
}
