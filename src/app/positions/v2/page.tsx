"use client";

import Link from "next/link";
import { PositionCard } from "@/components/PositionCard";
import { PositionSparkline } from "@/components/v2/PositionSparkline";
import { PortfolioSummary } from "@/components/PortfolioSummary";
import { TradeLog } from "@/components/TradeLog";
import { ShareButton } from "@/components/results/ShareButton";
import { useWallet } from "@/hooks/useWallet";
import { usePositions } from "@/hooks/usePositions";
import { usePrices } from "@/hooks/usePrices";
import { usePriceHistory } from "@/hooks/usePriceHistory";
import { useOptimisticPositions } from "@/hooks/useOptimisticPositions";
import { useUserResults } from "@/hooks/useUserResults";
import type { Position } from "@/lib/api";

export default function PositionsV2Page() {
  const { address, isConnected } = useWallet();
  const { positions, loading, refresh } = usePositions(address);
  const { prices } = usePrices();
  const spot = prices[0]?.spot;
  const priceHistory = usePriceHistory(spot);
  const allPositions = useOptimisticPositions(positions);
  const { stats, weeklyResult } = useUserResults(address);

  const active = allPositions
    .filter((p) => !p.is_settled)
    .sort((a, b) => new Date(b.indexed_at).getTime() - new Date(a.indexed_at).getTime());
  const history = allPositions.filter((p) => p.is_settled);

  function renderSparkline(position: Position, strike: number) {
    if (position.is_settled) return null;
    return (
      <PositionSparkline
        priceHistory={priceHistory}
        strike={strike}
        isPut={position.is_put}
      />
    );
  }

  if (!isConnected) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10 space-y-8">
        <div className="text-center py-12">
          <p className="text-lg font-semibold text-[var(--text)]">Connect your wallet</p>
          <p className="text-sm text-[var(--text-secondary)] mt-1">to see your positions.</p>
        </div>
      </main>
    );
  }

  if (!loading && allPositions.length === 0) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10 space-y-6">
        <div className="text-center py-12">
          <p className="text-lg font-semibold text-[var(--text)]">No positions yet</p>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Accept a price on the <a href="/earn/v2" className="text-[var(--accent)] hover:underline">Earn</a> page to get started.
          </p>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10 space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-[var(--surface)]" />
        ))}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 space-y-8">
      {/* Portfolio summary */}
      <PortfolioSummary positions={allPositions} />

      {/* Simulated track record */}
      {stats && (
        <section className="rounded-2xl border border-[var(--accent)]/20 bg-[var(--accent)]/5 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--accent)] uppercase tracking-wider">
              Simulator track record
            </h2>
            <div className="flex items-center gap-2">
              <ShareButton
                premiumEarned={weeklyResult?.total_simulated_premium}
                className="text-xs px-3 py-1.5"
              />
              <Link
                href={`/results/${address}`}
                className="text-xs text-[var(--accent)] hover:underline"
              >
                View card →
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-[var(--text-secondary)]">Cumulative P&L</p>
              <p className={`text-xl font-bold font-mono ${stats.cumulative_pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {stats.cumulative_pnl >= 0 ? "+" : ""}${stats.cumulative_pnl.toFixed(0)}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-secondary)]">Total premium</p>
              <p className="text-xl font-bold font-mono text-[var(--accent)]">
                ${stats.total_premium_earned.toFixed(0)}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-secondary)]">Weeks active</p>
              <p className="text-xl font-bold font-mono text-[var(--text)]">
                {stats.weeks_active}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-secondary)]">Best week</p>
              <p className="text-xl font-bold font-mono text-emerald-400">
                +${stats.best_week_pnl.toFixed(0)}
              </p>
            </div>
          </div>
          <p className="text-xs text-[var(--text-secondary)] italic">
            If this were real money, you&apos;d have earned ${stats.total_premium_earned.toFixed(0)} in premium.
          </p>
        </section>
      )}

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
                renderExtra={renderSparkline}
                earnBase="/earn/v2"
                optimistic={pos.id.startsWith("opt-")}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[var(--border)] p-6 text-center">
            <p className="text-sm text-[var(--text-secondary)]">
              No active positions.{" "}
              <a href="/earn/v2" className="text-[var(--accent)] hover:underline">Earn premium</a> by setting your price.
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
          <TradeLog positions={history} earnBase="/earn/v2" />
        </section>
      )}
    </main>
  );
}
