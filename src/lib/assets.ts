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
  },
  aero: {
    slug: "aero",
    symbol: "AERO",
    name: "Aerodrome",
    wrappedSymbol: "AERO",
    stableSymbol: "USDC",
    maxAmount: 0,
    maxAmountUsd: 0,
    amountPlaceholder: "0",
    displayDecimals: 2,
    comingSoon: true,
  },
  virtual: {
    slug: "virtual",
    symbol: "VIRTUAL",
    name: "Virtuals Protocol",
    wrappedSymbol: "VIRTUAL",
    stableSymbol: "USDC",
    maxAmount: 0,
    maxAmountUsd: 0,
    amountPlaceholder: "0",
    displayDecimals: 2,
    comingSoon: true,
  },
};

export const ASSET_SLUGS = Object.keys(ASSETS);
export const DEFAULT_ASSET = "eth";

if (!(DEFAULT_ASSET in ASSETS)) {
  throw new Error(
    `DEFAULT_ASSET "${DEFAULT_ASSET}" not found in ASSETS registry`
  );
}

export function getAssetConfig(slug: string): AssetConfig | undefined {
  return ASSETS[slug.toLowerCase()];
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
    const strikeUsd = strikePrice / 1e8;
    return strikeUsd > 10_000 ? ASSETS.btc : ASSETS.eth;
  }
  return ASSETS[DEFAULT_ASSET];
}
