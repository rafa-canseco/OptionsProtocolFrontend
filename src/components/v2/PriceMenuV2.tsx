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

const PERCENT_SHORTCUTS = [25, 50, 75, 100] as const;

/** Horizontal price axis — spot vs strikes, highlights selected */
function StrikeChart({
  filteredPrices,
  spot,
  side,
  amount,
  selectedStrike,
}: {
  filteredPrices: PriceQuote[];
  spot: number;
  side: "buy" | "sell";
  amount: number;
  selectedStrike: number | null;
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

  const W = 400;
  const H = 160;
  const PAD_L = 10;
  const PAD_R = 10;
  const plotW = W - PAD_L - PAD_R;
  const AXIS_Y = 80;

  const toX = (price: number) => PAD_L + ((price - xMin) / xRange) * plotW;
  const spotX = toX(spot);
  const isBuy = side === "buy";

  return (
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
        const isSelected = q.strike === selectedStrike;
        const earnings = amount > 0
          ? isBuy ? (q.premium * amount) / q.strike : q.premium * amount
          : 0;

        return (
          <g key={q.strike} opacity={!q.otoken_address || q.available_amount <= 0 ? 0.3 : 1}>
            {/* Selected highlight */}
            {isSelected && (
              <circle cx={x} cy={AXIS_Y} r={14} fill="var(--accent)" opacity={0.15} />
            )}
            {/* Strike tick */}
            <line
              x1={x} y1={AXIS_Y - 12} x2={x} y2={AXIS_Y + 12}
              stroke={isSelected ? "var(--accent)" : "var(--accent)"}
              strokeWidth={isSelected ? 3 : 2}
            />
            {/* Earnings label above */}
            {earnings > 0 && (
              <text
                x={x} y={AXIS_Y - 20}
                textAnchor="middle" fill="var(--accent)"
                fontSize={isSelected ? 13 : 11} fontWeight={600}
              >
                ${Math.round(earnings).toLocaleString()}
              </text>
            )}
            {/* Strike price below */}
            <text
              x={x} y={AXIS_Y + 28}
              textAnchor="middle"
              fill={isSelected ? "var(--accent)" : "var(--text-secondary)"}
              fontSize={10}
              fontWeight={isSelected ? 600 : 400}
            >
              ${q.strike.toLocaleString()}
            </text>
          </g>
        );
      })}

      {/* Spot marker */}
      <line
        x1={spotX} y1={AXIS_Y - 36} x2={spotX} y2={AXIS_Y + 4}
        stroke="var(--text)" strokeWidth={1.5} strokeDasharray="3 2"
      />
      <circle cx={spotX} cy={AXIS_Y} r={3.5} fill="var(--text)" />
      <text
        x={spotX} y={AXIS_Y - 42}
        textAnchor="middle" fill="var(--text)"
        fontSize={11} fontWeight={600}
      >
        ${spot.toLocaleString()} now
      </text>
    </svg>
  );
}

