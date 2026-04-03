"use client";

import { useWallet } from "@/hooks/useWallet";
import { useYield } from "@/hooks/useYield";
import { useSpot } from "@/hooks/useSpot";
import { YieldSummaryCard } from "@/components/yield/YieldSummaryCard";
import { YieldPositionsTable } from "@/components/yield/YieldPositionsTable";
import { DistributionHistory } from "@/components/yield/DistributionHistory";

export default function YieldPage() {
  const { address, isConnected } = useWallet();
  const { summary, positions, history, loading } = useYield(address);
  const { spot: ethSpot } = useSpot("eth");
  const { spot: btcSpot } = useSpot("btc");

  if (!isConnected) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10 space-y-8">
        <h1 className="sr-only">Yield</h1>
        <div className="text-center py-12">
          <p className="text-lg font-semibold text-[var(--text)]">
            Connect your wallet
          </p>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            to see your yield earnings.
          </p>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10 space-y-4">
        <h1 className="sr-only">Yield</h1>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-2xl bg-[var(--surface)]"
          />
        ))}
      </main>
    );
  }

  const hasYield =
    (summary?.assets?.some((a) => a.total > 0) ?? false) ||
    (history?.history?.length ?? 0) > 0;

  if (!hasYield) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10 space-y-8">
        <h1 className="sr-only">Yield</h1>
        <div className="text-center py-12">
          <p className="text-lg font-semibold text-[var(--text)]">
            No yield yet
          </p>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Positions earning Aave yield will appear here.{" "}
            <a
              href="/earn/eth"
              className="text-[var(--accent)] hover:underline"
            >
              Start earning
            </a>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 space-y-6">
      <h1 className="sr-only">Yield</h1>

      <YieldSummaryCard
        assets={summary?.assets ?? []}
        ethSpot={ethSpot}
        btcSpot={btcSpot}
      />

      {positions && positions.positions.length > 0 && (
        <YieldPositionsTable positions={positions.positions} />
      )}

      <DistributionHistory
        history={history?.history ?? []}
        ethSpot={ethSpot}
        btcSpot={btcSpot}
      />
    </main>
  );
}
