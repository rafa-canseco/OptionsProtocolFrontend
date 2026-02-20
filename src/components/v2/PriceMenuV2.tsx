"use client";

import { useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
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

/** Step indicator dots */
function StepIndicator({ current }: { current: number }) {
  const steps = ["Side", "Duration", "Amount", "Strike"];
  return (
    <div className="flex items-center gap-2">
      {steps.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 transition-all duration-300 ${
            i < current
              ? "opacity-100"
              : i === current
                ? "opacity-100"
                : "opacity-30"
          }`}>
            <div className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
              i < current
                ? "bg-[var(--accent)]"
                : i === current
                  ? "bg-[var(--text)] scale-125"
                  : "bg-[var(--border)]"
            }`} />
            <span className={`text-[10px] font-medium transition-colors duration-300 ${
              i <= current ? "text-[var(--text-secondary)]" : "text-[var(--border)]"
            }`}>
              {label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`w-4 h-px transition-colors duration-300 ${
              i < current ? "bg-[var(--accent)]" : "bg-[var(--border)]"
            }`} />
          )}
        </div>
      ))}
    </div>
  );
}

/** Horizontal price axis with color zones — spot vs strikes */
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
  const H = 180;
  const PAD_L = 10;
  const PAD_R = 10;
  const plotW = W - PAD_L - PAD_R;
  const AXIS_Y = 90;

  const toX = (price: number) => PAD_L + ((price - xMin) / xRange) * plotW;
  const spotX = toX(spot);
  const isBuy = side === "buy";

  // Color zone: the "safe zone" between spot and nearest strike
  const nearestStrike = isBuy
    ? Math.max(...strikes.filter(s => s < spot))
    : Math.min(...strikes.filter(s => s > spot));
  const safeLeft = isBuy ? toX(nearestStrike) : spotX;
  const safeRight = isBuy ? spotX : toX(nearestStrike);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="safeZone" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.08} />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.02} />
        </linearGradient>
        <radialGradient id="selectedGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--text)" stopOpacity={0.06} />
          <stop offset="100%" stopColor="var(--text)" stopOpacity={0} />
        </radialGradient>
      </defs>

      {/* Safe zone fill between nearest strike and spot */}
      {!isNaN(nearestStrike) && (
        <rect
          x={safeLeft} y={AXIS_Y - 40}
          width={Math.max(0, safeRight - safeLeft)} height={80}
          fill="url(#safeZone)"
          rx={4}
        />
      )}

      {/* Selected strike — soft neutral spotlight */}
      {selectedStrike && (
        <ellipse
          cx={toX(selectedStrike)} cy={AXIS_Y}
          rx={28} ry={45}
          fill="url(#selectedGlow)"
        />
      )}

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
        const unavailable = !q.otoken_address || q.available_amount <= 0;

        return (
          <g key={q.strike} opacity={unavailable ? 0.25 : 1}>
            {/* Strike tick */}
            <line
              x1={x} y1={AXIS_Y - 14} x2={x} y2={AXIS_Y + 14}
              stroke={isSelected ? "var(--accent)" : "var(--text-secondary)"}
              strokeWidth={isSelected ? 2.5 : 1.5}
              strokeLinecap="round"
            />
            {/* Selected indicator */}
            {isSelected && (
              <circle cx={x} cy={AXIS_Y} r={5} fill="var(--accent)" opacity={0.9}>
                <animate attributeName="r" values="4;6;4" dur="2s" repeatCount="indefinite" />
              </circle>
            )}
            {/* Earnings label above */}
            {earnings > 0 && (
              <text
                x={x} y={AXIS_Y - 24}
                textAnchor="middle" fill="var(--accent)"
                fontSize={isSelected ? 13 : 11} fontWeight={700}
                style={{ fontFamily: "var(--font-mono)" }}
              >
                ${Math.round(earnings).toLocaleString()}
              </text>
            )}
            {/* Strike price below */}
            <text
              x={x} y={AXIS_Y + 30}
              textAnchor="middle"
              fill={isSelected ? "var(--accent)" : "var(--text-secondary)"}
              fontSize={10}
              fontWeight={isSelected ? 600 : 400}
              style={{ fontFamily: "var(--font-mono)" }}
            >
              ${q.strike.toLocaleString()}
            </text>
          </g>
        );
      })}

      {/* Spot marker */}
      <line
        x1={spotX} y1={AXIS_Y - 40} x2={spotX} y2={AXIS_Y + 4}
        stroke="var(--text)" strokeWidth={1.5} strokeDasharray="3 2"
      />
      <circle cx={spotX} cy={AXIS_Y} r={3.5} fill="var(--text)" />
      <text
        x={spotX} y={AXIS_Y - 48}
        textAnchor="middle" fill="var(--text)"
        fontSize={11} fontWeight={600}
        style={{ fontFamily: "var(--font-mono)" }}
      >
        ${spot.toLocaleString()} now
      </text>

      {/* "Safe zone" label */}
      {!isNaN(nearestStrike) && safeRight - safeLeft > 40 && (
        <text
          x={(safeLeft + safeRight) / 2} y={AXIS_Y + 52}
          textAnchor="middle" fill="var(--accent)"
          fontSize={9} fontWeight={500} opacity={0.6}
        >
          safe zone
        </text>
      )}
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
            ? "bg-[var(--accent)]/8 border-l-2 border-l-[var(--accent)]"
            : "hover:bg-[var(--surface)] hover:pl-6"
      }`}
    >
      <span className={`text-base font-semibold font-mono ${isSelected ? "text-[var(--accent)]" : "text-[var(--text)]"} transition-all duration-200 inline-block`}>
        ${quote.strike.toLocaleString()}/ETH
      </span>
      <div className="text-right">
        {earnings > 0 ? (
          <span className="text-base font-bold text-[var(--accent)] font-mono">
            ${Math.round(earnings).toLocaleString()}
          </span>
        ) : (
          <span className="text-base font-bold text-[var(--accent)] font-mono">
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
  const searchParams = useSearchParams();
  const initialSide = searchParams.get("side") === "sell" ? "sell" : "buy";
  const [side, setSide] = useState<"buy" | "sell">(initialSide);
  const [selectedQuote, setSelectedQuote] = useState<PriceQuote | null>(null);
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

  const selectedEarnings = selectedQuote && amount > 0
    ? isBuy
      ? (selectedQuote.premium * amount) / selectedQuote.strike
      : selectedQuote.premium * amount
    : 0;

  const selectedApr = selectedQuote
    ? computeAPR(selectedQuote.premium, selectedQuote.strike, selectedQuote.expiry_days)
    : 0;

  const canAccept = selectedQuote && amount > 0 && selectedQuote.otoken_address;

  // Progress step: 0=side (always done), 1=duration, 2=amount, 3=strike
  const currentStep = !activeExpiry ? 1 : amount <= 0 ? 2 : !selectedQuote ? 3 : 4;

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
          <p className="text-4xl font-bold text-[var(--accent)] font-mono">
            ${Math.round(premium).toLocaleString()}
          </p>
          <p className="text-base text-[var(--text-secondary)] mt-2">earned — yours to keep</p>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">{Math.round(apr)}% APR</p>
        <div className="h-px bg-[var(--border)]" />
        <div className="space-y-2 text-sm text-[var(--text-secondary)]">
          <p>{commitLabel} committed for {aq.expiry_days} days</p>
          <p>{abuy ? "Buy" : "Sell"} ETH at ${aq.strike.toLocaleString()}/ETH</p>
        </div>
        <a
          href="/positions"
          className="block mx-auto max-w-xs rounded-xl bg-[var(--accent)] py-3.5 text-sm font-semibold text-[var(--bg)] hover:bg-[var(--accent-hover)] transition-colors"
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
          {/* Progress indicator */}
          <StepIndicator current={currentStep} />

          {/* 1. Buy / Sell toggle */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1 flex animate-fade-in-up">
            <button
              onClick={() => { setSide("buy"); setAmountStr(""); setSelectedQuote(null); }}
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                side === "buy"
                  ? "bg-[var(--bg)] text-[var(--text)] shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-[var(--text)]"
              }`}
            >
              I&apos;d buy
            </button>
            <button
              onClick={() => { setSide("sell"); setAmountStr(""); setSelectedQuote(null); }}
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
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
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                      activeExpiry === days
                        ? "bg-[var(--accent)] text-[var(--bg)] shadow-sm"
                        : "bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] hover:border-[var(--accent)] hover:shadow-sm"
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
            <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 focus-within:border-[var(--accent)] transition-colors duration-200">
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
                className="flex-1 bg-transparent text-[var(--text)] font-semibold text-base focus:outline-none font-mono"
              />
              {!isBuy && <span className="text-sm text-[var(--text-secondary)]">ETH</span>}
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <p className="text-xs text-[var(--text-secondary)]">
                Balance: <span className="font-mono">{isBuy
                  ? `$${walletBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                  : `${walletBalance.toFixed(2)} ETH`}</span>
              </p>
              {walletBalance > 0 && (
                <div className="flex gap-1.5">
                  {PERCENT_SHORTCUTS.map((pct) => (
                    <button
                      key={pct}
                      onClick={() => handlePercentShortcut(pct)}
                      className="text-[10px] font-medium text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors duration-150 px-1.5 py-0.5 rounded bg-[var(--surface)] hover:bg-[var(--accent)]/10"
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
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] divide-y divide-[var(--border)] overflow-hidden">
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

          {/* 5. Accept button — glows when ready */}
          <button
            onClick={() => {
              if (!isConnected) { login(); return; }
              setConfirming(true);
            }}
            disabled={!canAccept && isConnected}
            className={`w-full rounded-xl py-3.5 text-sm font-semibold transition-all duration-300 animate-fade-in-up ${
              canAccept
                ? "bg-[var(--accent)] text-[var(--bg)] hover:bg-[var(--accent-hover)] animate-glow scale-[1.02]"
                : "bg-[var(--accent)] text-[var(--bg)] disabled:opacity-40"
            }`}
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
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-5">
            <p className="text-xs text-[var(--text-secondary)] mb-3">
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
              <div className="h-36 flex items-center justify-center text-sm text-[var(--text-secondary)]">
                Loading prices...
              </div>
            )}
          </div>

          {/* Outcome preview — builds up as user configures */}
          {selectedQuote && amount > 0 ? (
            <div className="space-y-4 animate-fade-in-up">
              {/* Earnings hero */}
              <div className="text-center py-2">
                <p className="text-3xl font-bold text-[var(--accent)] font-mono">
                  ${Math.round(selectedEarnings).toLocaleString()}
                </p>
                <p className="text-sm text-[var(--text-secondary)] mt-1">
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
          ) : (
            <div className="rounded-2xl border border-dashed border-[var(--border)] p-6 text-center space-y-2">
              <p className="text-sm text-[var(--text-secondary)]">
                {!amount
                  ? "Enter an amount to see your earnings"
                  : "Select a strike to see outcomes"}
              </p>
              <p className="text-xs text-[var(--text-secondary)] opacity-60">
                Your earnings preview will appear here
              </p>
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