function StrikeCard({
  quote,
  side,
  amount,
  isSelected,
  onSelect,
}: {
  quote: PriceQuote;
  side: "buy" | "sell";
  amount: number;
  isSelected: boolean;
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
        disabled
          ? "opacity-40 cursor-not-allowed"
          : isSelected
            ? "bg-[var(--accent)]/10 border-l-2 border-l-[var(--accent)]"
            : "hover:bg-[var(--surface)]"
      }`}
    >
      <span className={`text-base font-semibold ${isSelected ? "text-[var(--accent)]" : "text-[var(--text)]"} ${!disabled ? "group-hover:translate-x-0.5 transition-transform duration-200" : ""} inline-block`}>
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
  const { address, isConnected, login } = useWallet();
  const { usd, eth } = useBalances(address);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  // Selected strike — just highlights, no modal
  const [selectedQuote, setSelectedQuote] = useState<PriceQuote | null>(null);
  // Only open modal when clicking Accept
  const [confirming, setConfirming] = useState(false);
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

  // Compute preview earnings for the selected quote
  const selectedEarnings = selectedQuote && amount > 0
    ? isBuy
      ? (selectedQuote.premium * amount) / selectedQuote.strike
      : selectedQuote.premium * amount
    : 0;

  const selectedApr = selectedQuote
    ? computeAPR(selectedQuote.premium, selectedQuote.strike, selectedQuote.expiry_days)
    : 0;

  // Ready to accept?
  const canAccept = selectedQuote && amount > 0 && selectedQuote.otoken_address;

  function handlePercentShortcut(pct: number) {
    const raw = walletBalance * (pct / 100);
    if (isBuy) {
      setAmountStr(Math.floor(raw).toString());
    } else {
      setAmountStr(Number(raw.toFixed(4)).toString());
    }
  }

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
          onClick={() => { setAccepted(null); setSelectedQuote(null); setAmountStr(""); refresh(); }}
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

      {/* Two-column: config left, preview right */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(340px,1fr)_minmax(0,1fr)] gap-8">
        {/* LEFT: Configuration flow */}
        <div className="space-y-5">
          {/* 1. Buy / Sell toggle */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1 flex animate-fade-in-up">
            <button
              onClick={() => { setSide("buy"); setAmountStr(""); setSelectedQuote(null); }}
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
                side === "buy"
                  ? "bg-[var(--bg)] text-[var(--text)] shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-[var(--text)]"
              }`}
            >
              I&apos;d buy
            </button>
            <button
              onClick={() => { setSide("sell"); setAmountStr(""); setSelectedQuote(null); }}
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
                side === "sell"
                  ? "bg-[var(--bg)] text-[var(--text)] shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-[var(--text)]"
              }`}
            >
              I&apos;d sell
            </button>
          </div>

          {/* 2. Duration — button group */}
          {expiries.length > 0 && (
            <div className="animate-fade-in-up">
              <p className="text-sm text-[var(--text-secondary)] mb-2">Duration</p>
              <div className="flex flex-wrap gap-2">
                {expiries.map((days) => (
                  <button
                    key={days}
                    onClick={() => { setSelectedExpiry(days); setSelectedQuote(null); }}
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

          {/* 3. Amount input + % shortcuts */}
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
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <p className="text-xs text-[var(--text-secondary)]">
                Balance: {isBuy
                  ? `$${walletBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                  : `${walletBalance.toFixed(2)} ETH`}
              </p>
              {walletBalance > 0 && (
                <div className="flex gap-1.5">
                  {PERCENT_SHORTCUTS.map((pct) => (
                    <button
                      key={pct}
                      onClick={() => handlePercentShortcut(pct)}
                      className="text-[10px] font-medium text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors px-1.5 py-0.5 rounded bg-[var(--surface)]"
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

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
                    isSelected={selectedQuote?.strike === q.strike}
                    onSelect={() => setSelectedQuote(q)}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl bg-[var(--surface)] p-5 text-sm text-[var(--text-secondary)] text-center">
                No prices available for this date.
              </div>
            )}
          </div>

          {/* 5. Accept button */}
          <button
            onClick={() => {
              if (!isConnected) { login(); return; }
              setConfirming(true);
            }}
            disabled={!canAccept && isConnected}
            className="w-full rounded-xl bg-[var(--accent)] py-3.5 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-40 transition-colors animate-fade-in-up"
          >
            {!isConnected
              ? "Connect wallet"
              : !amount
                ? "Enter an amount"
                : !selectedQuote
                  ? "Select a strike price"
                  : `Accept — Earn $${Math.round(selectedEarnings).toLocaleString()}`}
          </button>
        </div>

        {/* RIGHT: Live preview — chart + outcome cards */}
        <div className="lg:sticky lg:top-24 lg:self-start space-y-4">
          {/* Chart */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-4">
            <p className="text-xs text-[var(--text-secondary)] mb-2">
              {isBuy ? "Buy" : "Sell"} strikes vs current price
            </p>
            {spot && filteredPrices.length > 0 ? (
              <StrikeChart
                filteredPrices={filteredPrices}
                spot={spot}
                side={side}
                amount={amount}
                selectedStrike={selectedQuote?.strike ?? null}
              />
            ) : (
              <div className="h-32 flex items-center justify-center text-sm text-[var(--text-secondary)]">
                Loading prices...
              </div>
            )}
          </div>

          {/* Outcome cards — appear when strike is selected + amount entered */}
          {selectedQuote && amount > 0 && (
            <div className="space-y-3 animate-fade-in-up">
              <div className="text-center">
                <p className="text-2xl font-bold text-[var(--accent)]">
                  ${Math.round(selectedEarnings).toLocaleString()}
                </p>
                <p className="text-sm text-[var(--text-secondary)]">
                  {Math.round(selectedApr)}% APR · {activeExpiry}d
                </p>
              </div>
              <OutcomeCards
                strike={selectedQuote.strike}
                premium={selectedEarnings}
                side={side}
                amount={amount}
              />
            </div>
          )}
        </div>
      </div>

      {/* AcceptModal — only opens on Accept click, confirmation-only */}
      {confirming && selectedQuote && (
        <AcceptModal
          quote={selectedQuote}
          side={side}
          initialAmount={amountStr}
          confirmOnly
          onClose={() => setConfirming(false)}
          onAccepted={({ amount: amt }) => {
            setConfirming(false);
            setAccepted({ quote: selectedQuote, side, amount: amt });
          }}
        />
      )}
    </div>
  );
}
