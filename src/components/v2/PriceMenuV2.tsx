"use client";

import { useState, useMemo } from "react";
import { usePrices } from "@/hooks/usePrices";
import { useWallet } from "@/hooks/useWallet";
import { useBalances } from "@/hooks/useBalances";
import { AcceptModal } from "../AcceptModal";
import { LivePrice } from "../LivePrice";
import { OutcomeCards } from "./OutcomeCards";
import type { PriceQuote } from "@/lib/api";

function computeAPR(premium: number, strike: number, expiryDays: number): number {
  return (premium / strike) * (365 / expiryDays) * 100;
}

function untilDate(expiryDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + expiryDays);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function StrikeRow({
  quote,
  side,
  amount,
  spot,
  onSelect,
}: {
  quote: PriceQuote;
  side: "buy" | "sell";
  amount: number;
  spot?: number;
  onSelect: () => void;
}) {
  const apr = computeAPR(quote.premium, quote.strike, quote.expiry_days);
  const disabled = !quote.otoken_address || quote.available_amount <= 0;
  const distance = spot ? Math.abs(quote.strike - spot) / spot * 100 : null;

  // Earnings for the user's chosen amount
  const isBuy = side === "buy";
  const earnings = amount > 0
    ? isBuy
      ? (quote.premium * amount) / quote.strike
      : quote.premium * amount
    : null;

  return (
    <button
      onClick={onSelect}
      disabled={disabled}
      className={`w-full flex items-center justify-between py-4 px-5 transition-all duration-200 text-left group ${
        disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-[var(--surface)]"
      }`}
    >
      <div>
        <span className={`text-base font-semibold text-[var(--text)] ${!disabled ? "group-hover:translate-x-0.5 transition-transform duration-200" : ""} inline-block`}>
          ${quote.strike.toLocaleString()}/ETH
        </span>
        {distance != null && (
          <div className="mt-1 h-1 w-16 rounded-full bg-[var(--border)] overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(100, (distance / 20) * 100)}%`,
                backgroundColor: distance > 10 ? "var(--accent)" : distance > 3 ? "var(--warning, #E5A836)" : "var(--danger)",
              }}
            />
          </div>
        )}
      </div>
      <div className="text-right">
        {earnings != null && earnings > 0 ? (
          <span className="text-base font-bold text-[var(--accent)]">
            Earn ${Math.round(earnings).toLocaleString()}
          </span>
        ) : (
          <span className="text-base font-bold text-[var(--accent)]">
            {Math.round(apr)}% APR
          </span>
        )}
        {earnings != null && earnings > 0 && (
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">{Math.round(apr)}% APR</p>
        )}
      </div>
    </button>
  );
}

export function PriceMenuV2() {
  const { prices, loading, error, refresh } = usePrices();
  const { address } = useWallet();
  const { usd, eth } = useBalances(address);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [selected, setSelected] = useState<{ quote: PriceQuote; side: "buy" | "sell" } | null>(null);
  const [accepted, setAccepted] = useState<{ quote: PriceQuote; side: "buy" | "sell"; amount: number } | null>(null);

  // Amount input — user enters how much they want to commit
  const [amountStr, setAmountStr] = useState("");
  const amount = Number(amountStr) || 0;

  const isBuy = side === "buy";
  const walletBalance = isBuy ? usd : eth;

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
    const abuy = as_ === "buy";
    const premium = abuy ? (aq.premium * aa) / aq.strike : aq.premium * aa;
    const commitLabel = abuy ? `$${aa.toLocaleString()}` : `${aa} ETH`;
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
          <p>{abuy ? "Buy" : "Sell"} ETH at ${aq.strike.toLocaleString()}/ETH</p>
          <p className="text-xs">
            ${Math.round(premium).toLocaleString()}/month · ~${Math.round(premium * 12).toLocaleString()}/yr · {Math.round(apr)}% APR
          </p>
        </div>
        <a
          href="/positions/v2"
          className="block mx-auto max-w-xs rounded-xl bg-[var(--accent)] py-3.5 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] transition-colors"
        >
          View my positions
        </a>
        <button
          onClick={() => { setAccepted(null); refresh(); }}
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
          onClick={() => { setSide("buy"); setAmountStr(""); }}
          className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
            side === "buy"
              ? "bg-[var(--bg)] text-[var(--text)] shadow-sm"
              : "text-[var(--text-secondary)] hover:text-[var(--text)]"
          }`}
        >
          I&apos;d buy
        </button>
        <button
          onClick={() => { setSide("sell"); setAmountStr(""); }}
          className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
            side === "sell"
              ? "bg-[var(--bg)] text-[var(--text)] shadow-sm"
              : "text-[var(--text-secondary)] hover:text-[var(--text)]"
          }`}
        >
          I&apos;d sell
        </button>
      </div>

      {/* Amount input — Rysk-style: amount first, then choose strike */}
      <div className="animate-fade-in-up">
        <p className="text-sm text-[var(--text-secondary)] mb-2">
          How much do you want to commit?
        </p>
        <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          {isBuy && <span className="text-[var(--text-secondary)]">$</span>}
          <input
            type="text"
            inputMode="decimal"
            placeholder={isBuy ? "1,000" : "0.5"}
            value={amountStr}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === "" || /^(0|[1-9]\d*)?\.?\d*$/.test(raw)) {
                setAmountStr(raw);
              }
            }}
            className="flex-1 bg-transparent text-[var(--text)] font-semibold text-base focus:outline-none"
          />
          {!isBuy && <span className="text-sm text-[var(--text-secondary)]">ETH</span>}
          {walletBalance > 0 && (
            <button
              onClick={() => {
                if (isBuy) {
                  setAmountStr(Math.floor(walletBalance).toString());
                } else {
                  setAmountStr(Number(walletBalance.toFixed(4)).toString());
                }
              }}
              className="text-xs font-medium text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
            >
              MAX
            </button>
          )}
        </div>
        <p className="text-xs text-[var(--text-secondary)] mt-1.5">
          Balance: {isBuy
            ? `$${walletBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
            : `${walletBalance.toFixed(2)} ETH`}
        </p>
      </div>

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

      {/* Prompt to enter amount */}
      {amount === 0 && (
        <p className="text-sm text-[var(--text-secondary)] px-1 animate-fade-in-up">
          Enter an amount to see what you&apos;d earn at each price.
        </p>
      )}

      {/* Strike rows — show earnings for YOUR amount */}
      {filteredPrices.length > 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] divide-y divide-[var(--border)] stagger-children animate-fade-in-up">
          {filteredPrices.map((q, i) => (
            <StrikeRow
              key={`${q.strike}-${q.expiry_days}-${i}`}
              quote={q}
              side={side}
              amount={amount}
              spot={spot}
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
          initialAmount={amountStr}
          onClose={() => setSelected(null)}
          onAccepted={({ amount: amt }) => {
            const info = { quote: selected.quote, side: selected.side, amount: amt };
            setSelected(null);
            setAccepted(info);
          }}
          renderExtra={(modalAmount: number) => {
            const q = selected.quote;
            const prem = isBuy
              ? (q.premium * modalAmount) / q.strike
              : q.premium * modalAmount;
            return modalAmount > 0 ? (
              <OutcomeCards
                strike={q.strike}
                premium={prem}
                side={selected.side}
                amount={modalAmount}
              />
            ) : null;
          }}
        />
      )}
    </div>
  );
}
