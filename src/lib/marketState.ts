import type { PriceQuote } from "@/lib/api";
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
