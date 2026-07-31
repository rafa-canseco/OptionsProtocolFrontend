import type { FundPositionResponse, FundSummaryResponse } from "@/lib/api";
import {
  ASSETS,
  ASSET_SLUGS,
  type AssetConfig,
} from "@/lib/assets";
import type { FundStrategyKind } from "@/lib/fundDeployment";
import { rawFundAmount } from "@/lib/fundVault";

export type VaultCardAvailability = "live" | "coming-soon";
export type VaultStrategy = "csp" | "covered-call";

export type VaultCardMetadata = {
  id: string;
  strategyKind: FundStrategyKind;
  name: string;
  assetLabel: string;
  accountingAssetSymbol: string;
  icon: string;
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

export const VAULT_CATALOG_ASSET_SLUGS = ASSET_SLUGS.filter(
  (slug) => ASSETS[slug].chain === "base",
);

export function vaultCardMetadata(
  strategy: VaultStrategy,
  asset: AssetConfig,
): VaultCardMetadata {
  const isCsp = strategy === "csp";
  const accountingAssetSymbol = isCsp
    ? asset.stableSymbol
    : asset.wrappedSymbol;
  const isLive = asset.slug === "eth";

  return {
    id: `${asset.slug}-${strategy}`,
    strategyKind: isCsp ? "cash_secured_put" : "covered_call",
    name: isCsp
      ? `${asset.symbol} Cash-Secured Put`
      : `${asset.symbol} Covered Call`,
    assetLabel: `${accountingAssetSymbol} vault`,
    accountingAssetSymbol,
    icon: isCsp ? "usdc" : asset.slug,
    strategyLabel: `${asset.symbol} ${isCsp ? "puts" : "calls"}`,
    description: isCsp
      ? `Earn income while waiting to buy ${asset.symbol} at a lower price.`
      : `Earn income on ${asset.symbol} you already own.`,
    availability: isLive ? "live" : "coming-soon",
    policy: isCsp ? cspPolicy(asset) : coveredCallPolicy(asset),
  };
}

export const CSP_VAULT_CARD = vaultCardMetadata("csp", ASSETS.eth);
export const COVERED_CALL_VAULT_CARD = vaultCardMetadata(
  "covered-call",
  ASSETS.eth,
);

export const META_WHEEL_VAULT_CARD: VaultCardMetadata = {
  id: "eth-meta-wheel",
  strategyKind: "meta_wheel",
  name: "ETH Meta Wheel",
  assetLabel: "USDC vault",
  accountingAssetSymbol: "USDC",
  icon: "wheel",
  strategyLabel: "ETH wheel",
  description:
    "Automate CSP and covered-call cycles while protecting every assignment price.",
  availability: "coming-soon",
  policy: {
    strike: "Calls never below assignment",
    duration: "≈48 hours per leg",
    allocation: "Bounded parallel lanes",
    positionLimit: "Multiple tracked tranches",
    intro:
      "The parent vault moves USDC through dedicated CSP and covered-call lanes and keeps each assignment lot's sale floor onchain.",
    steps: [
      "Deposits receive parent fund shares immediately and enter the pending CSP queue; users only deposit and redeem USDC.",
      "When a CSP is assigned, its exact WETH and literal strike become an immutable assignment lot instead of being sold and repurchased.",
      "Covered calls may consume one or more lots only when their strike is at or above every consumed lot's assignment strike plus the configured cost buffer.",
      "New USDC can continue into CSP lanes while assigned WETH runs covered calls in separate bounded lanes.",
      "Called-away USDC returns to the CSP queue. If no eligible call clears the protected floor, WETH remains idle rather than realizing a below-assignment sale.",
      "Redemptions are requested and settled in USDC without weakening the protected call floor.",
    ],
  },
};

function cspPolicy(asset: AssetConfig): VaultCardMetadata["policy"] {
  return {
    strike: "≈15% below spot",
    duration: "≈48 hours",
    allocation: "Up to 80%",
    positionLimit: "One at a time",
    intro: `The vault continuously sells one ${asset.symbol} cash-secured put at a time.`,
    steps: [
      `Deposits receive transferable fund shares immediately. New ${asset.stableSymbol} stays idle until the next position opens.`,
      `Each new position uses up to 80% of the liquid ${asset.stableSymbol} available then and keeps the remaining 20% as a reserve.`,
      "After each put settles, the vault attempts to open the next eligible position for about another 48 hours.",
      `If assigned, ${asset.wrappedSymbol} stays in the fund and the next put uses the remaining liquid ${asset.stableSymbol}. Assignment alone does not stop the loop.`,
      `The vault waits only when there is not enough ${asset.stableSymbol}, pricing or NAV is not current, no eligible quote is available, or the strategy is explicitly paused.`,
    ],
  };
}

function coveredCallPolicy(
  asset: AssetConfig,
): VaultCardMetadata["policy"] {
  return {
    strike: "Far above spot · Δ 0.05 ±0.015",
    duration: "≈48 hours",
    allocation: "Up to 80%",
    positionLimit: "One at a time",
    intro: `The vault repeatedly sells one covered ${asset.symbol} call at a time.`,
    steps: [
      `Deposits receive transferable fund shares immediately. New ${asset.wrappedSymbol} stays idle until the next position opens.`,
      "The allocator targets a low-delta call. Its exact percentage above spot changes with volatility; eligible quotes stay near delta 0.05.",
      `Each new position uses up to 80% of the liquid ${asset.wrappedSymbol} available then, keeps the remaining 20% as a reserve, and targets about 48 hours to expiry.`,
      `After an OTM call settles, ${asset.wrappedSymbol} unlocks and the vault attempts to open the next eligible call.`,
      `${asset.stableSymbol} from an ITM settlement remains accounted inside the strategy while it is safely normalized back to ${asset.wrappedSymbol}; then the loop can continue.`,
      `The vault keeps opening calls while enough ${asset.wrappedSymbol}, current NAV and an eligible quote exist. It waits on unresolved normalization, caps or an explicit pause.`,
    ],
  };
}

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
  if (summary.fund.strategyKind === "meta_wheel" && summary.wheel) {
    return summary.wheel.currentPhase || "Wheel active";
  }
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
