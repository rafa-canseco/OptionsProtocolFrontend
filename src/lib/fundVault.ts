import {
  encodeFunctionData,
  formatUnits,
  isAddress,
  maxUint256,
  parseUnits,
  type Address,
} from "viem";
import type { BatchCall } from "@/hooks/useWallet";
import type {
  FundActionAvailability,
  FundApiStrategyKind,
  FundActions,
  FundConfigResponse,
  FundFreshnessBounds,
  FundPositionResponse,
  FundSummaryResponse,
} from "@/lib/api";
import { ADDRESSES, CHAIN, ERC20_ABI } from "@/lib/contracts";
import {
  BASE_SEPOLIA_CSP_FUND,
  type TrustedFundDeployment,
  type TrustedFundBinding,
} from "@/lib/fundDeployment";

export const FUND_KEY = configuredFundKey(BASE_SEPOLIA_CSP_FUND);
export const FUND_ADDRESS = configuredFundAddress(BASE_SEPOLIA_CSP_FUND);
export const FUND_CHAIN_ID = FUND_KEY ? BASE_SEPOLIA_CSP_FUND.chainId : null;
export const FUND_MIN_SHARES_BPS = 9_950;
export const FUND_WRITE_METADATA_MAX_AGE_MS = 45_000;

const PROXY_ROLES = new Set<string>([
  "fund_vault",
  "fund_share",
  "fund_accounting",
  "fund_flow_manager",
  "strategy_manager",
  "csp_adapter",
  "covered_call_adapter",
  "wheel_coordinator",
  "meta_wheel_adapter",
  "controller",
  "batch_settler",
]);

export type FundActionKey =
  | "deposit"
  | "requestRedemption"
  | "cancelRedemption"
  | "claimRedemption";

export function configuredFundKey(
  deployment: TrustedFundDeployment,
): string {
  if (CHAIN.id !== deployment.chainId) return "";
  return deploymentEnv(deployment, "KEY") || deployment.fundKey;
}

export function configuredFundAddress(
  deployment: TrustedFundDeployment,
): string {
  if (CHAIN.id !== deployment.chainId) return "";
  return deploymentEnv(deployment, "ADDRESS") || deployment.fundAddress;
}

