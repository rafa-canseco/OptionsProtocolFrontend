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

/** Horizontal price axis showing spot vs all available strikes */
function StrikeChart({
  filteredPrices,
  spot,
  side,
  amount,
  onSelect,
}: {
  filteredPrices: PriceQuote[];
  spot: number;
  side: "buy" | "sell";
  amount: number;
  onSelect: (q: PriceQuote) => void;
}) {
  if (filteredPrices.length === 0) return null;

  const strikes = filteredPrices.map((p) => p.strike);
  const all = [...strikes, spot];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const range = max - min || 1;
  const padded = range * 0.12;
  const xMin = min - padded;
  const xMax = max + padded;
  const xRange = xMax - xMin;

  const W = 360;
  const H = 110;
  const PAD_L = 8;
  const PAD_R = 8;
  const plotW = W - PAD_L - PAD_R;
  const AXIS_Y = 55;

  const toX = (price: number) => PAD_L + ((price - xMin) / xRange) * plotW;
  const spotX = toX(spot);

  const isBuy = side === "buy";

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-4 animate-fade-in-up">
      <p className="text-xs text-[var(--text-secondary)] mb-2">
        Choose a strike price — {isBuy ? "further below" : "further above"} spot = safer, less premium
      </p>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Price axis */}
        <line
          x1={PAD_L} y1={AXIS_Y} x2={W - PAD_R} y2={AXIS_Y}
          stroke="var(--border)" strokeWidth={1}
        />

        {/* Strike markers */}
        {filteredPrices.map((q) => {
          const x = toX(q.strike);
          const apr = Math.round(computeAPR(q.premium, q.strike, q.expiry_days));
          const disabled = !q.otoken_address || q.available_amount <= 0;
          const earnings = amount > 0
            ? isBuy ? (q.premium * amount) / q.strike : q.premium * amount
            : 0;

          return (
            <g
              key={q.strike}
              onClick={() => !disabled && onSelect(q)}
              style={{ cursor: disabled ? "not-allowed" : "pointer" }}
              opacity={disabled ? 0.3 : 1}
            >
              {/* Clickable hit area */}
              <rect x={x - 20} y={8} width={40} height={80} fill="transparent" />
              {/* Strike tick */}
              <line
                x1={x} y1={AXIS_Y - 10} x2={x} y2={AXIS_Y + 10}
                stroke="var(--accent)" strokeWidth={2}
              />
              {/* Earnings label above (only when amount entered) */}
              {earnings > 0 && (
                <text
                  x={x} y={AXIS_Y - 16}
                  textAnchor="middle" fill="var(--accent)"
                  fontSize={11} fontWeight={600}
                >
                  ${Math.round(earnings).toLocaleString()}
                </text>
              )}
              {/* Strike price below */}
              <text
                x={x} y={AXIS_Y + 24}
                textAnchor="middle" fill="var(--text-secondary)"
                fontSize={9}
              >
                ${q.strike.toLocaleString()}
              </text>
            </g>
          );
        })}

        {/* Spot marker — vertical line + labels above axis */}
        <line
          x1={spotX} y1={AXIS_Y - 28} x2={spotX} y2={AXIS_Y + 4}
          stroke="var(--text)" strokeWidth={1.5} strokeDasharray="3 2"
        />
        <circle cx={spotX} cy={AXIS_Y} r={3} fill="var(--text)" />
        <text
          x={spotX} y={AXIS_Y - 33}
          textAnchor="middle" fill="var(--text)"
          fontSize={10} fontWeight={600}
        >
          ${spot.toLocaleString()} now
        </text>
      </svg>
    </div>
  );
}

