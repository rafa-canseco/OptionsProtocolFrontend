import { normalizeUsdPrice } from "@/lib/positionMath";

export interface AssetConfig {
  slug: string;
  symbol: string;
  name: string;
  /** Wrapped token symbol used as collateral for calls */
  wrappedSymbol: string;
  /** Stable token symbol used as collateral for puts */
  stableSymbol: string;
  /** Max amount for the amount input (in asset units, for sells) */
  maxAmount: number;
  /** Max amount in USD (for buys) */
  maxAmountUsd: number;
  /** Placeholder for the amount input (sell side) */
  amountPlaceholder: string;
  /** Number of decimals to show for the asset */
  displayDecimals: number;
  /** If true, asset is shown in selector but not tradeable yet */
  comingSoon?: boolean;
  /** Uniswap V3 fee tier for USDC↔asset swaps. Must match on-chain config. */
  swapFeeTier?: number;
  /** Minimum sell amount in asset units (e.g. 0.005 ETH) */
  minSellAmount: number;
  /** Minimum buy amount in USD */
  minBuyAmountUsd: number;
  /** Which chain this asset trades on */
  chain: "base" | "solana";
  /** Decimals of the wrapped collateral token for calls */
  collateralDecimals: number;
  /** Spot price used when live feed is unavailable */
  fallbackSpot: number;
  /** Canonical token address when ticker-only identity is unsafe. */
  address?: `0x${string}`;
  disclosure?: {
    instrument: string;
    jurisdiction: string;
    eligibility: string;
    policyPause: string;
  };
}

export const ASSETS: Record<string, AssetConfig> = {
  eth: {
    slug: "eth",
    symbol: "ETH",
    name: "Ethereum",
    wrappedSymbol: "WETH",
    stableSymbol: "USDC",
    maxAmount: 1_000,
    maxAmountUsd: 1_000_000,
    amountPlaceholder: "0.5",
    displayDecimals: 4,
    swapFeeTier: 3000,
    minSellAmount: 0.005,
    minBuyAmountUsd: 10,
    chain: "base",
    collateralDecimals: 18,
    fallbackSpot: 2621,
  },
  btc: {
    slug: "btc",
    symbol: "cbBTC",
    name: "Coinbase Wrapped BTC",
    wrappedSymbol: "cbBTC",
    stableSymbol: "USDC",
    maxAmount: 100,
    maxAmountUsd: 1_000_000,
    amountPlaceholder: "0.01",
    displayDecimals: 6,
    swapFeeTier: 500,
    minSellAmount: 0.0001,
    minBuyAmountUsd: 10,
    chain: "base",
    collateralDecimals: 8,
    fallbackSpot: 95_000,
  },
  nvdac: {
    slug: "nvdac",
    symbol: "NVDAc",
    name: "NVIDIA Tokenized Stock (B20)",
    wrappedSymbol: "NVDAc",
    stableSymbol: "USDC",
    maxAmount: Number.POSITIVE_INFINITY,
    maxAmountUsd: Number.POSITIVE_INFINITY,
    amountPlaceholder: "1",
    displayDecimals: 4,
    minSellAmount: 0.01,
    minBuyAmountUsd: 10,
    chain: "base",
    collateralDecimals: 8,
    fallbackSpot: 180,
    address: "0xb20000000000000000000078ee7ce2fE4908108C",
    disclosure: {
      instrument: "NVDAc is a tokenized-stock/B20 economic-exposure and redemption instrument. It is not NVIDIA-issued registered equity and does not provide direct ownership of NVIDIA shares.",
      jurisdiction: process.env.NEXT_PUBLIC_NVDAC_JURISDICTION_NOTICE || "Availability depends on your jurisdiction.",
      eligibility: process.env.NEXT_PUBLIC_NVDAC_ELIGIBILITY_NOTICE || "You must satisfy the applicable eligibility requirements before acting.",
      policyPause: process.env.NEXT_PUBLIC_NVDAC_POLICY_PAUSE_NOTICE || "Transfers and redemption may pause under the instrument's policy controls.",
    },
  },
  cbzec: {
    slug: "cbzec",
    symbol: "cbZEC",
    name: "Coinbase Wrapped Zcash",
    wrappedSymbol: "cbZEC",
    stableSymbol: "USDC",
    maxAmount: Number.POSITIVE_INFINITY,
    maxAmountUsd: Number.POSITIVE_INFINITY,
    amountPlaceholder: "1",
    displayDecimals: 4,
    minSellAmount: 0.01,
    minBuyAmountUsd: 10,
    chain: "base",
    collateralDecimals: 8,
    fallbackSpot: 50,
    address: "0xB2000000000000000000008501b13360000cb2EC",
    disclosure: {
      instrument: "cbZEC is a wrapped-token/B20 representation of ZEC. It is not native ZEC; custody, redemption, and transfer-policy risks apply.",
      jurisdiction: process.env.NEXT_PUBLIC_CBZEC_JURISDICTION_NOTICE || "Availability depends on your jurisdiction.",
      eligibility: process.env.NEXT_PUBLIC_CBZEC_ELIGIBILITY_NOTICE || "You must satisfy the applicable eligibility requirements before acting.",
      policyPause: process.env.NEXT_PUBLIC_CBZEC_POLICY_PAUSE_NOTICE || "Transfers and redemption may pause under the instrument's policy controls.",
    },
  },
  cbhype: {
    slug: "cbhype",
    symbol: "cbHYPE",
    name: "Coinbase Wrapped HYPE",
    wrappedSymbol: "cbHYPE",
    stableSymbol: "USDC",
    maxAmount: Number.POSITIVE_INFINITY,
    maxAmountUsd: Number.POSITIVE_INFINITY,
    amountPlaceholder: "1",
    displayDecimals: 4,
    minSellAmount: 0.01,
    minBuyAmountUsd: 10,
    chain: "base",
    collateralDecimals: 18,
    fallbackSpot: 40,
    address: "0xB200000000000000000000451d033a5000cb479e",
    disclosure: {
      instrument: "cbHYPE is a wrapped-token/B20 representation of HYPE. It is not native HYPE; custody, redemption, and transfer-policy risks apply.",
      jurisdiction: process.env.NEXT_PUBLIC_CBHYPE_JURISDICTION_NOTICE || "Availability depends on your jurisdiction.",
      eligibility: process.env.NEXT_PUBLIC_CBHYPE_ELIGIBILITY_NOTICE || "You must satisfy the applicable eligibility requirements before acting.",
      policyPause: process.env.NEXT_PUBLIC_CBHYPE_POLICY_PAUSE_NOTICE || "Transfers and redemption may pause under the instrument's policy controls.",
    },
  },
  vvv: {
    slug: "vvv",
    symbol: "VVV",
    name: "Venice Token",
    wrappedSymbol: "VVV",
    stableSymbol: "USDC",
    maxAmount: Number.POSITIVE_INFINITY,
    maxAmountUsd: Number.POSITIVE_INFINITY,
    amountPlaceholder: "10",
    displayDecimals: 4,
    minSellAmount: 0.1,
    minBuyAmountUsd: 10,
    chain: "base",
    collateralDecimals: 18,
    fallbackSpot: 1,
    address: "0xacfE6019Ed1A7Dc6f7B508C02d1b04ec88cC21bf",
    disclosure: {
      instrument: "VVV is a token settlement asset on Base. Smart-contract, custody, and liquidity risks apply; holding it does not guarantee redemption value.",
      jurisdiction: process.env.NEXT_PUBLIC_VVV_JURISDICTION_NOTICE || "Availability depends on your jurisdiction.",
      eligibility: process.env.NEXT_PUBLIC_VVV_ELIGIBILITY_NOTICE || "You must satisfy the applicable eligibility requirements before acting.",
      policyPause: process.env.NEXT_PUBLIC_VVV_POLICY_PAUSE_NOTICE || "Transfers or settlement may pause under applicable token or route controls.",
    },
  },
  sol: {
    slug: "sol",
    symbol: "SOL",
    name: "Solana",
    wrappedSymbol: "wSOL",
    stableSymbol: "USDC",
    maxAmount: 10_000,
    maxAmountUsd: 1_000_000,
    amountPlaceholder: "10",
    displayDecimals: 4,
    minSellAmount: 0.1,
    minBuyAmountUsd: 10,
    chain: "solana",
    collateralDecimals: 9,
    fallbackSpot: 180,
  },
  tslax: {
    slug: "tslax",
    symbol: "TSLAx",
    name: "Tesla xStock",
    wrappedSymbol: "TSLAx",
    stableSymbol: "USDC",
    maxAmount: 10_000,
    maxAmountUsd: 1_000_000,
    amountPlaceholder: "10",
    displayDecimals: 4,
    minSellAmount: 0.01,
    minBuyAmountUsd: 10,
    chain: "solana",
    collateralDecimals: 8,
    fallbackSpot: 350,
  },
};