export const FUND_VAULT_ABI = [
  {
    type: "function",
    name: "depositWithMinShares",
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "minSharesOut", type: "uint256" },
    ],
    outputs: [{ name: "shares", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "requestRedeem",
    inputs: [
      { name: "shares", type: "uint256" },
      { name: "controller", type: "address" },
      { name: "owner", type: "address" },
    ],
    outputs: [{ name: "requestId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "requestRedeemWithMinAssets",
    inputs: [
      { name: "shares", type: "uint256" },
      { name: "controller", type: "address" },
      { name: "owner", type: "address" },
      { name: "minAssetsOut", type: "uint256" },
    ],
    outputs: [{ name: "requestId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "cancelRedeemRequest",
    inputs: [
      { name: "controller", type: "address" },
      { name: "shares", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "redeem",
    inputs: [
      { name: "shares", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "controller", type: "address" },
    ],
    outputs: [{ name: "assets", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "withdraw",
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "controller", type: "address" },
    ],
    outputs: [{ name: "shares", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setOperator",
    inputs: [
      { name: "operator", type: "address" },
      { name: "approved", type: "bool" },
    ],
    outputs: [{ name: "success", type: "bool" }],
    stateMutability: "nonpayable",
  },
] as const;

export function rawFundAmount(raw: string | bigint | undefined, decimals: number): number {
  if (raw == null) return 0;
  try {
    return Number(formatUnits(typeof raw === "bigint" ? raw : BigInt(raw), decimals));
  } catch {
    return 0;
  }
}

export function parseFundAmount(value: string, decimals: number): bigint {
  try {
    return parseUnits(value || "0", decimals);
  } catch {
    return BigInt(0);
  }
}

export function fundAction(
  actions: FundActions | null | undefined,
  key: FundActionKey,
): FundActionAvailability {
  return actions?.[key] ?? { available: false, reasonCode: "NOT_CONNECTED" };
}

export function minSharesOutForDeposit(
  rawAssets: bigint,
  summary: FundSummaryResponse,
): bigint {
  const expectedShares = sharesForDeposit(rawAssets, summary);
  return (expectedShares * BigInt(FUND_MIN_SHARES_BPS)) / BigInt(10_000);
}

/**
 * Mirrors FundVault's synchronous fair-NAV share quote. Stress and market
 * prices are intentionally absent from this calculation.
 */
export function sharesForDeposit(
  rawAssets: bigint,
  summary: FundSummaryResponse,
): bigint {
  const denominator = BigInt(summary.netAssets) + BigInt(1);
  const supply = BigInt(summary.shareSupply) + BigInt(summary.virtualShares);
  if (rawAssets <= BigInt(0) || supply <= BigInt(0)) return BigInt(0);
  return (rawAssets * supply) / denominator;
}

export function sharesForAccountingAssets(
  rawAssets: bigint,
  position: FundPositionResponse,
): bigint {
  const shares = BigInt(position.shares);
  const accountingValue = BigInt(position.accountingValue);
  if (rawAssets <= BigInt(0) || shares <= BigInt(0) || accountingValue <= BigInt(0)) {
    return BigInt(0);
  }
  if (rawAssets >= accountingValue) return shares;
  return (rawAssets * shares) / accountingValue;
}

export function currentFundFreshness(
  snapshot: Pick<FundSummaryResponse, "generation" | "asOfBlock" | "asOfBlockHash" | "publishedAt">,
): FundFreshnessBounds {
  assertFundSnapshotMetadata(snapshot, "Fund");
  return {
    minGeneration: snapshot.generation,
    minBlock: snapshot.asOfBlock!,
    minBlockHash: snapshot.asOfBlockHash!,
  };
}

export function postTransactionFundFreshness(
  preSendGeneration: number,
  receipt: { blockNumber: bigint; blockHash: string },
): FundFreshnessBounds {
  const minBlock = Number(receipt.blockNumber);
  if (
    !Number.isSafeInteger(preSendGeneration) || preSendGeneration < 0 ||
    !Number.isSafeInteger(minBlock) || minBlock < 0
  ) {
    throw new Error("Confirmed transaction freshness metadata is invalid.");
  }
  return {
    minGeneration: preSendGeneration + 1,
    minBlock,
    minBlockHash: receipt.blockHash,
  };
}

export function transactionHashFromResult(result: unknown): `0x${string}` {
  if (typeof result !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(result)) {
    throw new Error("Smart wallet did not return a valid transaction hash.");
  }
  return result as `0x${string}`;
}

export function fundTrustError(
  summary: FundSummaryResponse,
  config: FundConfigResponse,
  position?: FundPositionResponse | null,
  smartWallet?: Address,
  deployment: TrustedFundDeployment = BASE_SEPOLIA_CSP_FUND,
): string | null {
  const fundKey = configuredFundKey(deployment);
  const fundAddress = configuredFundAddress(deployment);
  const shareAddress =
    deploymentEnv(deployment, "SHARE_ADDRESS") || deployment.shareAddress;
  const assetAddress =
    deploymentEnv(deployment, "ASSET_ADDRESS") || deployment.accountingAssetAddress;
  const product = deployment.strategyKind === "covered_call"
    ? "Covered Call"
    : deployment.strategyKind === "meta_wheel"
      ? "Meta Wheel"
      : "CSP";
  if (![fundAddress, shareAddress, assetAddress].every((value) => isAddress(value))) {
    return `${product} fund allowlist contains an invalid address.`;
  }
  if (CHAIN.id !== deployment.chainId || summary.fund.chainId !== deployment.chainId) {
    return `${product} fund is only enabled on Base Sepolia.`;
  }
  if (summary.fund.fundKey !== fundKey || config.fundKey !== fundKey) {
    return `${product} fund key does not match frontend configuration.`;
  }
  const observedStrategyKinds = [
    summary.fund.strategyKind,
    summary.strategy?.strategyKind,
  ].filter((kind): kind is FundApiStrategyKind => kind !== undefined);
  if (observedStrategyKinds.some(
    (kind) => trustedStrategyKind(kind) !== deployment.strategyKind
  )) {
    return `${product} strategy kind does not match frontend configuration.`;
  }
  if (
    !sameAddress(summary.fund.fundAddress, fundAddress) ||
    !sameAddress(summary.fund.shareToken.address, shareAddress) ||
    !sameAddress(summary.fund.accountingAsset.address, assetAddress)
  ) {
    return `${product} fund registry does not match the frontend allowlist.`;
  }
  const expectedAsset =
    deployment.strategyKind === "covered_call" ? ADDRESSES.weth : ADDRESSES.usdc;
  const expectedSymbol =
    deployment.strategyKind === "covered_call" ? "WETH" : "USDC";
  const expectedDecimals = deployment.strategyKind === "covered_call" ? 18 : 6;
  if (
    summary.fund.accountingAsset.symbol !== expectedSymbol ||
    summary.fund.accountingAsset.decimals !== expectedDecimals ||
    !sameAddress(summary.fund.accountingAsset.address, expectedAsset)
  ) {
    return `${product} fund accounting asset does not match configured ${expectedSymbol}.`;
  }
  const contractError = trustedContractsError(config, deployment);
  if (contractError) return contractError;
  if (position && position.fundKey !== fundKey) return "Position fund key mismatch.";
  if (position && (!smartWallet || !sameAddress(position.address, smartWallet))) {
    return "Fund position does not belong to the connected smart wallet.";
  }
  return null;
}

function trustedStrategyKind(
  strategyKind: FundApiStrategyKind,
): TrustedFundDeployment["strategyKind"] {
  return strategyKind === "csp" ? "cash_secured_put" : strategyKind;
}

function assertFundSnapshotMetadata(
  snapshot: Pick<FundSummaryResponse, "generation" | "asOfBlock" | "asOfBlockHash" | "publishedAt">,
  label: string,
): void {
  if (!Number.isSafeInteger(snapshot.generation) || snapshot.generation < 0) {
    throw new Error(`${label} generation metadata is invalid.`);
  }
  if (!Number.isSafeInteger(snapshot.asOfBlock) || snapshot.asOfBlock! < 0) {
    throw new Error(`${label} block metadata is invalid.`);
  }
  if (
    typeof snapshot.asOfBlockHash !== "string" ||
    !/^0x[0-9a-fA-F]{64}$/.test(snapshot.asOfBlockHash)
  ) {
    throw new Error(`${label} block hash metadata is invalid.`);
  }
  const publishedAt = Date.parse(snapshot.publishedAt);
  const age = Date.now() - publishedAt;
  if (!Number.isFinite(publishedAt) || age < 0) {
    throw new Error(`${label} published_at metadata is invalid.`);
  }
  if (age > FUND_WRITE_METADATA_MAX_AGE_MS) {
    throw new Error(`${label} metadata is locally expired.`);
  }
}

export function assertFundWriteAllowed(
  summary: FundSummaryResponse | null,
  config: FundConfigResponse | null,
  position: FundPositionResponse | null,
  actionKey: FundActionKey,
  smartWallet: Address,
  deployment: TrustedFundDeployment = BASE_SEPOLIA_CSP_FUND,
): FundActionAvailability {
  if (!summary || !config) throw new Error("Fund data is still loading.");
  assertFundSnapshotMetadata(summary, "Fund");
  if (position) assertFundSnapshotMetadata(position, "Fund position");
  const trustError = fundTrustError(
    summary,
    config,
    position,
    smartWallet,
    deployment,
  );
  if (trustError) throw new Error(trustError);
  if (summary.stale || config.writesEnabled === false || position?.stale) {
    throw new Error(
      config.blockedReasonCode
        ? `Fund writes disabled: ${config.blockedReasonCode}`
        : "Fund data is stale. Refresh before submitting a transaction.",
    );
  }
  const actions = actionKey === "deposit" ? summary.actions : position?.actions;
  const action = fundAction(actions, actionKey);
  if (!action.available) {
    throw new Error(
      action.reasonCode ? `Action unavailable: ${action.reasonCode}` : "Action unavailable.",
    );
  }
  return action;
}

export function buildFundDepositCalls({
  summary,
  receiver,
  rawAssets,
  currentAllowance,
}: {
  summary: FundSummaryResponse;
  receiver: Address;
  rawAssets: bigint;
  currentAllowance: bigint;
}): BatchCall[] {
  const fund = summary.fund.fundAddress as Address;
  const token = summary.fund.accountingAsset.address as Address;
  const minimumShares = minSharesOutForDeposit(rawAssets, summary);
  if (minimumShares <= BigInt(0)) throw new Error("Deposit quote has no minSharesOut protection.");
  const calls: BatchCall[] = [];
  if (currentAllowance < rawAssets) {
    calls.push({
      to: token,
      data: encodeFunctionData({
        abi: ERC20_ABI,
        functionName: "approve",
        args: [fund, maxUint256],
      }),
    });
  }
  calls.push({
    to: fund,
    data: encodeFunctionData({
      abi: FUND_VAULT_ABI,
      functionName: "depositWithMinShares",
      args: [rawAssets, receiver, minimumShares],
    }),
  });
  return calls;
}

export function buildFundActionCall({
  summary,
  position,
  actionKey,
  controller,
  shares,
}: {
  summary: FundSummaryResponse;
  position: FundPositionResponse;
  actionKey: Exclude<FundActionKey, "deposit">;
  controller: Address;
  shares?: bigint;
}): BatchCall {
  const fund = summary.fund.fundAddress as Address;
  const actionShares = shares ?? BigInt(0);
  if (actionKey === "requestRedemption") {
    return {
      to: fund,
      data: encodeFunctionData({
        abi: FUND_VAULT_ABI,
        functionName: "requestRedeem",
        args: [actionShares, controller, controller],
      }),
    };
  }
  if (actionKey === "cancelRedemption") {
    return {
      to: fund,
      data: encodeFunctionData({
        abi: FUND_VAULT_ABI,
        functionName: "cancelRedeemRequest",
        args: [controller, BigInt(position.redemption.pendingShares)],
      }),
    };
  }
  return {
    to: fund,
    data: encodeFunctionData({
      abi: FUND_VAULT_ABI,
      functionName: "redeem",
      args: [BigInt(position.redemption.claimableShares), controller, controller],
    }),
  };
}

function trustedContractsError(
  config: FundConfigResponse,
  deployment: TrustedFundDeployment,
): string | null {
  const configuredAllowlist = deploymentEnv(deployment, "CONTRACT_ALLOWLIST");
  const allowlist = configuredAllowlist
    ? parseContractAllowlist(configuredAllowlist)
    : deploymentContractAllowlist(deployment);
  const requiredRoles = new Set<string>(Object.keys(deployment.contracts));
  if (!allowlist || allowlist.size === 0) return "Trusted contract allowlist is missing.";
  if (
    allowlist.size !== requiredRoles.size ||
    [...requiredRoles].some((role) => !allowlist.has(role))
  ) {
    return "Trusted contract allowlist is incomplete.";
  }
  if (config.deploymentStatus !== "DEPLOYED") return "Fund deployment is not active.";
  if (config.contracts.length !== allowlist.size) return "Trusted contract role set mismatch.";
  for (const contract of config.contracts) {
    const expected = allowlist.get(contract.role);
    if (!expected || !sameAddress(contract.address, expected.address)) {
      return `Trusted ${contract.role} address mismatch.`;
    }
    if (contract.interfaceVersion !== 1) return `Unsupported ${contract.role} interface.`;
    if (PROXY_ROLES.has(contract.role)) {
      if (!expected.implementation || !contract.implementationAddress) {
        return `Trusted ${contract.role} implementation is missing.`;
      }
      if (!sameAddress(contract.implementationAddress, expected.implementation)) {
        return `Trusted ${contract.role} implementation mismatch.`;
      }
    }
  }
  return null;
}

function deploymentContractAllowlist(deployment: TrustedFundDeployment) {
  return new Map<string, TrustedFundBinding>(
    Object.entries(deployment.contracts),
  );
}

function deploymentEnv(
  deployment: TrustedFundDeployment,
  suffix: "KEY" | "ADDRESS" | "SHARE_ADDRESS" | "ASSET_ADDRESS" | "CONTRACT_ALLOWLIST",
): string | undefined {
  if (deployment.environmentPrefix === "META_WHEEL_FUND") {
    // B1N-419 is receipt-confirmed and committed as a static trust anchor.
    // Public build variables must never replace its fund or contract allowlist.
    return undefined;
  }
  if (deployment.environmentPrefix === "COVERED_CALL_FUND") {
    if (suffix === "KEY") return process.env.NEXT_PUBLIC_COVERED_CALL_FUND_KEY;
    if (suffix === "ADDRESS") {
      return process.env.NEXT_PUBLIC_COVERED_CALL_FUND_ADDRESS;
    }
    if (suffix === "SHARE_ADDRESS") {
      return process.env.NEXT_PUBLIC_COVERED_CALL_FUND_SHARE_ADDRESS;
    }
    if (suffix === "ASSET_ADDRESS") {
      return process.env.NEXT_PUBLIC_COVERED_CALL_FUND_ASSET_ADDRESS;
    }
    return process.env.NEXT_PUBLIC_COVERED_CALL_FUND_CONTRACT_ALLOWLIST;
  }
  if (suffix === "KEY") return process.env.NEXT_PUBLIC_CSP_FUND_KEY;
  if (suffix === "ADDRESS") return process.env.NEXT_PUBLIC_CSP_FUND_ADDRESS;
  if (suffix === "SHARE_ADDRESS") {
    return process.env.NEXT_PUBLIC_CSP_FUND_SHARE_ADDRESS;
  }
  if (suffix === "ASSET_ADDRESS") {
    return process.env.NEXT_PUBLIC_CSP_FUND_ASSET_ADDRESS;
  }
  return process.env.NEXT_PUBLIC_CSP_FUND_CONTRACT_ALLOWLIST;
}

function parseContractAllowlist(value: string) {
  const entries = new Map<string, TrustedFundBinding>();
  if (!value) return entries;
  for (const item of value.split(",")) {
    const [role, binding] = item.trim().split("=");
    const [address, implementation] = (binding || "").split("@");
    if (!role || !isAddress(address) || (implementation && !isAddress(implementation))) {
      return null;
    }
    if (entries.has(role)) return null;
    entries.set(role, {
      address: address as Address,
      implementation: (implementation as Address | undefined) || null,
    });
  }
  return entries;
}

function sameAddress(left: string, right: string): boolean {
  return isAddress(left) && isAddress(right) && left.toLowerCase() === right.toLowerCase();
}
