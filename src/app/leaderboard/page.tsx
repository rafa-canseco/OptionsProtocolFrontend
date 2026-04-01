"use client";

import { EarningsChallenge } from "@/components/EarningsChallenge";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { useWallet } from "@/hooks/useWallet";
import { useActivity } from "@/hooks/useActivity";

const MIN_COLLATERAL = 500;
const MIN_ACTIVE_DAYS = 8;

function YourProgress({ address, fundingAddress }: { address: string | undefined; fundingAddress: string | null | undefined }) {
  const { activity, loading } = useActivity(address, fundingAddress ?? undefined);

  if (!address) return null;

  const earningRate = activity?.earningRate ?? 0;
  const collateral = activity?.totalCollateralUsd ?? 0;
  const activeDays = activity?.activeDays ?? 0;

  const collateralOk = collateral >= MIN_COLLATERAL;
  const daysOk = activeDays >= MIN_ACTIVE_DAYS;

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-4 space-y-3">
      <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Your progress</p>

      {loading ? (
        <div className="h-8 animate-pulse rounded-xl bg-[var(--surface)]" />
      ) : (
        <div className="flex flex-wrap gap-4 items-center">
          {/* Earning rate — always shown */}
          <div>
            <p className="text-xs text-[var(--text-secondary)]">Earning Rate</p>
            <p className="text-2xl font-bold text-[var(--accent)] font-mono">
              {earningRate > 0 ? `${(earningRate * 100).toFixed(1)}%` : "—"}
            </p>
          </div>

          <div className="flex flex-col gap-1.5 ml-auto">
            {/* $500 check */}
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${collateralOk ? "bg-[var(--accent)]" : "bg-[var(--border)]"}`}
              />
              <span className={`text-xs ${collateralOk ? "text-[var(--accent)]" : "text-[var(--text-secondary)]"}`}>
                ${Math.round(collateral).toLocaleString()} / $500 committed
              </span>
              <InfoTooltip
                title="$500 committed"
                text="Total collateral you've locked across all positions in the competition period must reach $500 to qualify for prizes."
              />
            </div>

            {/* 8 days check */}
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${daysOk ? "bg-[var(--accent)]" : "bg-[var(--border)]"}`}
              />
              <span className={`text-xs ${daysOk ? "text-[var(--accent)]" : "text-[var(--text-secondary)]"}`}>
                {activeDays} / 8 active days
              </span>
              <InfoTooltip
                title="8 active days"
                text="A day counts as active if you have any open position with an expiry after the start of that day. Keep positions open across multiple days to accumulate active days."
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LeaderboardPage() {
  const { address, fundingAddress } = useWallet();

  return (
    <main className="mx-auto max-w-3xl px-6 py-10 space-y-4">
      <h1 className="sr-only">Earnings Challenge Leaderboard</h1>
      <YourProgress address={address} fundingAddress={fundingAddress} />
      <EarningsChallenge address={address} />
    </main>
  );
}
