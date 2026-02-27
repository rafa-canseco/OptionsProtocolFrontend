"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { usePrices } from "@/hooks/usePrices";
import { useWallet } from "@/hooks/useWallet";
import { useBalances } from "@/hooks/useBalances";
import { AcceptModal } from "../AcceptModal";
import { LivePrice } from "../LivePrice";
import { HowItWorksDrawer } from "../HowItWorksDrawer";
import { InfoTooltip } from "../ui/InfoTooltip";
import { OutcomeCards } from "./OutcomeCards";
import type { PriceQuote } from "@/lib/api";

function computeAPR(premium: number, strike: number, expiryDays: number): number {
  if (strike <= 0 || expiryDays <= 0) return 0;
  return (premium / strike) * (365 / expiryDays) * 100;
}

function untilDate(expiryDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + expiryDays);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const PERCENT_SHORTCUTS = [25, 50, 75, 100] as const;

// Risk thresholds (distance from spot as %)
const RISK_CLOSE = 3;
const RISK_MODERATE = 8;
const RISK_COLORS = { close: "#EF4444", moderate: "#F59E0B", safe: "#22D3EE" };

function getRiskColor(distancePct: number): string {
  if (distancePct < RISK_CLOSE) return RISK_COLORS.close;
  if (distancePct < RISK_MODERATE) return RISK_COLORS.moderate;
  return RISK_COLORS.safe;
}

