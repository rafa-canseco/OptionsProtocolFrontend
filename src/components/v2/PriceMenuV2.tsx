"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { usePrices } from "@/hooks/usePrices";
import { useCapacity } from "@/hooks/useCapacity";
import { useWallet } from "@/hooks/useWallet";
import { useBalances } from "@/hooks/useBalances";
import { AcceptModal } from "../AcceptModal";
import { LivePrice } from "../LivePrice";
import { HowItWorksDrawer } from "../HowItWorksDrawer";
import { InfoTooltip } from "../ui/InfoTooltip";
import { OutcomeCards } from "./OutcomeCards";
import { CHAIN } from "@/lib/contracts";
import type { PriceQuote } from "@/lib/api";

function computeAPR(premium: number, strike: number, expiryDays: number): number {
  if (strike <= 0 || expiryDays <= 0) return 0;
  return (premium / strike) * (365 / expiryDays) * 100;
}

function parseLocalDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day); // month is 0-indexed; uses local time
}

function expiryLabel(expiryDate: string): string {
  const d = parseLocalDate(expiryDate);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function daysUntil(expiryDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = parseLocalDate(expiryDate);
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

const PERCENT_SHORTCUTS = [25, 50, 75, 100] as const;
const MAX_AMOUNT_USD = 1_000_000;
const MAX_AMOUNT_ETH = 1_000;

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
            ${earnings < 1 ? earnings.toFixed(2) : Math.round(earnings).toLocaleString()}
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
  const { capacity } = useCapacity();
  const { address, isConnected, login } = useWallet();
  const { usd, eth, weth } = useBalances(address);
  const searchParams = useSearchParams();
  const initialSide = searchParams.get("side") === "sell" ? "sell" : "buy";
  const [side, setSide] = useState<"buy" | "sell">(initialSide);
  const [selectedQuote, setSelectedQuote] = useState<PriceQuote | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [accepted, setAccepted] = useState<{ quote: PriceQuote; side: "buy" | "sell"; amount: number; txHash: string | null } | null>(null);

  const [amountStr, setAmountStr] = useState("");
  const amount = Number(amountStr) || 0;
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isBuy = side === "buy";
  const walletBalance = isBuy ? usd : eth + weth;

  const expiries = useMemo(() => {
    const seen = new Set<string>();
    for (const p of prices) {
      seen.add(p.expiry_date);
    }
    return [...seen].sort();   // ISO strings sort correctly lexicographically
  }, [prices]);

  const [selectedExpiry, setSelectedExpiry] = useState<string | null>(null);
  const activeExpiry = selectedExpiry ?? expiries[0] ?? null;

  const spot = prices[0]?.spot;

  const marketClosed = capacity !== null && (!capacity.market_open || capacity.market_status === "full");
  const marketDegraded = capacity !== null && capacity.market_status === "degraded";
  const capEth = capacity?.max_position_eth ?? MAX_AMOUNT_ETH;
  const capUsd = spot ? Math.min(MAX_AMOUNT_USD, capEth * spot) : MAX_AMOUNT_USD;

  const filteredPrices = useMemo(() => {
    const s = prices[0]?.spot;
    return prices
      .filter(
        (p) =>
          p.option_type === (side === "buy" ? "put" : "call") &&
          p.expiry_date === activeExpiry &&
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

  const selectedEarnings =
    selectedQuote && amount > 0 && selectedQuote.strike > 0
      ? isBuy
        ? (selectedQuote.premium * amount) / selectedQuote.strike
        : selectedQuote.premium * amount
      : 0;

  const selectedApr = selectedQuote
    ? computeAPR(selectedQuote.premium, selectedQuote.strike, selectedQuote.expiry_days)
    : 0;

  const canAccept = selectedQuote && amount > 0 && selectedQuote.otoken_address;
  const insufficientBalance = isConnected && amount > 0 && amount > walletBalance;

  function handlePercentShortcut(pct: number) {
    const raw = walletBalance * (pct / 100);
    if (isBuy) {
      setAmountStr(Math.min(Math.floor(raw), capUsd).toString());
    } else {
      setAmountStr(Math.min(Number(raw.toFixed(4)), capEth).toString());
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
    const { quote: aq, side: as_, amount: aa, txHash: aTxHash } = accepted;
    const abuy = as_ === "buy";
    const premium = abuy ? (aq.premium * aa) / aq.strike : aq.premium * aa;
    const commitLabel = abuy ? `$${aa.toLocaleString()}` : `${aa} ETH`;
    const apr = computeAPR(aq.premium, aq.strike, aq.expiry_days);
    const explorerUrl = CHAIN.blockExplorers?.default.url;

    return (
      <div className="text-center space-y-5 py-10 animate-fade-in-up">
        <div>
          <p className="text-4xl font-bold text-[var(--accent)] font-mono">
            ${premium < 1 ? premium.toFixed(2) : Math.round(premium).toLocaleString()}
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
        {aTxHash && explorerUrl && (
          <a
            href={`${explorerUrl}/tx/${aTxHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-sm text-[var(--accent)] hover:underline"
          >
            View transaction ↗
          </a>
        )}
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
        <div className="flex items-center gap-4">
          {capacity && (
            <span className={`text-xs font-medium ${
              marketClosed
                ? "text-[var(--danger)]"
                : marketDegraded
                  ? "text-amber-400"
                  : "text-[var(--accent)]"
            }`}>
              {marketClosed ? "● Closed" : marketDegraded ? "● Limited" : "● Open"}
            </span>
          )}
          <button
            onClick={() => setDrawerOpen(true)}
            className="text-sm font-medium text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
          >
            How does this work?
          </button>
        </div>
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
                {expiries.map((d) => (
                  <button
                    key={d}
                    onClick={() => { setSelectedExpiry(d); }}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                      activeExpiry === d
                        ? "bg-[var(--accent)] text-[var(--bg)] shadow-sm"
                        : "bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] hover:border-[var(--accent)] hover:shadow-sm"
                    }`}
                  >
                    {expiryLabel(d)} ({daysUntil(d)}d)
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
                  ? `$${walletBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : `${walletBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ETH`}</span>
              </p>
              <div className="flex gap-1.5">
                {PERCENT_SHORTCUTS.map((pct) => (
                  <button
                    key={pct}
                    onClick={() => handlePercentShortcut(pct)}
                    disabled={walletBalance <= 0}
                    className={`text-[10px] font-medium transition-colors duration-150 px-1.5 py-0.5 rounded bg-[var(--surface)] ${
                      walletBalance > 0
                        ? "text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10"
                        : "text-[var(--text-secondary)] opacity-40 cursor-not-allowed"
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
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
                {filteredPrices.map((q) => (
                  <StrikeCard
                    key={`${q.strike}-${q.expiry_date}`}
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
          <div className="space-y-2 animate-fade-in-up">
            <button
              onClick={() => {
                if (!isConnected) { login(); return; }
                setConfirming(true);
              }}
              disabled={marketClosed || insufficientBalance || (!canAccept && isConnected)}
              className={`w-full rounded-xl py-3.5 text-sm font-semibold transition-all duration-300 ${
                !marketClosed && canAccept && !insufficientBalance
                  ? "bg-[var(--accent)] text-[var(--bg)] hover:bg-[var(--accent-hover)] animate-glow scale-[1.02]"
                  : "bg-[var(--accent)] text-[var(--bg)] disabled:opacity-40"
              }`}
            >
              {marketClosed
                ? "Market temporarily closed"
                : !isConnected
                  ? "Connect wallet"
                  : !amount
                    ? "Enter an amount"
                    : insufficientBalance
                      ? "Insufficient balance"
                      : !selectedQuote
                        ? "Select a strike price"
                        : `Accept: Earn $${Math.round(selectedEarnings).toLocaleString()}`}
            </button>
            {marketClosed && (
              <p className="text-xs text-center text-[var(--text-secondary)]">
                The MM is at capacity. Check back soon.
              </p>
            )}
          </div>
        </div>

        {/* RIGHT: Live preview — outcome cards */}
        <div className="lg:sticky lg:top-24 lg:self-start space-y-4">
          {selectedQuote && amount > 0 && (
            <div className="text-center py-2 animate-fade-in-up">
              <div className="flex items-center justify-center gap-1">
                <p className="text-3xl font-bold text-[var(--accent)] font-mono">
                  ${Math.round(selectedEarnings).toLocaleString()}
                </p>
                <InfoTooltip title="Premium" text="Paid to you upfront. Yours to keep no matter what happens with the price." />
              </div>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                {Math.round(selectedApr)}% APR · {activeExpiry ? daysUntil(activeExpiry) : 0}d
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

      {/* AcceptModal — only opens on Accept click, confirmation-only */}
      {confirming && selectedQuote && (
        <AcceptModal
          quote={selectedQuote}
          side={side}
          initialAmount={amountStr}
          confirmOnly
          maxPositionEth={capacity?.max_position_eth}
          onClose={() => setConfirming(false)}
          onAccepted={({ amount: amt, txHash: hash }) => {
            setConfirming(false);
            setAccepted({ quote: selectedQuote, side, amount: amt, txHash: hash });
          }}
        />
      )}

      <HowItWorksDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
    </div>
  );
}
