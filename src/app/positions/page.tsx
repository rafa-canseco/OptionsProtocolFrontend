"use client";

import { useState, useMemo } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { PositionCard } from "@/components/PositionCard";
import { RangePositionCard } from "@/components/RangePositionCard";
import { PortfolioSummary } from "@/components/PortfolioSummary";
import { EarningsChart } from "@/components/EarningsChart";
import { TradeLog } from "@/components/TradeLog";
import { useWallet } from "@/hooks/useWallet";
import { usePositions } from "@/hooks/usePositions";
import { useSpot } from "@/hooks/useSpot";
import { useOptimisticPositions } from "@/hooks/useOptimisticPositions";
import { useActivity } from "@/hooks/useActivity";
import { useNotificationStatus } from "@/hooks/useNotificationStatus";
import { resolvePositionAsset } from "@/lib/assets";
import { groupPositions } from "@/lib/positionGrouping";
import { NotificationBanner } from "@/components/NotificationBanner";
import type { YieldMetric } from "@/components/YieldToggle";
import { useAppPreferences } from "@/lib/preferences";

export default function PositionsPage() {
  const { locale } = useAppPreferences();
  const t = (en: string, es: string) => locale === "es" ? es : en;
  const { user } = usePrivy();
  const {
    address,
    portfolioAddresses,
    isConnected,
  } = useWallet();
  const solanaPositionAddresses = useMemo(
    () => portfolioAddresses.solana.filter((value, index, arr): value is string =>
      Boolean(value) && arr.indexOf(value) === index,
    ),
    [portfolioAddresses.solana],
  );
  const {
    positions,
    loading,
    refresh,
    loadMoreSettled,
    settledHasMore,
    settledLoading,
  } = usePositions(
    address,
    undefined,
    solanaPositionAddresses,
    15_000,
    portfolioAddresses.base,
    user?.id,
  );
  const { activity } = useActivity(address, undefined);
  const { spot: ethSpot } = useSpot("eth");
  const { spot: btcSpot } = useSpot("btc");
  const { spot: solSpot } = useSpot("sol");
  const allPositions = useOptimisticPositions(positions);
  const [yieldMetric, setYieldMetric] = useState<YieldMetric>("apr");
  const notifStatus = useNotificationStatus(address);
  const active = useMemo(
    () => allPositions.filter((p) => !p.is_settled),
    [allPositions],
  );
  const history = allPositions.filter((p) => p.is_settled);

  const activeItems = useMemo(() => groupPositions(active), [active]);
  const historyItems = useMemo(() => groupPositions(history), [history]);

  if (!isConnected) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10 space-y-8">
        <h1 className="sr-only">{t("Your Positions", "Tus posiciones")}</h1>
        <div className="text-center py-12">
          <p className="text-lg font-semibold text-[var(--text)]">{t("Connect your wallet", "Conecta tu wallet")}</p>
          <p className="text-sm text-[var(--text-secondary)] mt-1">{t("to see your positions.", "para ver tus posiciones.")}</p>
        </div>
      </main>
    );
  }

  if (!loading && allPositions.length === 0) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10 space-y-6">
        <h1 className="sr-only">{t("Your Positions", "Tus posiciones")}</h1>
        <div className="text-center py-12">
          <p className="text-lg font-semibold text-[var(--text)]">{t("No positions yet", "Aún no tienes posiciones")}</p>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            {t("Accept a price on the", "Acepta un precio en")} <a href="/earn/eth" className="text-[var(--accent)] hover:underline">{t("Earn", "Operar")}</a> {t("page to get started.", "para comenzar.")}
          </p>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10 space-y-3">
        <h1 className="sr-only">{t("Your Positions", "Tus posiciones")}</h1>
        {[1, 2].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-[var(--surface)]" />
        ))}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 space-y-8">
      <h1 className="sr-only">{t("Your Positions", "Tus posiciones")}</h1>

      <PortfolioSummary
        positions={allPositions}
        activity={activity}
        yieldMetric={yieldMetric}
        onYieldMetricChange={setYieldMetric}
      />

      {address && (
        <NotificationBanner walletAddress={address} status={notifStatus} />
      )}

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
          {t("Active positions", "Posiciones activas")}
        </h2>
        {activeItems.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {activeItems.map((item) => {
              if (item.type === "range") {
                const posAsset = resolvePositionAsset(
                  item.positions[0].asset,
                  item.positions[0].strike_price,
                );
                const posSpot = posAsset.slug === "btc" ? btcSpot : posAsset.slug === "sol" ? solSpot : ethSpot;
                return (
                  <RangePositionCard
                    key={item.groupId}
                    positions={item.positions}
                    spot={posSpot}
                    earnBase={`/earn/${posAsset.slug}`}
                    assetSymbol={posAsset.symbol}
                    assetSlug={posAsset.slug}
                    optimistic={false}
                    yieldMetric={yieldMetric}
                  />
                );
              }
              const pos = item.position;
              const posAsset = resolvePositionAsset(pos.asset, pos.strike_price);
              const posSpot = posAsset.slug === "btc" ? btcSpot : posAsset.slug === "sol" ? solSpot : ethSpot;
              return (
                <PositionCard
                  key={pos.id}
                  position={pos}
                  onSettled={refresh}
                  spot={posSpot}
                  earnBase={`/earn/${posAsset.slug}`}
                  assetSymbol={posAsset.symbol}
                  assetSlug={posAsset.slug}
                  optimistic={false}
                  yieldMetric={yieldMetric}
                />
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[var(--border)] p-6 text-center">
            <p className="text-sm text-[var(--text-secondary)]">
              {t("No active positions.", "No hay posiciones activas.")}{" "}
              <a href="/earn/eth" className="text-[var(--accent)] hover:underline">{t("Earn premium", "Genera ingresos")}</a> {t("by setting your price.", "definiendo tu precio.")}
            </p>
          </div>
        )}
      </section>

      <EarningsChart positions={allPositions} />

      {(historyItems.length > 0 || settledHasMore) && (
        <section id="position-history" className="space-y-4">
          <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
            {t("History", "Historial")}
          </h2>
          {historyItems.length > 0 && <TradeLog items={historyItems} />}
          {settledHasMore && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => void loadMoreSettled()}
                disabled={settledLoading}
                aria-busy={settledLoading}
                aria-controls="position-history"
                className="min-h-11 rounded-xl border border-[var(--border)] px-5 py-2.5 text-sm font-semibold text-[var(--text)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {settledLoading ? "Loading older positions…" : "Load older positions"}
              </button>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