/** Vertical bar chart with risk zones — spot line + strike bars */
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

  const isBuy = side === "buy";
  const FONT = "'JetBrains Mono', monospace";

  // Layout constants
  const W = 400;
  const SPOT_AREA = 36;
  const BAR_H = 44;
  const BAR_GAP = 8;
  const LEGEND_H = 28;
  const PAD_T = 8;
  const PAD_B = 4;
  const barCount = filteredPrices.length;
  const H = PAD_T + SPOT_AREA + barCount * (BAR_H + BAR_GAP) + LEGEND_H + PAD_B;

  const PAD_L = 80;
  const PAD_R = 12;
  const barAreaW = W - PAD_L - PAD_R;

  // Compute earnings for each strike
  const earningsArr = filteredPrices.map((q) =>
    amount > 0 ? (isBuy ? (q.premium * amount) / q.strike : q.premium * amount) : 0
  );
  const maxEarnings = Math.max(...earningsArr, 1);

  // filteredPrices already sorted: closest to spot first
  const ordered = filteredPrices;

  // Spot line Y position: top for buy, bottom for sell
  const spotY = isBuy ? PAD_T + 14 : PAD_T + SPOT_AREA + barCount * (BAR_H + BAR_GAP) + 4;
  const barsStartY = isBuy ? PAD_T + SPOT_AREA : PAD_T;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      preserveAspectRatio="xMidYMid meet"
      style={{ minHeight: Math.min(H, 340) }}
    >
      <defs>
        {ordered.map((q, i) => {
          const dist = Math.abs(q.strike - spot) / spot * 100;
          const color = getRiskColor(dist);
          return (
            <linearGradient key={`bg${i}`} id={`barGrad${i}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={color} stopOpacity={0.18} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          );
        })}
      </defs>

      {/* Spot price line */}
      <line
        x1={PAD_L - 4} y1={spotY} x2={W - PAD_R} y2={spotY}
        stroke="#FAFAFA" strokeWidth={1} strokeDasharray="6 3"
      />
      <circle cx={PAD_L - 4} cy={spotY} r={3} fill="#FAFAFA" />
      <text
        x={PAD_L - 12} y={spotY + 4}
        textAnchor="end" fill="#FAFAFA"
        fontSize={11} fontWeight={600}
        style={{ fontFamily: FONT }}
      >
        ${spot.toLocaleString()}
      </text>
      <text
        x={W - PAD_R} y={spotY + 4}
        textAnchor="end" fill="#A1A1AA"
        fontSize={9} fontWeight={500}
        style={{ fontFamily: FONT }}
      >
        now
      </text>

      {/* Strike bars */}
      {ordered.map((q, i) => {
        const barY = barsStartY + i * (BAR_H + BAR_GAP);
        const dist = Math.abs(q.strike - spot) / spot * 100;
        const color = getRiskColor(dist);
        const isSelected = q.strike === selectedStrike;
        const unavailable = !q.otoken_address || q.available_amount <= 0;

        const earnings = amount > 0
          ? (isBuy ? (q.premium * amount) / q.strike : q.premium * amount)
          : 0;
        const barW = Math.max(barAreaW * 0.15, (earnings / maxEarnings) * barAreaW);
        const apr = computeAPR(q.premium, q.strike, q.expiry_days);
        const distLabel = isBuy ? `${dist.toFixed(1)}% below` : `${dist.toFixed(1)}% above`;

        return (
          <g key={q.strike} opacity={unavailable ? 0.3 : 1}>
            {/* Left border indicator */}
            <rect
              x={PAD_L} y={barY}
              width={3} height={BAR_H}
              rx={1.5} fill={color}
            />

            {/* Bar background */}
            <rect
              x={PAD_L + 3} y={barY}
              width={barW} height={BAR_H}
              fill={`url(#barGrad${i})`}
              rx={4}
              stroke={isSelected ? "#22D3EE" : "transparent"}
              strokeWidth={isSelected ? 1.5 : 0}
            />

            {/* Selected pulsing indicator */}
            {isSelected && (
              <circle cx={PAD_L + barW + 10} cy={barY + BAR_H / 2} r={4} fill="#22D3EE" opacity={0.9}>
                <animate attributeName="r" values="3;5;3" dur="2s" repeatCount="indefinite" />
              </circle>
            )}

            {/* Strike price label (left of bar) */}
            <text
              x={PAD_L - 8} y={barY + BAR_H / 2 + 4}
              textAnchor="end"
              fill={isSelected ? "#22D3EE" : "#A1A1AA"}
              fontSize={11} fontWeight={isSelected ? 600 : 400}
              style={{ fontFamily: FONT }}
            >
              ${q.strike.toLocaleString()}
            </text>

            {/* Inside bar: distance % (top line) */}
            <text
              x={PAD_L + 12} y={barY + 16}
              fill={color}
              fontSize={10} fontWeight={500}
              style={{ fontFamily: FONT }}
            >
              {distLabel}
            </text>

            {/* Inside bar: earnings + APR (bottom line) */}
            <text
              x={PAD_L + 12} y={barY + 34}
              fill="#FAFAFA"
              fontSize={11} fontWeight={600}
              style={{ fontFamily: FONT }}
            >
              {earnings > 0
                ? `$${Math.round(earnings).toLocaleString()}  ${Math.round(apr)}% APR`
                : `${Math.round(apr)}% APR`}
            </text>
          </g>
        );
      })}

      {/* Legend */}
      {(() => {
        const legendY = isBuy
          ? PAD_T + SPOT_AREA + barCount * (BAR_H + BAR_GAP) + 12
          : PAD_T + barCount * (BAR_H + BAR_GAP) + SPOT_AREA + 12;
        const items = [
          { color: RISK_COLORS.safe, label: "Safe (>8%)" },
          { color: RISK_COLORS.moderate, label: "Moderate (3-8%)" },
          { color: RISK_COLORS.close, label: "Close (<3%)" },
        ];
        return items.map((item, i) => (
          <g key={item.label}>
            <circle cx={PAD_L + i * 110} cy={legendY} r={4} fill={item.color} />
            <text
              x={PAD_L + i * 110 + 10} y={legendY + 3.5}
              fill="#A1A1AA" fontSize={9} fontWeight={500}
              style={{ fontFamily: FONT }}
            >
              {item.label}
            </text>
          </g>
        ));
      })()}
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
      <span className={`text-base font-semibold font-mono ${isSelected ? "text-[var(--accent)]" : "text-[var(--bone)]"} transition-all duration-200 inline-block`}>
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
  const [drawerOpen, setDrawerOpen] = useState(false);

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
      .sort((a, b) => side === "buy" ? b.strike - a.strike : a.strike - b.strike);
  }, [prices, side, activeExpiry]);

  // When filters change, try to keep the same strike selected
  useEffect(() => {
    setSelectedQuote((prev) => {
      if (!prev) return prev;
      const match = filteredPrices.find((q) => q.strike === prev.strike);
      if (!match) return null;
      if (match.premium !== prev.premium || match.expiry_days !== prev.expiry_days) return match;
      return prev;
    });
  }, [filteredPrices]);

  const selectedEarnings = selectedQuote && amount > 0
    ? isBuy
      ? (selectedQuote.premium * amount) / selectedQuote.strike
      : selectedQuote.premium * amount
    : 0;

  const selectedApr = selectedQuote
    ? computeAPR(selectedQuote.premium, selectedQuote.strike, selectedQuote.expiry_days)
    : 0;

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
          <p className="text-4xl font-bold text-[var(--accent)] font-mono">
            ${Math.round(premium).toLocaleString()}
          </p>
          <p className="text-base text-[var(--text-secondary)] mt-2">earned. Yours to keep.</p>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          {Math.round(apr)}% APR
        </p>
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
      <div className="flex items-center justify-between animate-fade-in-up">
        <LivePrice spot={spot} />
        <button
          onClick={() => setDrawerOpen(true)}
          className="text-sm font-medium text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
        >
          How does this work?
        </button>
      </div>

      {/* Two-column: config left, preview right */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(340px,1fr)_minmax(0,1fr)] gap-8">
        {/* LEFT: Configuration flow */}
        <div className="space-y-5">
          {/* 1. Buy / Sell toggle */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1 flex animate-fade-in-up">
            <button
              onClick={() => { setSide("buy"); setAmountStr(""); setSelectedQuote(null); }}
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                side === "buy"
                  ? "bg-[var(--bg)] text-[var(--accent)] shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-[var(--text)]"
              }`}
            >
              I&apos;d buy
            </button>
            <button
              onClick={() => { setSide("sell"); setAmountStr(""); setSelectedQuote(null); }}
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                side === "sell"
                  ? "bg-[var(--bg)] text-[var(--danger)] shadow-sm"
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
                    onClick={() => { setSelectedExpiry(days); }}
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
            <p className="text-sm text-[var(--text-secondary)] flex items-center mb-2">
              {amount > 0 ? "Choose your strike price" : "Enter an amount to see earnings per strike"}
              <InfoTooltip title="Strike price" text="The price at which you commit to buy (or sell) ETH. Lower = safer, higher = more premium." />
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
                  : `Accept: Earn $${Math.round(selectedEarnings).toLocaleString()}`}
          </button>
        </div>

        {/* RIGHT: Live preview — chart + outcome cards */}
        <div className="lg:sticky lg:top-24 lg:self-start space-y-4">
          {/* Chart */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-5">
            <p className="text-xs text-[var(--text-secondary)] mb-3 flex items-center">
              Strike distance from current price
              <InfoTooltip title="Risk zones" text="Further from the current price = safer. Red bars are close to spot (higher risk, higher premium). Cyan bars are far from spot (safer, lower premium)." />
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

          {/* Outcome preview — always visible, fills in progressively */}
          <div className="space-y-4">
            {selectedQuote && amount > 0 && (
              <div className="text-center py-2 animate-fade-in-up">
                <div className="flex items-center justify-center gap-1">
                  <p className="text-3xl font-bold text-[var(--accent)] font-mono">
                    ${Math.round(selectedEarnings).toLocaleString()}
                  </p>
                  <InfoTooltip title="Premium" text="Paid to you upfront. Yours to keep no matter what happens with the price." />
                </div>
                <p className="text-sm text-[var(--text-secondary)] mt-1">
                  {Math.round(selectedApr)}% APR · {activeExpiry}d
                </p>
              </div>
            )}
            <OutcomeCards
              side={side}
              amount={amount > 0 ? amount : undefined}
              strike={selectedQuote?.strike}
              premium={selectedEarnings > 0 ? selectedEarnings : undefined}
            />
          </div>
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

      <HowItWorksDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
    </div>
  );
}
