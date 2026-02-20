"use client";

import { useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { usePrices } from "@/hooks/usePrices";
import { AcceptModal } from "./AcceptModal";
import { LivePrice } from "./LivePrice";
import type { PriceQuote } from "@/lib/api";

function computeAPR(premium: number, strike: number, expiryDays: number): number {
  return (premium / strike) * (365 / expiryDays) * 100;
}

function untilDate(expiryDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + expiryDays);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function PriceRow({
  quote,
  onSelect,
}: {
  quote: PriceQuote;
  onSelect: () => void;
}) {
  const apr = computeAPR(quote.premium, quote.strike, quote.expiry_days);
  const disabled = !quote.otoken_address || quote.available_amount <= 0;

  return (
    <button
      onClick={onSelect}
      disabled={disabled}
      className={`w-full flex items-center justify-between py-4 px-5 transition-all duration-200 text-left group ${
        disabled
          ? "opacity-40 cursor-not-allowed"
          : "hover:bg-[var(--surface)]"
      }`}
    >
      <span className={`text-base font-semibold text-[var(--text)] ${!disabled ? "group-hover:translate-x-0.5 transition-transform duration-200" : ""} inline-block`}>
        ${quote.strike.toLocaleString()}/ETH
      </span>
      <span className="text-base font-bold text-[var(--accent)]">
        {Math.round(apr)}% APR
      </span>
    </button>
  );
}

export function PriceMenu() {
  const { prices, loading, error, refresh } = usePrices();
  const searchParams = useSearchParams();
  const initialSide = searchParams.get("side") === "sell" ? "sell" : "buy";
  const [side, setSide] = useState<"buy" | "sell">(initialSide);
  const [selected, setSelected] = useState<{ quote: PriceQuote; side: "buy" | "sell" } | null>(null);
  const [accepted, setAccepted] = useState<{ quote: PriceQuote; side: "buy" | "sell"; amount: number } | null>(null);

  const expiries = useMemo(() => {
    const unique = [...new Set(prices.map((p) => p.expiry_days))].sort((a, b) => a - b);
    return unique;
  }, [prices]);

  const [selectedExpiry, setSelectedExpiry] = useState<number | null>(null);
  const activeExpiry = selectedExpiry ?? expiries[0] ?? null;

  const spot = prices[0]?.spot;

  const filteredPrices = useMemo(() => {
    const s = prices[0]?.spot;
    return prices
      .filter(
        (p) =>
          p.option_type === (side === "buy" ? "put" : "call") &&
          p.expiry_days === activeExpiry &&
          (side === "buy" ? p.strike < (s ?? Infinity) : p.strike > (s ?? -Infinity))
      )
      .sort((a, b) => a.strike - b.strike);
  }, [prices, side, activeExpiry]);

  const explanationText =
    side === "buy"
      ? "Choose the price you'd buy at. You get paid upfront and keep the earnings no matter what."
      : "Choose the price you'd sell at. You get paid upfront and keep the earnings no matter what.";

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-14 w-48 animate-pulse rounded-xl bg-[var(--surface)]" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-xl bg-[var(--surface)]" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl bg-[var(--surface)] p-5 text-sm text-[var(--text-secondary)] text-center">
        Could not load prices. Is the backend running?
      </div>
    );
  }

  if (accepted) {
    const { quote: aq, side: as_, amount: aa } = accepted;
    const isBuy = as_ === "buy";
    const premium = isBuy
      ? (aq.premium * aa) / aq.strike
      : aq.premium * aa;
    const commitLabel = isBuy ? `$${aa.toLocaleString()}` : `${aa} ETH`;
    const apr = computeAPR(aq.premium, aq.strike, aq.expiry_days);

    return (
      <div className="text-center space-y-5 py-10 animate-fade-in-up">
        <p className="text-3xl font-bold text-[var(--accent)]">
          ${Math.round(premium).toLocaleString()} earned
        </p>
        <p className="text-base text-[var(--text)]">
          Yours to keep, no matter what happens.
        </p>

        <div className="h-px bg-[var(--border)]" />

        <div className="space-y-2 text-sm text-[var(--text-secondary)]">
          <p>{commitLabel} committed for {aq.expiry_days} days</p>
          <p>{isBuy ? "Buy" : "Sell"} ETH at ${aq.strike.toLocaleString()}/ETH</p>
          <p className="text-xs">
            ${Math.round(premium).toLocaleString()}/month · ~${Math.round(premium * 12).toLocaleString()}/yr · {Math.round(apr)}% APR
          </p>
        </div>

        <a
          href="/positions"
          className="block mx-auto max-w-xs rounded-xl bg-[var(--accent)] py-3.5 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] transition-colors"
        >
          View my positions
        </a>
        <button
          onClick={() => {
            setAccepted(null);
            refresh();
          }}
          className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors"
        >
          Accept another price
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <LivePrice spot={spot} className="animate-fade-in-up" />

      {/* Buy / Sell toggle */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1 flex animate-fade-in-up">
        <button
          onClick={() => setSide("buy")}
          className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
            side === "buy"
              ? "bg-[var(--bg)] text-[var(--text)] shadow-sm"
              : "text-[var(--text-secondary)] hover:text-[var(--text)]"
          }`}
        >
          I&apos;d buy
        </button>
        <button
          onClick={() => setSide("sell")}
          className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
            side === "sell"
              ? "bg-[var(--bg)] text-[var(--text)] shadow-sm"
              : "text-[var(--text-secondary)] hover:text-[var(--text)]"
          }`}
        >
          I&apos;d sell
        </button>
      </div>

      {/* Explanation text */}
      <p className="text-sm text-[var(--text-secondary)] px-1 animate-fade-in-up">
        {explanationText}
      </p>

      {/* Date selector */}
      {expiries.length > 0 && (
        <div className="animate-fade-in-up">
          <select
            value={activeExpiry ?? ""}
            onChange={(e) => setSelectedExpiry(Number(e.target.value))}
            className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent)] transition-colors"
          >
            {expiries.map((days) => (
              <option key={days} value={days}>
                Until {untilDate(days)} ({days}d)
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Price rows */}
      {filteredPrices.length > 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] divide-y divide-[var(--border)] stagger-children animate-fade-in-up">
          {filteredPrices.map((q, i) => (
            <PriceRow
              key={`${q.strike}-${q.expiry_days}-${i}`}
              quote={q}
              onSelect={() => setSelected({ quote: q, side })}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl bg-[var(--surface)] p-5 text-sm text-[var(--text-secondary)] text-center">
          No prices available for this date.
        </div>
      )}

      {selected && (
        <AcceptModal
          quote={selected.quote}
          side={selected.side}
          onClose={() => setSelected(null)}
          onAccepted={({ amount: amt }) => {
            const info = { quote: selected.quote, side: selected.side, amount: amt };
            setSelected(null);
            setAccepted(info);
          }}
        />
      )}
    </div>
  );
}
