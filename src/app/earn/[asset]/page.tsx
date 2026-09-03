"use client";

import { use } from "react";
import { redirect } from "next/navigation";
import { PriceMenuV2 } from "@/components/v2/PriceMenuV2";
import { useCapacity } from "@/hooks/useCapacity";
import { getAssetConfig, isActiveAssetSlug, isBackendGatedAssetSlug } from "@/lib/assets";
import { getAssetActionBlockReason } from "@/lib/marketState";
import { useAppPreferences } from "@/lib/preferences";

export default function EarnAssetPage({
  params,
}: {
  params: Promise<{ asset: string }>;
}) {
  const { locale } = useAppPreferences();
  const { asset } = use(params);
  const config = getAssetConfig(asset);
  const gated = isBackendGatedAssetSlug(asset);
  const { capacity, loading } = useCapacity(asset);

  if (!config || !isActiveAssetSlug(asset)) {
    redirect("/earn/eth");
  }
  if (gated && loading) {
    return <main className="mx-auto max-w-6xl px-6 py-10" aria-busy="true" />;
  }
  if (gated && getAssetActionBlockReason(config, capacity)) {
    redirect("/earn/eth");
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 space-y-8">
      <h1 className="sr-only">{locale === "es" ? `Genera ingresos con ${config.symbol}` : `Earn Premium on ${config.symbol}`}</h1>
      <PriceMenuV2 asset={config} key={config.slug} />
    </main>
  );
}
