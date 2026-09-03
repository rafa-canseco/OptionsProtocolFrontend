import type { Capacity, PriceQuote } from "@/lib/api";
import type { AssetConfig } from "@/lib/assets";
import { getDeploymentEnv } from "@/lib/deployment";

const PRODUCTION_READ_ONLY_ASSETS = new Set(["sol", "tslax"]);

export function isSolanaEnabled(): boolean {
  return process.env.NEXT_PUBLIC_SOLANA_ENABLED === "true";
}

export function isLazyOTokenEnabled(): boolean {
  return process.env.NEXT_PUBLIC_LAZY_OTOKEN_ENABLED === "true";
}

export function isProductionReadOnlyAsset(
  asset: Pick<AssetConfig, "slug" | "chain">,
): boolean {
  return (
    !isSolanaEnabled() &&
    getDeploymentEnv() === "mainnet" &&
    asset.chain === "solana" &&
    PRODUCTION_READ_ONLY_ASSETS.has(asset.slug)
  );
}

export function isSolanaOffInProd(): boolean {
  return !isSolanaEnabled() && getDeploymentEnv() === "mainnet";
}

const NVDAC_READINESS_REASONS = {
  disabled: "NVDAc is disabled by the backend.",
  paused: "NVDAc actions are paused by route or policy controls.",
  policy_paused: "NVDAc transfers are paused by policy controls.",
  stale_oracle: "NVDAc actions are blocked because the price oracle is stale.",
  excessive_impact: "NVDAc actions are blocked because current price impact exceeds the qualified route limit.",
  unqualified: "NVDAc actions are blocked because the settlement route is not qualified.",
} as const;

export function isCanonicalQuoteForAsset(quote: PriceQuote, asset: AssetConfig): boolean {
  if (quote.chain !== asset.chain) return false;
  return !asset.address || quote.underlying_address?.toLowerCase() === asset.address.toLowerCase();
}

export function getAssetActionBlockReason(asset: AssetConfig, capacity: Capacity | null): string | null {
  if (asset.slug !== "nvdac") return null;
  if (!capacity) return "NVDAc backend readiness is unavailable.";
  if (capacity.readiness_status && capacity.readiness_status !== "ready") {
    return NVDAC_READINESS_REASONS[capacity.readiness_status] || "NVDAc backend risk checks are incomplete.";
  }
  if (!capacity.backend_ready) return NVDAC_READINESS_REASONS.disabled;
  if (
    capacity.asset_chain !== asset.chain ||
    capacity.asset_address?.toLowerCase() !== asset.address?.toLowerCase()
  ) {
    return "NVDAc backend identity does not match the canonical Base token address.";
  }
  if (!capacity.route_active) return "NVDAc actions are paused because its settlement route is not active.";
  if (!capacity.route_qualified) return NVDAC_READINESS_REASONS.unqualified;
  if (capacity.readiness_status !== "ready") return "NVDAc backend risk checks are incomplete.";
  return null;
}

export function isExecutableQuote(quote: PriceQuote): boolean {
  if (quote.deployment_status === "failed") return false;
  if (
    (quote.deployment_status === "virtual" ||
      quote.deployment_status === "creating") &&
    !isLazyOTokenEnabled()
  ) {
    return false;
  }
  return !!(
    quote.otoken_address &&
    quote.signature &&
    quote.mm_address &&
    quote.bid_price_raw != null &&
    quote.deadline != null &&
    quote.quote_id &&
    quote.max_amount_raw != null &&
    quote.maker_nonce != null
  );
}

export function isRangeExecutableQuote(quote: PriceQuote): boolean {
  return (
    isExecutableQuote(quote) &&
    (quote.deployment_status == null || quote.deployment_status === "ready")
  );
}

export function reconcileSelectedQuote(
  selected: PriceQuote | null,
  available: PriceQuote[],
): PriceQuote | null {
  if (!selected) return null;
  return (
    available.find(
      (quote) =>
        quote.strike === selected.strike &&
        quote.option_type === selected.option_type &&
        quote.expiry_date === selected.expiry_date &&
        quote.chain === selected.chain,
    ) ?? null
  );
}
