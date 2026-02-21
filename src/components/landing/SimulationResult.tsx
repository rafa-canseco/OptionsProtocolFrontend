"use client";

import { memo, useState, useCallback, type FormEvent } from "react";
import Link from "next/link";
import type { SimulateResult } from "@/lib/api";

function getSessionId(): string {
  try {
    const key = "b1nary_session_id";
    let id = sessionStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(key, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

function EmailCapture() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (!email || status === "submitting" || status === "done") return;

      setStatus("submitting");

      import("@/lib/api")
        .then(({ api }) =>
          api.trackEvent({
            session_id: getSessionId(),
            event_type: "email_signup",
            data: { email },
          }),
        )
        .then(() => setStatus("done"))
        .catch(() => setStatus("error"));
    },
    [email, status],
  );

  if (status === "done") {
    return (
      <div className="rounded-lg bg-[var(--accent)]/10 border border-[var(--accent)]/20 px-4 py-3 animate-fade-in">
        <p className="text-sm font-medium text-[var(--accent)]">
          You&apos;re in. First report drops Friday.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="email"
          required
          placeholder="you@email.com"
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (status === "error") setStatus("idle"); }}
          className="flex-1 rounded-lg bg-[var(--bg)] border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-secondary)]/50 focus:outline-none focus:border-[var(--accent)] transition-colors"
        />
        <button
          type="submit"
          disabled={status === "submitting"}
          className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--bg)] hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors whitespace-nowrap"
        >
          {status === "submitting" ? "..." : "Send me the recap"}
        </button>
      </form>
      {status === "error" && (
        <p className="text-xs text-[var(--danger)] animate-fade-in">
          Something went wrong. Try again.
        </p>
      )}
    </div>
  );
}

function outcomeNarrative(
  result: SimulateResult,
  strike: number,
  side: "buy" | "sell",
): { headline: string; detail: string } {
  const premium = `$${result.premium_earned.toLocaleString()}`;

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

      {/* Email capture — right after aha-moment, before CTA */}
      <div className="rounded-xl bg-[var(--bg)]/60 border border-[var(--border)] p-4 space-y-2">
        <p className="text-sm text-[var(--text)]">
          See how this plays out every week?
        </p>
        <EmailCapture />
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
