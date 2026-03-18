"use client";

import { useState } from "react";
import { PositionCard } from "@/components/PositionCard";
import { PortfolioSummary } from "@/components/PortfolioSummary";
import { EarningsChart } from "@/components/EarningsChart";
import { TradeLog } from "@/components/TradeLog";
import { useWallet } from "@/hooks/useWallet";
import { usePositions } from "@/hooks/usePositions";
import { useSpot } from "@/hooks/useSpot";
import { useOptimisticPositions } from "@/hooks/useOptimisticPositions";
import { useActivity } from "@/hooks/useActivity";
import type { YieldMetric } from "@/components/YieldToggle";

export default function PositionsPage() {
  const { address, isConnected } = useWallet();
  const { positions, loading, refresh } = usePositions(address);
  const { activity } = useActivity(address);
  const { spot } = useSpot("eth");
  const allPositions = useOptimisticPositions(positions);
  const [yieldMetric, setYieldMetric] = useState<YieldMetric>("apr");

  const active = allPositions
    .filter((p) => !p.is_settled)
    .sort((a, b) => new Date(b.indexed_at).getTime() - new Date(a.indexed_at).getTime());
  const history = allPositions.filter((p) => p.is_settled);

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
      {/* Portfolio summary + activity */}
      <PortfolioSummary positions={allPositions} activity={activity} yieldMetric={yieldMetric} onYieldMetricChange={setYieldMetric} />

      {/* Earnings chart */}
      <EarningsChart positions={allPositions} />

      {/* Active positions — cards with sparklines */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
          Active positions
        </h2>
        {active.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {active.map((pos) => (
              <PositionCard
                key={pos.id}
                position={pos}
                onSettled={refresh}
                spot={spot}
                earnBase="/earn/eth"
                optimistic={pos.id.startsWith("opt-")}
                yieldMetric={yieldMetric}
              />
            ))}
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

      {/* Trade log — table */}
      {history.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
            History
          </h2>
          <TradeLog positions={history} earnBase="/earn/eth" />
        </section>
      )}
    </main>
  );
}
