import type { Capacity, PriceQuote } from "@/lib/api";
import { isBackendGatedAssetSlug, type AssetConfig } from "@/lib/assets";
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

function readinessReason(asset: AssetConfig, status: Capacity["readiness_status"] | string): string {
  const symbol = asset.symbol;
  switch (status) {
    case "disabled": return `${symbol} is disabled by the backend.`;
    case "paused": return `${symbol} actions are paused by route or policy controls.`;
    case "policy_paused": return `${symbol} transfers are paused by policy controls.`;
    case "stale_oracle": return `${symbol} actions are blocked because the price oracle is stale.`;
    case "excessive_impact": return `${symbol} actions are blocked because current price impact exceeds the qualified route limit.`;
    case "unqualified": return `${symbol} actions are blocked because the settlement route is not qualified.`;
    default: return `${symbol} backend risk checks are incomplete.`;
  }
}

export function isCanonicalQuoteForAsset(quote: PriceQuote, asset: AssetConfig): boolean {
  if (quote.chain !== asset.chain) return false;
  return !asset.address || quote.underlying_address?.toLowerCase() === asset.address.toLowerCase();
}

function isTrustedLegacyReadinessQuote(quote: PriceQuote, asset: AssetConfig): boolean {
  if (!isCanonicalQuoteForAsset(quote, asset) || !isExecutableQuote(quote)) return false;
  if (!/^0x[0-9a-f]{40}$/i.test(quote.otoken_address ?? "")) return false;
  if (!/^0x[0-9a-f]{40}$/i.test(quote.mm_address ?? "")) return false;
  if (!/^0x[0-9a-f]{130}$/i.test(quote.signature ?? "")) return false;

  try {
    const zero = BigInt(0);
    const uint256Max = BigInt(`0x${"f".repeat(64)}`);
    const bidPrice = BigInt(quote.bid_price_raw!);
    const maxAmount = BigInt(quote.max_amount_raw!);
    const makerNonce = BigInt(quote.maker_nonce!);
    const quoteId = BigInt(quote.quote_id!);
    const deadline = BigInt(quote.deadline!);
    const now = BigInt(Math.floor(Date.now() / 1000));
    return (
      bidPrice > zero && bidPrice <= uint256Max &&
      maxAmount > zero && maxAmount <= uint256Max &&
      makerNonce >= zero && makerNonce <= uint256Max &&
      quoteId >= zero && quoteId <= uint256Max &&
      deadline > now && deadline <= uint256Max &&
      Number.isFinite(quote.expires_at) &&
      quote.expires_at > Number(now)
    );
  } catch {
    return false;
  }
}

export function getAssetActionBlockReason(
  asset: AssetConfig,
  capacity: Capacity | null,
  quote?: PriceQuote,
): string | null {
  if (!isBackendGatedAssetSlug(asset.slug)) return null;
  if (!capacity) return `${asset.symbol} backend readiness is unavailable.`;
  const hasReadinessFields =
    capacity.readiness_status !== undefined ||
    capacity.backend_ready !== undefined ||
    capacity.asset_chain !== undefined ||
    capacity.asset_address !== undefined ||
    capacity.route_active !== undefined ||
    capacity.route_qualified !== undefined;
  if (!hasReadinessFields) {
    return quote && isTrustedLegacyReadinessQuote(quote, asset)
      ? null
      : readinessReason(asset, "unknown");
  }
  if (capacity.readiness_status !== "ready") {
    return readinessReason(asset, capacity.readiness_status);
  }
  if (capacity.backend_ready !== true) return readinessReason(asset, "disabled");
  if (
    capacity.asset_chain !== asset.chain ||
    capacity.asset_address?.toLowerCase() !== asset.address?.toLowerCase()
  ) {
    return `${asset.symbol} backend identity does not match the canonical Base token address.`;
  }
  if (capacity.route_active !== true) return `${asset.symbol} actions are paused because its settlement route is not active.`;
  if (capacity.route_qualified !== true) return readinessReason(asset, "unqualified");
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
