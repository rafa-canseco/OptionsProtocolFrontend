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
import { CHAIN, ERC20_ABI } from "@/lib/contracts";
import type { BatchCall } from "@/hooks/useWallet";
import type { VaultConfig, VaultPosition, VaultPositionState } from "@/lib/vaults";

export const CSP_VAULT_KEY =
  process.env.NEXT_PUBLIC_CSP_VAULT_KEY || "base-sepolia:eth-usdc-csp";
export const CSP_VAULT_ADDRESS = process.env.NEXT_PUBLIC_CSP_VAULT_ADDRESS || null;

export const CSP_CHAIN_ID = 84532;
export const CSP_MIN_SHARES_BPS = 9_950;

export type CspActionKey =
  | "deposit"
  | "cancelPendingDeposit"
  | "withdrawIdle"
  | "requestWithdraw"
  | "claimWithdraw"
  | "claimAssignedWeth";

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
  if (user.actions.claimWithdraw.available) return "claimable-usdc";
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
      pendingUsd: 0,
      claimableUsdc: 0,
      claimableWeth: 0,
    };
  }

  return {
    state: deriveCspPositionState(user),
    activeUsd: rawAmount(user.position.activeAssets, depositDecimals),
    pendingUsd: rawAmount(user.position.pendingDepositAssets, depositDecimals),
    claimableUsdc: rawAmount(user.position.withdrawal.usdcAssets, depositDecimals),
    claimableWeth:
      rawAmount(user.position.claimableAssignedWeth, assignedDecimals) +
      rawAmount(user.position.withdrawal.wethAssets, assignedDecimals),
  };
}

export function mergeCspVaultConfig(
  base: VaultConfig,
  vault: CspVaultResponse | null,
  user: CspUserPositionResponse | null,
  walletUsdc: number,
): VaultConfig {
  const depositDecimals = vault?.assets.deposit.decimals ?? 6;
  const positionAssets =
    rawAmount(user?.position.activeAssets, depositDecimals) +
    rawAmount(user?.position.pendingDepositAssets, depositDecimals) +
    rawAmount(user?.position.withdrawal.usdcAssets, depositDecimals);

  return {
    ...base,
    balance: positionAssets,
    balanceUsd: positionAssets,
    totalManagedUsd: rawAmount(vault?.summary.totalManagedAssets, depositDecimals) || base.totalManagedUsd,
    availableBalance: walletUsdc,
    earningsUsd: rawAmount(vault?.currentCycle.premiumEarned, depositDecimals),
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
): CspActionAvailability {
  if (!vault || !user) {
    throw new Error("Vault data is still loading.");
  }
  if (CHAIN.id !== CSP_CHAIN_ID || vault.chainId !== CSP_CHAIN_ID || user.chainId !== CSP_CHAIN_ID) {
    throw new Error("CSP vault writes are only enabled on Base Sepolia.");
  }
  if (vault.stale || user.stale) {
    throw new Error("Vault data is stale. Refresh before submitting a transaction.");
  }
  if (!isAddress(vault.vaultAddress) || vault.vaultAddress.toLowerCase() !== user.vaultAddress.toLowerCase()) {
    throw new Error("CSP vault address mismatch. Transaction blocked.");
  }
  if (
    CSP_VAULT_ADDRESS &&
    (!isAddress(CSP_VAULT_ADDRESS) ||
      vault.vaultAddress.toLowerCase() !== CSP_VAULT_ADDRESS.toLowerCase())
  ) {
    throw new Error("CSP vault address does not match frontend configuration.");
  }
  const action = cspAction(user.actions, actionKey);
  if (!action.available) {
    throw new Error(action.reason ? `Action unavailable: ${action.reason}` : "Action unavailable.");
  }
  return action;
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