export const ACTIVE_ASSET_SLUGS = ["eth", "btc"] as const;
export const GATED_BASE_ASSET_SLUGS = ["nvdac", "cbzec", "cbhype", "vvv"] as const;
export const ASSET_SLUGS = Object.keys(ASSETS);
const DEFAULT_ASSET_FALLBACK = "eth";

export function isBackendGatedAssetSlug(slug: string): boolean {
  return GATED_BASE_ASSET_SLUGS.includes(slug.toLowerCase() as (typeof GATED_BASE_ASSET_SLUGS)[number]);
}

export function isActiveAssetSlug(slug: string): boolean {
  const normalized = slug.toLowerCase();
  return isBackendGatedAssetSlug(normalized) || ACTIVE_ASSET_SLUGS.includes(normalized as (typeof ACTIVE_ASSET_SLUGS)[number]);
}

export function getDefaultAssetSlug(hostname?: string): string {
  void hostname;
  const override = process.env.NEXT_PUBLIC_FEATURED_ASSET;
  return override && isActiveAssetSlug(override)
    ? override.toLowerCase()
    : DEFAULT_ASSET_FALLBACK;
}

/** @deprecated Use getDefaultAssetSlug() for deployment-aware routing. */
export const DEFAULT_ASSET = DEFAULT_ASSET_FALLBACK;

if (!(DEFAULT_ASSET in ASSETS)) {
  throw new Error(
    `DEFAULT_ASSET "${DEFAULT_ASSET}" not found in ASSETS registry`
  );
}

export function getAssetConfig(slug: string): AssetConfig | undefined {
  return ASSETS[slug.toLowerCase()];
}

export function isActivePositionAsset(asset?: string, strikePrice?: number): boolean {
  return isActiveAssetSlug(resolvePositionAsset(asset, strikePrice).slug);
}

/**
 * Resolve asset config for a position.
 * Uses the backend `asset` field when available, falls back to
 * inferring from strike price (BTC > $10k, ETH below).
 */
export function resolvePositionAsset(
  asset?: string,
  strikePrice?: number,
): AssetConfig {
  if (asset) {
    const config = ASSETS[asset.toLowerCase()];
    if (config) return config;
  }
  if (strikePrice != null) {
    const strikeUsd = normalizeUsdPrice(strikePrice);
    if (strikeUsd > 10_000) return ASSETS.btc;
    if (strikeUsd < 500) return ASSETS.sol;
    return ASSETS.eth;
  }
  return ASSETS[DEFAULT_ASSET_FALLBACK];
}
