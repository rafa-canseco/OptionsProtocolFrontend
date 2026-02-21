"use client";

import Link from "next/link";
import { useWeeklyReport } from "@/hooks/useWeeklyReport";
import { useUserResults } from "@/hooks/useUserResults";
import { useWallet } from "@/hooks/useWallet";
import { ShareButton } from "@/components/results/ShareButton";

function formatDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function pctChange(open: number, close: number) {
  if (!open) return 0;
  return ((close - open) / open) * 100;
}

function assignmentRate(assignments: number, total: number) {
  if (!total) return 0;
  return (assignments / total) * 100;
}

function avgReturn(totalPremium: number, totalPositions: number) {
  if (!totalPositions) return 0;
  return totalPremium / totalPositions;
}

/* ── Narrative card for highlighted stories ── */
function NarrativeCard({
  title,
  description,
  accent,
}: {
  title: string;
  description: string;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-2">
      <p
        className="text-xs font-semibold uppercase tracking-wider"
        style={{ color: accent || "var(--accent)" }}
      >
        {title}
      </p>
      <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
        {description}
      </p>
    </div>
  );
}

/* ── Empty state when no report exists yet ── */
function EmptyState() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-20 text-center space-y-6">
      <div className="space-y-3">
        <p className="text-4xl font-bold text-[var(--bone)] tracking-tight">
          No results yet
        </p>
        <p className="text-lg text-[var(--text-secondary)] max-w-md mx-auto leading-relaxed">
          The first weekly report drops when the current week ends.
          Set your price now and your results will appear here.
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

/* ── Loading skeleton ── */
function LoadingSkeleton() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 space-y-8">
      <div className="h-10 w-64 animate-pulse rounded-xl bg-[var(--surface)]" />
      <div className="h-6 w-96 animate-pulse rounded-lg bg-[var(--surface)]" />
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-2xl bg-[var(--surface)]"
          />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-32 animate-pulse rounded-2xl bg-[var(--surface)]"
          />
        ))}
      </div>
    </main>
  );
}

