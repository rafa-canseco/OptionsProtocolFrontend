import type { FundPositionResponse, FundSummaryResponse } from "@/lib/api";
import { rawFundAmount } from "@/lib/fundVault";

export type VaultPositionState =
  | "empty"
  | "invested"
  | "pending"
  | "partial"
  | "claimable";

export type VaultPosition = {
  state: VaultPositionState;
  accountingValue: number;
  shares: number;
  pendingShares: number;
  pendingValue: number;
  claimableShares: number;
  claimableAssets: number;
};

export const EMPTY_VAULT_POSITION: VaultPosition = {
  state: "empty",
  accountingValue: 0,
  shares: 0,
  pendingShares: 0,
  pendingValue: 0,
  claimableShares: 0,
  claimableAssets: 0,
};

export const VAULT_STATE_COPY: Record<
  VaultPositionState,
  { label: string; action: string }
> = {
  empty: { label: "No position", action: "Deposit USDC" },
  invested: { label: "Invested", action: "Manage position" },
  pending: { label: "Redemption pending", action: "View request" },
  partial: { label: "Partially processed", action: "Claim available USDC" },
  claimable: { label: "USDC ready", action: "Claim USDC" },
};

export function mapFundPosition(
  position: FundPositionResponse | null,
  summary: FundSummaryResponse | null,
): VaultPosition {
  if (!position || !summary) return EMPTY_VAULT_POSITION;
  const shareDecimals = summary.fund.shareToken.decimals;
  const assetDecimals = summary.fund.accountingAsset.decimals;
  const pendingShares = BigInt(position.redemption.pendingShares);
  const claimableShares = BigInt(position.redemption.claimableShares);
  const pendingValueRaw = estimateShareValue(pendingShares, summary);
  return {
    state: deriveFundPositionState(position),
    accountingValue: rawFundAmount(position.accountingValue, assetDecimals),
    shares: rawFundAmount(position.shares, shareDecimals),
    pendingShares: rawFundAmount(pendingShares, shareDecimals),
    pendingValue: rawFundAmount(pendingValueRaw, assetDecimals),
    claimableShares: rawFundAmount(claimableShares, shareDecimals),
    claimableAssets: rawFundAmount(position.redemption.claimableAssets, assetDecimals),
  };
}

export function deriveFundPositionState(
  position: FundPositionResponse,
): VaultPositionState {
  const pending = BigInt(position.redemption.pendingShares);
  const claimable = BigInt(position.redemption.claimableAssets);
  if (pending > BigInt(0) && claimable > BigInt(0)) return "partial";
  if (claimable > BigInt(0)) return "claimable";
  if (pending > BigInt(0)) return "pending";
  if (BigInt(position.shares) > BigInt(0)) return "invested";
  return "empty";
}

export function fundStrategyState(summary: FundSummaryResponse | null): string {
  if (!summary) return "Unavailable";
  if (summary.status.flowProcessing) return "Processing redemptions";
  if (BigInt(summary.composition.assignedWeth) > BigInt(0)) return "Assigned inventory";
  if (BigInt(summary.composition.strategyAccountingAssets) > BigInt(0)) return "CSP active";
  return "Idle";
}

function estimateShareValue(shares: bigint, summary: FundSummaryResponse): bigint {
  const denominator = BigInt(summary.shareSupply) + BigInt(summary.virtualShares);
  if (shares <= BigInt(0) || denominator <= BigInt(0)) return BigInt(0);
  return (shares * (BigInt(summary.netAssets) + BigInt(1))) / denominator;
}
