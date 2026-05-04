import type { PriceQuote } from "@/lib/api";
import type { AssetConfig } from "@/lib/assets";
import { getDeploymentEnv } from "@/lib/deployment";

const PRODUCTION_READ_ONLY_ASSETS = new Set(["sol", "tslax"]);

export function isSolanaEnabled(): boolean {
  return process.env.NEXT_PUBLIC_SOLANA_ENABLED === "true";
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
