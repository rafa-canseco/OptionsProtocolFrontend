"use client";

import { memo } from "react";
import Link from "next/link";
import type { SimulateResult } from "@/lib/api";

function outcomeNarrative(
  result: SimulateResult,
  strike: number,
  side: "buy" | "sell",
): { headline: string; detail: string } {
  const premium = `$${result.premium_earned}`;

  if (side === "buy") {
    if (result.was_assigned) {
      return {
        headline: `ETH dropped below $${strike.toLocaleString()}.`,
        detail: `You bought at your price + already earned ${premium}.`,
      };
    }
    return {
      headline: `ETH never dropped to $${strike.toLocaleString()}.`,
      detail: `You kept your $${strike.toLocaleString()} + earned ${premium}.`,
    };
  }

  // sell
  if (result.was_assigned) {
    return {
      headline: `ETH passed $${strike.toLocaleString()}.`,
      detail: `You sold at your price + earned ${premium}.`,
    };
  }
  return {
    headline: `ETH never reached $${strike.toLocaleString()}.`,
    detail: `You kept your ETH + earned ${premium}.`,
  };
}

export const SimulationResult = memo(function SimulationResult({
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
  const { headline, detail } = outcomeNarrative(result, strike, side);

  return (
    <div
      className={`rounded-2xl border border-[var(--border)] bg-[var(--surface)]/60 p-6 sm:p-8 space-y-6 transition-opacity duration-200 ${
        loading ? "opacity-50" : ""
      }`}
    >
      {/* Week label */}
      <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wider font-mono">
        Week of {weekLabel}
      </p>

      {/* Context */}
      <div className="space-y-1">
        <p className="text-[var(--text-secondary)]">
          You chose:{" "}
          <span className="text-[var(--text)] font-medium">
            {side === "buy" ? "Buy" : "Sell"} ETH at ${strike.toLocaleString()}
          </span>
        </p>
        <p className="text-[var(--text-secondary)]">
          ETH closed at:{" "}
          <span className="text-[var(--text)] font-mono">
            ${result.eth_close.toLocaleString()}
          </span>
        </p>
      </div>

      {/* Outcome card */}
      <div className="rounded-xl border border-[var(--accent)]/15 bg-[var(--accent)]/5 p-5 space-y-2">
        <p className="text-[clamp(1.1rem,2.5vw,1.4rem)] text-[var(--text)] font-medium">
          {headline}
        </p>
        <p className="text-[clamp(1.2rem,3vw,1.6rem)] font-semibold text-[var(--accent)]">
          {detail}
        </p>
      </div>

      {/* CTA */}
      <div className="pt-2">
        <Link
          href="/"
          className="inline-block rounded-xl px-8 py-3 text-sm font-semibold bg-[var(--accent)] text-[var(--bg)] hover:bg-[var(--accent-hover)] transition-colors"
        >
          Learn how it works
        </Link>
      </div>
    </div>
  );
});