function StrikeCard({
  quote,
  side,
  amount,
  onSelect,
}: {
  quote: PriceQuote;
  side: "buy" | "sell";
  amount: number;
  onSelect: () => void;
}) {
  const apr = computeAPR(quote.premium, quote.strike, quote.expiry_days);
  const disabled = !quote.otoken_address || quote.available_amount <= 0;

  const isBuy = side === "buy";
  const earnings = amount > 0
    ? isBuy
      ? (quote.premium * amount) / quote.strike
      : quote.premium * amount
    : 0;

  return (
    <button
      onClick={onSelect}
      disabled={disabled}
      className={`w-full flex items-center justify-between py-4 px-5 transition-all duration-200 text-left group ${
        disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-[var(--surface)]"
      }`}
    >
      <span className={`text-base font-semibold text-[var(--text)] ${!disabled ? "group-hover:translate-x-0.5 transition-transform duration-200" : ""} inline-block`}>
        ${quote.strike.toLocaleString()}/ETH
      </span>
      <div className="text-right">
        {earnings > 0 ? (
          <span className="text-base font-bold text-[var(--accent)]">
            Earn ${Math.round(earnings).toLocaleString()}
          </span>
        ) : (
          <span className="text-base font-bold text-[var(--accent)]">
            {Math.round(apr)}% APR
          </span>
        )}
        {earnings > 0 && (
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
        <div>
          <p className="text-3xl font-bold text-[var(--accent)]">
            ${Math.round(premium).toLocaleString()} earned
          </p>
          <p className="text-sm text-[var(--text-secondary)] mt-1">{Math.round(apr)}% APR</p>
        </div>
        <p className="text-base text-[var(--text)]">
          Yours to keep, no matter what happens.
        </p>
        <div className="h-px bg-[var(--border)]" />
        <div className="space-y-2 text-sm text-[var(--text-secondary)]">
          <p>{commitLabel} committed for {aq.expiry_days} days</p>
          <p>{abuy ? "Buy" : "Sell"} ETH at ${aq.strike.toLocaleString()}/ETH</p>
        </div>
        <a
          href="/positions"
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

      {/* Two-column: config flow left, chart right */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(340px,1fr)_minmax(0,1fr)] gap-6">
        {/* Left column: full configuration flow */}
        <div className="space-y-5">
          {/* 1. Buy / Sell toggle */}
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

          {/* 2. Amount input */}
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

          {/* 3. Date selector — button group */}
          {expiries.length > 0 && (
            <div className="animate-fade-in-up">
              <p className="text-sm text-[var(--text-secondary)] mb-2">Duration</p>
              <div className="flex flex-wrap gap-2">
                {expiries.map((days) => (
                  <button
                    key={days}
                    onClick={() => setSelectedExpiry(days)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      activeExpiry === days
                        ? "bg-[var(--accent)] text-white"
                        : "bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] hover:border-[var(--accent)]"
                    }`}
                  >
                    {untilDate(days)} ({days}d)
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 4. Strike price cards */}
          <div className="animate-fade-in-up">
            <p className="text-sm text-[var(--text-secondary)] mb-2">
              {amount > 0
                ? "Choose your strike price"
                : "Enter an amount to see earnings per strike"}
            </p>
            {filteredPrices.length > 0 ? (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] divide-y divide-[var(--border)]">
                {filteredPrices.map((q, i) => (
                  <StrikeCard
                    key={`${q.strike}-${q.expiry_days}-${i}`}
                    quote={q}
                    side={side}
                    amount={amount}
                    onSelect={() => setSelected({ quote: q, side })}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl bg-[var(--surface)] p-5 text-sm text-[var(--text-secondary)] text-center">
                No prices available for this date.
              </div>
            )}
          </div>
        </div>

        {/* Right column: chart (updates as parameters change) */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          {spot && filteredPrices.length > 0 ? (
            <StrikeChart
              filteredPrices={filteredPrices}
              spot={spot}
              side={side}
              amount={amount}
              onSelect={(q) => setSelected({ quote: q, side })}
            />
          ) : (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-8 text-center text-sm text-[var(--text-secondary)]">
              Chart will appear once prices load
            </div>
          )}
        </div>
      </div>

      {selected && (
        <AcceptModal
          quote={selected.quote}
          side={selected.side}
          initialAmount={amountStr}
          confirmOnly={amount > 0}
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
