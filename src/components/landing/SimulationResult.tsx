"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { SimulateResult } from "@/lib/api";

function ComparisonBar({
  label,
  value,
  best,
}: {
  label: string;
  value: number;
  best: boolean;
}) {
  const pct = value * 100;
  const isPositive = pct >= 0;
  const width = Math.min(Math.abs(pct) * 12, 100); // scale for visual
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-[var(--text-secondary)] w-20 text-right shrink-0">{label}</span>
      <div className="flex-1 h-5 bg-[var(--bg)] rounded-full overflow-hidden relative">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${width}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className={`h-full rounded-full ${
            best
              ? "bg-[var(--accent)]"
              : isPositive
                ? "bg-[var(--accent)]/30"
                : "bg-red-500/30"
          }`}
        />
      </div>
      <span
        className={`font-mono text-xs w-16 shrink-0 ${
          best ? "text-[var(--accent)] font-semibold" : "text-[var(--text-secondary)]"
        }`}
      >
        {isPositive ? "+" : ""}
        {pct.toFixed(2)}%
      </span>
    </div>
  );
}

export function SimulationResult({
  result,
  strike,
  side,
  loading,
  weekLabel,
}: {
  result: SimulateResult;
  strike: number;
  side: "buy" | "sell";
  loading: boolean;
  weekLabel: string;
}) {
  // b1nary return: premium / collateral (approximate %)
  const collateral = strike; // $1 per $1 for CSP
  const b1naryReturn = result.premium_earned / collateral;

  const comparisons = [
    { label: "b1nary", value: b1naryReturn },
    { label: "Hold ETH", value: result.comparison.hold_return },
    { label: "Stake", value: result.comparison.stake_return },
    { label: "DCA", value: result.comparison.dca_return },
  ];

  const bestValue = Math.max(...comparisons.map((c) => c.value));

  return (
    <div
      className={`rounded-2xl border border-[var(--border)] bg-[var(--surface)]/60 p-6 sm:p-8 space-y-6 transition-opacity ${
        loading ? "opacity-50" : ""
      }`}
    >
      {/* Week label */}
      <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wider font-mono">
        Week of {weekLabel}
      </p>

      {/* Main result */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <p className="text-[var(--text-secondary)]">
            You chose:{" "}
            <span className="text-[var(--text)] font-medium">
              {side === "buy" ? "Buy" : "Sell"} ETH at ${strike.toLocaleString()}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <p className="text-[var(--text-secondary)]">
            ETH closed at:{" "}
            <span className="text-[var(--text)] font-mono">
              ${result.eth_close.toLocaleString()}
            </span>
          </p>
          {!result.was_assigned && (
            <span className="text-xs text-[var(--text-secondary)] opacity-60">
              (never dropped below ${result.eth_low_of_week.toLocaleString()})
            </span>
          )}
        </div>

        <p className="text-[clamp(1.3rem,3vw,1.8rem)] font-semibold text-[var(--accent)]">
          {result.was_assigned ? (
            <>You bought ETH at ${strike.toLocaleString()} + earned ${result.premium_earned}</>
          ) : (
            <>You would have earned ${result.premium_earned}</>
          )}
        </p>
      </div>

      {/* Comparison bars */}
      <div className="space-y-2 pt-2">
        {comparisons.map((c) => (
          <ComparisonBar
            key={c.label}
            label={c.label}
            value={c.value}
            best={c.value === bestValue}
          />
        ))}
      </div>

      {/* CTA */}
      <div className="pt-2">
        <Link
          href="/earn"
          className="inline-block rounded-xl px-8 py-3 text-sm font-semibold bg-[var(--accent)] text-[var(--bg)] hover:bg-[var(--accent-hover)] transition-colors"
        >
          Try it this week — free simulator, 10 seconds
        </Link>
      </div>
    </div>
  );
}
