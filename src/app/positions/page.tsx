"use client";

import { PositionCard } from "@/components/PositionCard";
import { useWallet } from "@/hooks/useWallet";
import { usePositions } from "@/hooks/usePositions";

export default function PositionsPage() {
  const { address, isConnected } = useWallet();
  const { positions, loading, refresh } = usePositions(address);

  // Portfolio summary
  const totalEarned = positions.reduce((sum, p) => sum + Number(p.net_premium) / 1e6, 0);

  const activeCapital = positions
    .filter((p) => !p.is_settled)
    .reduce((sum, p) => {
      // Puts: LUSD (6 dec), Calls: LETH (18 dec) converted to USD
      if (p.is_put) return sum + p.collateral / 1e6;
      return sum + (p.collateral / 1e18) * (p.strike_price / 1e8);
    }, 0);

  const totalCapital = positions.reduce((sum, p) => {
    if (p.is_put) return sum + p.collateral / 1e6;
    return sum + (p.collateral / 1e18) * (p.strike_price / 1e8);
  }, 0);

  // Weighted average APR across all positions
  const totalWeightedApr = positions.reduce((sum, p) => {
    const capital = p.is_put ? p.collateral / 1e6 : (p.collateral / 1e18) * (p.strike_price / 1e8);
    const premium = Number(p.net_premium) / 1e6;
    const indexedTime = new Date(p.indexed_at).getTime();
    const days = Math.max(1, Math.round((p.expiry * 1000 - indexedTime) / 86_400_000));
    const apr = capital > 0 ? (premium / capital) * (365 / days) * 100 : 0;
    return sum + apr * capital;
  }, 0);
  const avgApr = totalCapital > 0 ? totalWeightedApr / totalCapital : 0;

  if (!isConnected) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-10 space-y-8">
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
      <main className="mx-auto max-w-2xl px-6 py-10 space-y-6">
        <div className="text-center py-12">
          <p className="text-lg font-semibold text-[var(--text)]">No positions yet</p>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Accept a price on the <a href="/earn" className="text-[var(--accent)] hover:underline">Earn</a> page to get started.
          </p>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-10 space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-[var(--surface)]" />
        ))}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10 space-y-6">
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

      {/* Position cards */}
      <div className="space-y-3">
        {positions.map((pos) => (
          <PositionCard key={pos.id} position={pos} onSettled={refresh} />
        ))}
      </div>
    </main>
  );
}
