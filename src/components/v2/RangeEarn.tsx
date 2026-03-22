"use client";

import { useState, useMemo } from "react";
import { InfoTooltip } from "../ui/InfoTooltip";
import { RangeOutcomeCards } from "./RangeOutcomeCards";
import { fmtUsd } from "@/lib/utils";
import type { PriceQuote } from "@/lib/api";
import type { AssetConfig } from "@/lib/assets";

function computeAPR(
  premium: number,
  strike: number,
  expiryDays: number,
): number {
  if (strike <= 0 || expiryDays <= 0) return 0;
  return (premium / strike) * (365 / expiryDays) * 100;
}

const MIN_DISPLAY_APR = 3;

interface RangeEarnProps {
  asset: AssetConfig;
  prices: PriceQuote[];
  activeExpiry: string | null;
  spot?: number;
  walletBalance: number;
}

export function RangeEarn({
  asset,
  prices,
  activeExpiry,
  spot,
  walletBalance,
}: RangeEarnProps) {
  const [putQuote, setPutQuote] = useState<PriceQuote | null>(null);
  const [callQuote, setCallQuote] = useState<PriceQuote | null>(null);
  const [amountStr, setAmountStr] = useState("");
  const amount = Number(amountStr) || 0;

  const putStrikes = useMemo(() => {
    return prices
      .filter(
        (p) =>
          p.option_type === "put" &&
          p.expiry_date === activeExpiry &&
          p.strike < (spot ?? Infinity) &&
          computeAPR(p.premium, p.strike, p.expiry_days) >= MIN_DISPLAY_APR
      )
      .sort((a, b) => b.strike - a.strike);
  }, [prices, activeExpiry, spot]);

  const callStrikes = useMemo(() => {
    return prices
      .filter(
        (p) =>
          p.option_type === "call" &&
          p.expiry_date === activeExpiry &&
          p.strike > (spot ?? -Infinity) &&
          computeAPR(p.premium, p.strike, p.expiry_days) >= MIN_DISPLAY_APR
      )
      .sort((a, b) => a.strike - b.strike);
  }, [prices, activeExpiry, spot]);

  // 50/50 split
  const putAmountUsd = amount / 2;
  const callAmountEth = spot && spot > 0 ? (amount / 2) / spot : 0;

  // Premium calculations
  const putPremium = putQuote && putAmountUsd > 0
    ? (putQuote.premium * putAmountUsd) / putQuote.strike
    : 0;
  const callPremium = callQuote && callAmountEth > 0
    ? callQuote.premium * callAmountEth
    : 0;
  const totalPremium = putPremium + callPremium;

  // Combined APR (weighted average)
  const putApr = putQuote
    ? computeAPR(putQuote.premium, putQuote.strike, putQuote.expiry_days)
    : 0;
  const callApr = callQuote
    ? computeAPR(callQuote.premium, callQuote.strike, callQuote.expiry_days)
    : 0;
  const combinedApr = putQuote && callQuote
    ? (putApr + callApr) / 2
    : putQuote ? putApr : callApr;

  const canAccept = putQuote && callQuote && amount > 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(340px,1fr)_minmax(0,1fr)] gap-8">
      {/* LEFT: Strike selection + amount */}
      <div className="space-y-5">
        {/* Range explanation */}
        <div className="rounded-xl bg-[var(--accent)]/5 border border-[var(--accent)]/15 px-4 py-3 animate-fade-in-up">
          <p className="text-sm text-[var(--bone)]">
            Earn from both sides. Pick a lower and upper price — if {asset.symbol} stays in range, you keep everything.
          </p>
        </div>

        {/* Amount input */}
        <div className="animate-fade-in-up">
          <p className="text-sm text-[var(--text-secondary)] mb-2">
            Total to commit
          </p>
          <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 focus-within:border-[var(--accent)] transition-colors duration-200">
            <span className="text-[var(--text-secondary)]">$</span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="1,000"
              value={amountStr}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === "" || /^(0|[1-9]\d*)?\.?\d*$/.test(raw)) {
                  setAmountStr(raw);
                }
              }}
              className="flex-1 bg-transparent text-[var(--text)] font-semibold text-base focus:outline-none font-mono"
            />
          </div>
          {amount > 0 && spot && (
            <div className="mt-1.5 space-y-0.5">
              <p className="text-xs text-[var(--text-secondary)]">
                Split: <span className="font-mono">${putAmountUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span> USDC + <span className="font-mono">{callAmountEth.toFixed(4)}</span> {asset.symbol}
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                No need to hold {asset.symbol} — we swap automatically if needed
              </p>
            </div>
          )}
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Balance: <span className="font-mono">${walletBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </p>
        </div>

        {/* Dual strike columns */}
        <div className="grid grid-cols-2 gap-3 animate-fade-in-up">
          {/* Put strikes */}
          <div>
            <p className="text-sm text-[var(--text-secondary)] mb-2 flex items-center">
              Lower bound
              <InfoTooltip title="Lower bound" text={`If ${asset.symbol} drops below this price, you buy at this price and keep the premium.`} />
            </p>
            {putStrikes.length > 0 ? (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] divide-y divide-[var(--border)] overflow-hidden">
                {putStrikes.map((q) => {
                  const apr = computeAPR(q.premium, q.strike, q.expiry_days);
                  const selected = putQuote?.strike === q.strike;
                  const disabled = !q.otoken_address || q.available_amount <= 0;
                  const dist = spot ? ((q.strike - spot) / spot * 100) : null;
                  return (
                    <button
                      key={q.strike}
                      onClick={() => setPutQuote(q)}
                      disabled={disabled}
                      className={`w-full py-3 px-3 text-left text-sm transition-all duration-200 cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none ${
                        disabled ? "opacity-40 cursor-not-allowed"
                        : selected ? "bg-[var(--accent)]/8 border-l-2 border-l-[var(--accent)]"
                        : "hover:bg-[var(--surface)] active:bg-[var(--surface)]"
                      }`}
                    >
                      <span className={`font-mono font-semibold ${selected ? "text-[var(--accent)]" : "text-[var(--bone)]"}`}>
                        ${q.strike.toLocaleString()}
                      </span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-[var(--accent)] font-mono font-bold">{Math.round(apr)}% APR</span>
                        {dist != null && (
                          <span className="text-xs text-[var(--text-secondary)] font-mono">{dist.toFixed(1)}%</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-[var(--text-secondary)] text-center py-4">No put strikes</p>
            )}
          </div>

          {/* Call strikes */}
          <div>
            <p className="text-sm text-[var(--text-secondary)] mb-2 flex items-center">
              Upper bound
              <InfoTooltip title="Upper bound" text={`If ${asset.symbol} rises above this price, you sell at this price and keep the premium.`} />
            </p>
            {callStrikes.length > 0 ? (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] divide-y divide-[var(--border)] overflow-hidden">
                {callStrikes.map((q) => {
                  const apr = computeAPR(q.premium, q.strike, q.expiry_days);
                  const selected = callQuote?.strike === q.strike;
                  const disabled = !q.otoken_address || q.available_amount <= 0;
                  const dist = spot ? ((q.strike - spot) / spot * 100) : null;
                  return (
                    <button
                      key={q.strike}
                      onClick={() => setCallQuote(q)}
                      disabled={disabled}
                      className={`w-full py-3 px-3 text-left text-sm transition-all duration-200 cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none ${
                        disabled ? "opacity-40 cursor-not-allowed"
                        : selected ? "bg-[var(--accent)]/8 border-l-2 border-l-[var(--accent)]"
                        : "hover:bg-[var(--surface)] active:bg-[var(--surface)]"
                      }`}
                    >
                      <span className={`font-mono font-semibold ${selected ? "text-[var(--accent)]" : "text-[var(--bone)]"}`}>
                        ${q.strike.toLocaleString()}
                      </span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-[var(--accent)] font-mono font-bold">{Math.round(apr)}% APR</span>
                        {dist != null && (
                          <span className="text-xs text-[var(--text-secondary)] font-mono">+{dist.toFixed(1)}%</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-[var(--text-secondary)] text-center py-4">No call strikes</p>
            )}
          </div>
        </div>

        {/* Range summary */}
        {putQuote && callQuote && spot && (
          <div className="flex items-center justify-between rounded-xl bg-[var(--surface)] border border-[var(--border)] px-4 py-3 animate-fade-in-up">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-mono font-semibold text-[var(--bone)]">${putQuote.strike.toLocaleString()}</span>
              <span className="text-[var(--text-secondary)]">—</span>
              <span className="font-mono font-semibold text-[var(--bone)]">${callQuote.strike.toLocaleString()}</span>
            </div>
            <span className="text-xs text-[var(--text-secondary)] font-mono">
              {(((callQuote.strike - putQuote.strike) / spot) * 100).toFixed(1)}% range
            </span>
          </div>
        )}

        {/* Accept button — disabled for Phase 1 */}
        <div className="animate-fade-in-up">
          <button
            disabled
            className="w-full rounded-xl py-3.5 text-sm font-semibold bg-[var(--accent)] text-[var(--bg)] disabled:opacity-40 transition-all duration-300"
          >
            {!amount
              ? "Enter an amount"
              : !putQuote
                ? "Select lower bound"
                : !callQuote
                  ? "Select upper bound"
                  : "Coming soon"}
          </button>
        </div>
      </div>

      {/* RIGHT: Preview */}
      <div className="lg:sticky lg:top-24 lg:self-start space-y-4">
        {canAccept && totalPremium > 0 && (
          <div className="text-center py-2 animate-fade-in-up">
            <div className="flex items-center justify-center gap-1">
              <p className="text-3xl font-bold text-[var(--accent)] font-mono">
                ${fmtUsd(totalPremium)}
              </p>
              <InfoTooltip title="Combined premium" text="Total premium from both put and call legs. Yours to keep no matter what." />
            </div>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              {Math.round(combinedApr)}% APR
            </p>
          </div>
        )}
        <RangeOutcomeCards
          putStrike={putQuote?.strike}
          callStrike={callQuote?.strike}
          totalPremium={totalPremium > 0 ? totalPremium : undefined}
          putAmountUsd={putAmountUsd > 0 ? putAmountUsd : undefined}
          callAmountEth={callAmountEth > 0 ? callAmountEth : undefined}
          assetSymbol={asset.symbol}
        />
      </div>
    </div>
  );
}
