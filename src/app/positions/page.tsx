"use client";

import { useState, useMemo } from "react";
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

export default function PositionsPage() {
  const {
    address,
    fundingAddress,
    solanaAddress,
    externalWallets,
    isConnected,
  } = useWallet();
  const solanaPositionAddresses = useMemo(
    () => [
      solanaAddress,
      ...externalWallets
        .filter((wallet) => wallet.chain === "solana")
        .map((wallet) => wallet.address),
    ].filter((value, index, arr): value is string =>
      Boolean(value) && arr.indexOf(value) === index,
    ),
    [externalWallets, solanaAddress],
  );
  const { positions, loading, refresh } = usePositions(
    address,
    fundingAddress,
    solanaPositionAddresses,
  );
  const { activity } = useActivity(address, fundingAddress ?? undefined);
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
        <h1 className="sr-only">Your Positions</h1>
        <div className="text-center py-12">
          <p className="text-lg font-semibold text-[var(--text)]">Connect your wallet</p>
          <p className="text-sm text-[var(--text-secondary)] mt-1">to see your positions.</p>
        </div>
      </main>
    );
  }

  if (!loading && allPositions.length === 0) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10 space-y-6">
        <h1 className="sr-only">Your Positions</h1>
        <div className="text-center py-12">
          <p className="text-lg font-semibold text-[var(--text)]">No positions yet</p>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Accept a price on the <a href="/earn/eth" className="text-[var(--accent)] hover:underline">Earn</a> page to get started.
          </p>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10 space-y-3">
        <h1 className="sr-only">Your Positions</h1>
        {[1, 2].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-[var(--surface)]" />
        ))}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 space-y-8">
      <h1 className="sr-only">Your Positions</h1>

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
          Active positions
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
                    optimistic={item.positions.some((p) => p.id.startsWith("opt-"))}
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
                  optimistic={pos.id.startsWith("opt-")}
                  yieldMetric={yieldMetric}
                />
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[var(--border)] p-6 text-center">
            <p className="text-sm text-[var(--text-secondary)]">
              No active positions.{" "}
              <a href="/earn/eth" className="text-[var(--accent)] hover:underline">Earn premium</a> by setting your price.
            </p>
          </div>
        )}
      </section>

      <EarningsChart positions={allPositions} />

      {historyItems.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
            History
          </h2>
          <TradeLog items={historyItems} />
        </section>
      )}
    </main>
  );
}
