"use client";

import { PositionCard } from "@/components/PositionCard";
import { PositionSparkline } from "@/components/v2/PositionSparkline";
import { useWallet } from "@/hooks/useWallet";
import { usePositions } from "@/hooks/usePositions";
import { usePrices } from "@/hooks/usePrices";
import { usePriceHistory } from "@/hooks/usePriceHistory";
import type { Position } from "@/lib/api";

export default function PositionsV2Page() {
  const { address, isConnected } = useWallet();
  const { positions, loading, refresh } = usePositions(address);
  const { prices } = usePrices();
  const spot = prices[0]?.spot;
  const priceHistory = usePriceHistory(spot);

  // Split into active vs history
  const active = positions.filter((p) => !p.is_settled);
  const history = positions
    .filter((p) => p.is_settled)
    .sort((a, b) => {
      const tA = a.settled_at ? new Date(a.settled_at).getTime() : 0;
      const tB = b.settled_at ? new Date(b.settled_at).getTime() : 0;
      return tB - tA;
    });

  // Portfolio summary
  const totalEarned = positions.reduce((sum, p) => sum + Number(p.net_premium) / 1e6, 0);

  const activeCapital = active.reduce((sum, p) => {
    if (p.is_put) return sum + p.collateral / 1e6;
    return sum + (p.collateral / 1e18) * (p.strike_price / 1e8);
  }, 0);

  const totalCapital = positions.reduce((sum, p) => {
    if (p.is_put) return sum + p.collateral / 1e6;
    return sum + (p.collateral / 1e18) * (p.strike_price / 1e8);
  }, 0);

  const totalWeightedApr = positions.reduce((sum, p) => {
    const capital = p.is_put ? p.collateral / 1e6 : (p.collateral / 1e18) * (p.strike_price / 1e8);
    const premium = Number(p.net_premium) / 1e6;
    const indexedTime = new Date(p.indexed_at).getTime();
    const days = Math.max(1, Math.round((p.expiry * 1000 - indexedTime) / 86_400_000));
    const apr = capital > 0 ? (premium / capital) * (365 / days) * 100 : 0;
    return sum + apr * capital;
  }, 0);
  const avgApr = totalCapital > 0 ? totalWeightedApr / totalCapital : 0;

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
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            to see your positions.
          </p>
        </div>
      </main>
    );
  }

  if (!loading && positions.length === 0) {
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
      <div className="grid grid-cols-3 gap-4 rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-5">
        <div>
          <p className="text-xs text-[var(--text-secondary)]">Total Earned</p>
          <p className="text-xl font-bold text-[var(--accent)]">${totalEarned.toFixed(0)}</p>
        </div>
        <div>
          <p className="text-xs text-[var(--text-secondary)]">Active Capital</p>
          <p className="text-xl font-bold text-[var(--text)]">
            ${activeCapital.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>
        <div>
          <p className="text-xs text-[var(--text-secondary)]">Avg APR</p>
          <p className="text-xl font-bold text-[var(--text)]">{Math.round(avgApr)}%</p>
        </div>
      </div>

      {/* Active positions */}
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

      {/* History */}
      {history.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
            History
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {history.map((pos) => (
              <PositionCard
                key={pos.id}
                position={pos}
                onSettled={refresh}
                spot={spot}
                renderExtra={renderSparkline}
                earnBase="/earn/v2"
              />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
