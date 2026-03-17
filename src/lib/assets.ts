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
  /** When true, the asset is shown in selectors but not yet tradeable */
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
    symbol: "BTC",
    name: "Bitcoin",
    wrappedSymbol: "WBTC",
    stableSymbol: "USDC",
    maxAmount: 100,
    maxAmountUsd: 1_000_000,
    amountPlaceholder: "0.01",
    displayDecimals: 6,
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
