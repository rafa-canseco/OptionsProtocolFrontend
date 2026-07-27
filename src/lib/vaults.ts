import type { FundPositionResponse, FundSummaryResponse } from "@/lib/api";
import type { FundStrategyKind } from "@/lib/fundDeployment";
import { rawFundAmount } from "@/lib/fundVault";

export type VaultCardAvailability = "live" | "coming-soon";

export type VaultCardMetadata = {
  id: "eth-csp" | "eth-covered-call";
  strategyKind: FundStrategyKind;
  name: string;
  assetLabel: string;
  accountingAssetSymbol: "USDC" | "WETH";
  icon: "usdc" | "eth";
  strategyLabel: string;
  description: string;
  availability: VaultCardAvailability;
  policy: {
    strike: string;
    duration: string;
    allocation: string;
    positionLimit: string;
    intro: string;
    steps: string[];
  };
};

export const CSP_VAULT_CARD: VaultCardMetadata = {
  id: "eth-csp",
  strategyKind: "cash_secured_put",
  name: "ETH Cash-Secured Put",
  assetLabel: "USDC vault",
  accountingAssetSymbol: "USDC",
  icon: "usdc",
  strategyLabel: "ETH puts",
  description: "Earn premium by selling ETH puts backed by the vault's USDC.",
  availability: "live",
  policy: {
    strike: "≈15% below spot",
    duration: "≈48 hours",
    allocation: "Up to 80%",
    positionLimit: "One at a time",
    intro: "The vault continuously sells one ETH cash-secured put at a time.",
    steps: [
      "Deposits receive transferable fund shares immediately. New USDC stays idle until the next position opens.",
      "The allocator uses up to 80% of liquid USDC, capped at 800 USDC under the current test policy.",
      "After each put settles, the vault attempts to open the next eligible position for about another 48 hours.",
      "If assigned, WETH stays in the fund and the next put uses the remaining liquid USDC. Assignment alone does not stop the loop.",
      "The vault waits only when there is not enough USDC, pricing or NAV is not current, no eligible quote is available, or the strategy is explicitly paused.",
    ],
  },
};

export const COVERED_CALL_VAULT_CARD: VaultCardMetadata = {
  id: "eth-covered-call",
  strategyKind: "covered_call",
  name: "ETH Covered Call",
  assetLabel: "WETH vault",
  accountingAssetSymbol: "WETH",
  icon: "eth",
  strategyLabel: "ETH calls",
  description:
    "Earn premium on WETH. Calls cap ETH upside, and an ITM settlement can temporarily move the fund into USDC before it returns to WETH.",
  availability: "live",
  policy: {
    strike: "Far above spot · Δ 0.05 ±0.015",
    duration: "≈48 hours",
    allocation: "25% · ≤0.0025 WETH",
    positionLimit: "One at a time",
    intro: "The vault repeatedly sells one covered ETH call at a time.",
    steps: [
      "Deposits receive transferable fund shares immediately. New WETH stays idle until the next position opens.",
      "The allocator targets a low-delta call. Its exact percentage above spot changes with volatility; eligible quotes stay near delta 0.05.",
      "Each testnet position uses 25% of liquid WETH, capped at 0.0025 WETH, and targets about 48 hours to expiry.",
      "After an OTM call settles, WETH unlocks and the vault attempts to open the next eligible call.",
      "If called away, USDC remains accounted inside the strategy while it is safely normalized back to WETH; then the loop can continue.",
      "The vault keeps opening calls while enough WETH, current NAV and an eligible quote exist. It waits on unresolved normalization, caps or an explicit pause.",
    ],
  },
};

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

export function vaultStateCopy(
  state: VaultPositionState,
  assetSymbol: string,
): { label: string; action: string } {
  const copy = VAULT_STATE_COPY[state];
  if (assetSymbol === "USDC") return copy;
  if (state === "empty") return { ...copy, action: `Deposit ${assetSymbol}` };
  if (state === "partial") {
    return { ...copy, action: `Claim available ${assetSymbol}` };
  }
  if (state === "claimable") {
    return { label: `${assetSymbol} ready`, action: `Claim ${assetSymbol}` };
  }
  return copy;
}

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
  if (BigInt(summary.composition.strategyAccountingAssets) > BigInt(0)) {
    return summary.strategy?.strategyKind === "covered_call"
      ? "Covered call active"
      : "CSP active";
  }
  return "Idle";
}

function estimateShareValue(shares: bigint, summary: FundSummaryResponse): bigint {
  const denominator = BigInt(summary.shareSupply) + BigInt(summary.virtualShares);
  if (shares <= BigInt(0) || denominator <= BigInt(0)) return BigInt(0);
  return (shares * (BigInt(summary.netAssets) + BigInt(1))) / denominator;
}
