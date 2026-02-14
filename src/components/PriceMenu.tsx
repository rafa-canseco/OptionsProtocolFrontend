"use client";

import { useState, useEffect } from "react";
import { usePrices } from "@/hooks/usePrices";
import { AcceptButton } from "./AcceptButton";
import type { PriceQuote } from "@/lib/api";

function TTLBadge({ expiresAt }: { expiresAt: number }) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, expiresAt - Date.now() / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  if (remaining <= 0) return <span className="text-xs text-[var(--danger)]">EXPIRED</span>;
  return <span className="text-xs text-[var(--muted)]">{Math.ceil(remaining)}s</span>;
}

function PriceRow({ quote }: { quote: PriceQuote }) {
  const isCall = quote.option_type === "call";

  return (
    <div className="flex items-center gap-4 rounded-lg border border-[var(--card-border)] bg-[var(--card)] p-4">
      <span
        className={`rounded px-2 py-0.5 text-xs font-bold uppercase ${
          isCall ? "bg-green-900/50 text-green-400" : "bg-red-900/50 text-red-400"
        }`}
      >
        {quote.option_type}
      </span>

      <div className="flex-1 grid grid-cols-5 gap-2 text-sm">
        <div>
          <p className="text-[var(--muted)] text-xs">Strike</p>
          <p className="font-mono">${quote.strike.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[var(--muted)] text-xs">Premium</p>
          <p className="font-mono">${quote.premium.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-[var(--muted)] text-xs">Delta</p>
          <p className="font-mono">{quote.delta.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-[var(--muted)] text-xs">IV</p>
          <p className="font-mono">{(quote.iv * 100).toFixed(1)}%</p>
        </div>
        <div>
          <p className="text-[var(--muted)] text-xs">Expiry</p>
          <p className="font-mono">{quote.expiry_days}d</p>
        </div>
      </div>

      <TTLBadge expiresAt={quote.expires_at} />
      <AcceptButton quote={quote} />
    </div>
  );
}

export function PriceMenu() {
  const { prices, loading, error } = usePrices();
  const [filter, setFilter] = useState<"all" | "call" | "put">("all");

  const filtered = filter === "all" ? prices : prices.filter((p) => p.option_type === filter);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-[var(--card)]" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-[var(--danger)] bg-red-900/20 p-4 text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Price Menu</h2>
        <div className="flex gap-1 rounded-lg border border-[var(--card-border)] p-1">
          {(["all", "call", "put"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1 text-sm capitalize ${
                filter === f ? "bg-[var(--card)] text-white" : "text-[var(--muted)]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No prices available</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((quote, i) => (
            <PriceRow key={`${quote.option_type}-${quote.strike}-${quote.expiry_days}-${i}`} quote={quote} />
          ))}
        </div>
      )}
    </div>
  );
}
