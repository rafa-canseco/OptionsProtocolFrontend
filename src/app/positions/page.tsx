"use client";

import { PositionCard } from "@/components/PositionCard";
import { PriceMenu } from "@/components/PriceMenu";
import { useWallet } from "@/hooks/useWallet";
import { usePositions } from "@/hooks/usePositions";

export default function PositionsPage() {
  const { address, isConnected } = useWallet();
  const { positions, loading } = usePositions(address);

  const totalEarned = positions
    .filter((p) => p.status === "settled")
    .reduce((sum, p) => sum + p.premium, 0);

  // Rule: no empty states with text. Show price menu instead.
  if (!isConnected || (!loading && positions.length === 0)) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-10 space-y-8">
        <PriceMenu />
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
      {totalEarned > 0 && (
        <div>
          <p className="text-sm text-[var(--text-secondary)]">Total earned</p>
          <p className="text-4xl font-bold text-[var(--accent)]">${totalEarned.toFixed(0)}</p>
        </div>
      )}

      <div className="space-y-3">
        {positions.map((pos) => (
          <PositionCard key={pos.id} position={pos} />
        ))}
      </div>
    </main>
  );
}