export default function ResultsPage() {
  const { report, loading } = useWeeklyReport();
  const { address } = useWallet();
  const { weeklyResult, stats } = useUserResults(address);

  if (loading) return <LoadingSkeleton />;
  if (!report) return <EmptyState />;

  const ethChange = pctChange(report.eth_open, report.eth_close);
  const aRate = assignmentRate(report.total_assignments, report.total_positions);
  const avgRet = avgReturn(report.total_simulated_premium, report.total_positions);

  // Parse narrative stories from backend
  const narratives = report.narrative_data as Record<
    string,
    { title?: string; description?: string } | undefined
  >;
  const stories = [
    {
      key: "highest_premium",
      fallbackTitle: "Highest premium",
      accent: "var(--accent)",
    },
    {
      key: "closest_call",
      fallbackTitle: "Closest call",
      accent: "#F59E0B",
    },
    {
      key: "most_conservative",
      fallbackTitle: "Most conservative",
      accent: "var(--bone)",
    },
  ];

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 space-y-12 animate-fade-in">
      {/* ── Header ── */}
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
          Weekly Report
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold text-[var(--bone)] tracking-tight leading-tight">
          Week of {formatDate(report.week_start)}–{formatDate(report.week_end)}
        </h1>
        <p className="text-lg text-[var(--text-secondary)] leading-relaxed">
          {report.total_users} user{report.total_users !== 1 ? "s" : ""} set
          their price{report.total_users !== 1 ? "s" : ""}. ETH moved from{" "}
          <span className="font-mono text-[var(--text)]">
            ${report.eth_open.toLocaleString()}
          </span>{" "}
          to{" "}
          <span className="font-mono text-[var(--text)]">
            ${report.eth_close.toLocaleString()}
          </span>
          .
        </p>
      </header>

      {/* ── Aggregate stats ── */}
      <section className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <p className="text-xs text-[var(--text-secondary)] mb-1">
            Total premium earned
          </p>
          <p className="text-2xl font-bold text-[var(--accent)] font-mono">
            ${report.total_simulated_premium.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
          <p className="text-xs text-[var(--text-secondary)] mt-1">simulated</p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <p className="text-xs text-[var(--text-secondary)] mb-1">
            Assignment rate
          </p>
          <p className="text-2xl font-bold text-[var(--bone)] font-mono">
            {aRate.toFixed(1)}%
          </p>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            {report.total_assignments} of {report.total_positions} positions
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <p className="text-xs text-[var(--text-secondary)] mb-1">
            Avg premium / position
          </p>
          <p className="text-2xl font-bold text-[var(--accent)] font-mono">
            ${avgRet.toFixed(0)}
          </p>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            across {report.total_positions} trades
          </p>
        </div>
      </section>

      {/* ── ETH performance bar ── */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-[var(--text-secondary)] mb-1">
              ETH this week
            </p>
            <p className="text-lg font-bold font-mono text-[var(--bone)]">
              ${report.eth_open.toLocaleString()} → $
              {report.eth_close.toLocaleString()}
            </p>
          </div>
          <div
            className={`text-2xl font-bold font-mono ${ethChange >= 0 ? "text-emerald-400" : "text-red-400"}`}
          >
            {ethChange >= 0 ? "+" : ""}
            {ethChange.toFixed(2)}%
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3 text-xs text-[var(--text-secondary)]">
          <span>
            Low:{" "}
            <span className="font-mono text-[var(--text)]">
              ${report.eth_low.toLocaleString()}
            </span>
          </span>
          <span className="opacity-40">|</span>
          <span>
            High:{" "}
            <span className="font-mono text-[var(--text)]">
              ${report.eth_high.toLocaleString()}
            </span>
          </span>
        </div>
      </section>

      {/* ── Narrative stories ── */}
      {Object.keys(narratives).length > 0 && (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
            Highlights
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {stories.map((s) => {
              const data = narratives[s.key];
              if (!data?.description) return null;
              return (
                <NarrativeCard
                  key={s.key}
                  title={data.title || s.fallbackTitle}
                  description={data.description}
                  accent={s.accent}
                />
              );
            })}
          </div>
        </section>
      )}

      {/* ── Your result (if connected) ── */}
      {address && weeklyResult && (
        <section className="rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--accent)] uppercase tracking-wider">
              Your week
            </h2>
            <ShareButton
              strike={undefined}
              premiumEarned={weeklyResult.total_simulated_premium}
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-[var(--text-secondary)]">Positions</p>
              <p className="text-xl font-bold font-mono text-[var(--text)]">
                {weeklyResult.positions_opened}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-secondary)]">
                Premium earned
              </p>
              <p className="text-xl font-bold font-mono text-[var(--accent)]">
                ${weeklyResult.total_simulated_premium.toFixed(0)}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-secondary)]">Week P&L</p>
              <p
                className={`text-xl font-bold font-mono ${weeklyResult.simulated_pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}
              >
                {weeklyResult.simulated_pnl >= 0 ? "+" : ""}$
                {weeklyResult.simulated_pnl.toFixed(0)}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-secondary)]">
                Weeks active
              </p>
              <p className="text-xl font-bold font-mono text-[var(--text)]">
                {stats?.weeks_active ?? "—"}
              </p>
            </div>
          </div>
          <Link
            href={`/results/${address}`}
            className="inline-block text-sm text-[var(--accent)] hover:underline"
          >
            View your shareable card →
          </Link>
        </section>
      )}

      {/* ── CTA ── */}
      <section className="text-center space-y-4 pt-4 pb-8">
        <p className="text-lg text-[var(--text-secondary)]">
          Think you can beat the market?
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/try"
            className="rounded-full bg-[var(--accent)] px-8 py-3 text-sm font-semibold text-[var(--bg)] hover:bg-[var(--accent-hover)] transition-colors"
          >
            Try the simulator
          </Link>
          <Link
            href="/earn/v2"
            className="rounded-full border border-[var(--border)] px-8 py-3 text-sm font-medium text-[var(--text)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
          >
            Start earning
          </Link>
        </div>
      </section>
    </main>
  );
}
