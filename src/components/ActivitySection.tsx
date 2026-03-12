"use client";

import { useWallet } from "@/hooks/useWallet";
import { useActivity } from "@/hooks/useActivity";

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="text-lg sm:text-xl font-semibold text-[var(--bone)] font-mono">
        {value}
      </p>
      <p className="text-xs text-[var(--text-secondary)] opacity-60 mt-1">
        {label}
      </p>
    </div>
  );
}

function SkeletonCell() {
  return (
    <div className="text-center space-y-2">
      <div className="h-6 w-16 mx-auto rounded bg-[var(--border)] animate-pulse" />
      <div className="h-3 w-20 mx-auto rounded bg-[var(--border)] animate-pulse" />
    </div>
  );
}

function formatUSD(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

export function ActivitySection() {
  const { address, isConnected } = useWallet();
  const { activity, loading, error } = useActivity(address);

  if (!isConnected) return null;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <h2 className="text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-5">
        Your Activity
      </h2>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonCell key={i} />
          ))}
        </div>
      ) : error || !activity ? (
        <p className="text-sm text-[var(--text-secondary)]">
          No activity yet. Start earning to see your stats here.
        </p>
      ) : activity.positions === 0 ? (
        <p className="text-sm text-[var(--text-secondary)]">
          No activity yet. Start earning to see your stats here.
        </p>
      ) : (
        <div className={`grid grid-cols-2 gap-6 ${
          activity.referrals > 0 ? "sm:grid-cols-6" : "sm:grid-cols-5"
        }`}>
          <StatCell label="Total volume" value={formatUSD(activity.total_volume)} />
          <div className="text-center">
            <p className="text-lg sm:text-xl font-semibold text-[var(--accent)] font-mono">
              {formatUSD(activity.premium_earned)}
            </p>
            <p className="text-xs text-[var(--text-secondary)] opacity-60 mt-1">
              Premium earned
            </p>
          </div>
          <StatCell label="Positions" value={String(activity.positions)} />
          <StatCell label="Active days" value={String(activity.active_days)} />
          <StatCell label="Member since" value={`${activity.days_since_first}d`} />
          {activity.referrals > 0 && (
            <StatCell label="Referrals" value={String(activity.referrals)} />
          )}
        </div>
      )}
    </div>
  );
}
