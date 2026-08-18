import type { FundSummaryResponse } from "@/lib/api";

export type FundValuationBreakdown = {
  navPriceAssets: string;
  marketPriceAssets: string | null;
  stressPriceAssets: string | null;
  grossAssets: string;
  lockedCollateralAssets: string;
  fairOptionLiabilityAssets: string | null;
  assignedWethValueAssets: string | null;
  settlementCostAssets: string | null;
  normalizationCostAssets: string | null;
  optionExitCostAssets: string | null;
  methodology: string;
  modelVersion: string | null;
  observedAt: string | null;
  sourceQuality: string | null;
  stale: boolean;
};

/**
 * Normalizes the evolving B1N-353 response without changing transactional
 * semantics. `sharePriceAssets` is always fair NAV; market/stress prices are
 * display-only and are never used by deposit calculations.
 */
export function fundValuation(
  summary: FundSummaryResponse,
): FundValuationBreakdown {
  const composition = summary.composition;
  const assignedValue = optionalUnsigned(composition.assignedWethValueAssets);
  const explicitGross = optionalUnsigned(composition.grossAssets);
  const legacyGross =
    unsigned(composition.idleAssets) +
    unsigned(composition.strategyAccountingAssets) +
    (assignedValue === null ? BigInt(0) : assignedValue) +
    unsigned(composition.transientUsdcValueAssets);

  return {
    navPriceAssets: unsignedString(summary.sharePriceAssets),
    marketPriceAssets: optionalUnsignedString(summary.marketPriceAssets),
    stressPriceAssets: optionalUnsignedString(
      summary.stressPriceAssets ?? summary.nav.stress?.sharePriceAssets,
    ),
    grossAssets: (explicitGross ?? legacyGross).toString(),
    lockedCollateralAssets: unsignedString(
      composition.lockedCollateralAssets ??
        composition.strategyAccountingAssets,
    ),
    fairOptionLiabilityAssets: optionalUnsignedString(
      composition.fairOptionLiabilityAssets,
    ),
    assignedWethValueAssets:
      assignedValue === null ? null : assignedValue.toString(),
    settlementCostAssets: optionalUnsignedString(
      composition.settlementCostAssets,
    ),
    normalizationCostAssets: optionalUnsignedString(
      composition.normalizationCostAssets,
    ),
    optionExitCostAssets: optionalUnsignedString(
      composition.optionExitCostAssets,
    ),
    methodology: summary.nav.methodology?.trim() || "Reported fair NAV",
    modelVersion: optionalModelVersion(summary.nav.modelVersion),
    observedAt: summary.nav.observedAt ?? summary.indexedAt,
    sourceQuality: summary.nav.sourceQuality?.trim() || null,
    stale: summary.stale || summary.nav.stale,
  };
}

function optionalUnsignedString(
  raw: string | null | undefined,
): string | null {
  const value = optionalUnsigned(raw);
  return value === null ? null : value.toString();
}

function optionalModelVersion(
  raw: string | number | null | undefined,
): string | null {
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? raw.toString() : null;
  }
  return raw?.trim() || null;
}

function unsignedString(raw: string | null | undefined): string {
  return unsigned(raw).toString();
}

function optionalUnsigned(
  raw: string | null | undefined,
): bigint | null {
  if (raw == null || raw === "") return null;
  try {
    const value = BigInt(raw);
    return value < BigInt(0) ? BigInt(0) : value;
  } catch {
    return null;
  }
}

function unsigned(raw: string | null | undefined): bigint {
  return optionalUnsigned(raw) ?? BigInt(0);
}
