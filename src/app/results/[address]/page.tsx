"use client";

import { use } from "react";
import Link from "next/link";
import { useUserResults } from "@/hooks/useUserResults";
import { useWeeklyReport } from "@/hooks/useWeeklyReport";
import { ShareButton } from "@/components/results/ShareButton";

function formatDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function pctChange(open: number, close: number) {
  if (!open) return 0;
  return ((close - open) / open) * 100;
}

/* ── Empty state ── */
function NoResults({ address }: { address: string }) {
  return (
    <main className="mx-auto max-w-lg px-6 py-20 text-center space-y-6">
      <div className="space-y-3">
        <p className="text-2xl font-bold text-[var(--bone)] tracking-tight">
          No results for {shortAddr(address)}
        </p>
        <p className="text-[var(--text-secondary)] leading-relaxed">
          This address hasn&apos;t participated in any weekly round yet. Try the
          simulator and your results will show up here next week.
        </p>
      </div>
      <Link
        href="/try"
        className="inline-block rounded-full bg-[var(--accent)] px-8 py-3 text-sm font-semibold text-[var(--bg)] hover:bg-[var(--accent-hover)] transition-colors"
      >
        Try the simulator
      </Link>
    </main>
  );
}

/* ── Loading ── */
function Loading() {
  return (
    <main className="mx-auto max-w-lg px-6 py-20">
      <div className="h-[420px] animate-pulse rounded-3xl bg-[var(--surface)]" />
    </main>
  );
}

export default function PersonalResultPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = use(params);
  const { weeklyResult, stats, loading } = useUserResults(address);
  const { report } = useWeeklyReport();

  if (loading) return <Loading />;
  if (!weeklyResult && !stats) return <NoResults address={address} />;

  const ethPct = report ? pctChange(report.eth_open, report.eth_close) : null;

  return (
    <main className="mx-auto max-w-lg px-6 py-12 space-y-8 animate-fade-in">
      {/* ── Shareable card — screenshot-optimized ── */}
      <div
        className="rounded-3xl border border-[var(--border)] bg-gradient-to-br from-[var(--surface)] to-[var(--bg)] p-8 space-y-6"
        style={{ minHeight: 380 }}
      >
        {/* Brand */}
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold tracking-tight text-[var(--bone)] font-mono">
            b<span className="text-[var(--accent)]">1</span>nary simulator
          </p>
          {weeklyResult && (
            <p className="text-xs text-[var(--text-secondary)]">
              Week of {formatDate(weeklyResult.week_start)}–
              {formatDate(weeklyResult.week_end)}
            </p>
          )}
        </div>

        {/* Main result */}
        {weeklyResult && (
          <div className="space-y-4">
            <div>
              <p className="text-xs text-[var(--text-secondary)] mb-1">
                Result this week
              </p>
              <p
                className={`text-4xl font-bold font-mono tracking-tight ${weeklyResult.simulated_pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}
              >
                {weeklyResult.simulated_pnl >= 0 ? "+" : ""}$
                {weeklyResult.simulated_pnl.toFixed(0)}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-[var(--text-secondary)]">
                  Premium earned
                </p>
                <p className="text-lg font-bold font-mono text-[var(--accent)]">
                  ${weeklyResult.total_simulated_premium.toFixed(0)}
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-secondary)]">
                  Positions
                </p>
                <p className="text-lg font-bold font-mono text-[var(--text)]">
                  {weeklyResult.positions_opened}
                </p>
              </div>
            </div>

            {/* Comparison */}
            {ethPct !== null && (
              <div className="flex items-center gap-3 pt-2 border-t border-[var(--border)]">
                <div className="flex-1">
                  <p className="text-xs text-[var(--text-secondary)]">ETH</p>
                  <p
                    className={`text-sm font-bold font-mono ${ethPct >= 0 ? "text-emerald-400" : "text-red-400"}`}
                  >
                    {ethPct >= 0 ? "+" : ""}
                    {ethPct.toFixed(2)}%
                  </p>
                </div>
                <div className="w-px h-8 bg-[var(--border)]" />
                <div className="flex-1">
                  <p className="text-xs text-[var(--text-secondary)]">Me</p>
                  <p
                    className={`text-sm font-bold font-mono ${weeklyResult.simulated_pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}
                  >
                    {weeklyResult.simulated_pnl >= 0 ? "+" : ""}$
                    {weeklyResult.simulated_pnl.toFixed(0)}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Cumulative stats */}
        {stats && (
          <div className="pt-4 border-t border-[var(--border)] grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-[var(--text-secondary)]">
                Weeks active
              </p>
              <p className="text-lg font-bold font-mono text-[var(--text)]">
                {stats.weeks_active}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-secondary)]">
                Total earned
              </p>
              <p className="text-lg font-bold font-mono text-[var(--accent)]">
                ${stats.total_premium_earned.toFixed(0)}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-secondary)]">Best week</p>
              <p className="text-lg font-bold font-mono text-emerald-400">
                +${stats.best_week_pnl.toFixed(0)}
              </p>
            </div>
          </div>
        )}

        {/* Branding footer */}
        <p className="text-xs text-[var(--text-secondary)] text-center pt-2 font-mono">
          try.b1nary.xyz
        </p>
      </div>

      {/* ── Actions ── */}
      <div className="flex items-center justify-center gap-3">
        <ShareButton
          premiumEarned={weeklyResult?.total_simulated_premium}
          wasAssigned={
            weeklyResult ? weeklyResult.assignments > 0 : undefined
          }
        />
        <Link
          href="/results"
          className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
        >
          Weekly report
        </Link>
      </div>

      {/* ── CTA ── */}
      <div className="text-center pt-4">
        <Link
          href="/try"
          className="rounded-full bg-[var(--accent)] px-8 py-3 text-sm font-semibold text-[var(--bg)] hover:bg-[var(--accent-hover)] transition-colors"
        >
          Try the simulator
        </Link>
      </div>
    </main>
  );
}
