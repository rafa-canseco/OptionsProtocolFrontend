"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import type { Position, SettleResult } from "@/lib/api";
import { api } from "@/lib/api";
import { DistanceIndicator } from "./v2/DistanceIndicator";
import type { YieldMetric } from "./YieldToggle";

interface Props {
  position: Position;
  onSettled?: () => void;
  spot?: number;
  renderExtra?: (position: Position, strike: number) => ReactNode;
  /** Base path for Earn links, e.g. "/earn" */
  earnBase?: string;
  /** When true, shows a "Confirming..." badge for optimistic positions */
  optimistic?: boolean;
  /** Which yield metric to display — defaults to "apr" */
  yieldMetric?: YieldMetric;
}

export function PositionCard({ position, onSettled, spot, renderExtra, earnBase = "/earn", optimistic, yieldMetric = "apr" }: Props) {
  const isBuy = position.is_put;
  const isActive = !position.is_settled;

  // strike_price is 8 decimals on-chain
  const strike = position.strike_price / 1e8;

  // Collateral: puts = LUSD (6 dec), calls = LETH (18 dec)
  const committedUsd = isBuy
    ? position.collateral / 1e6
    : (position.collateral / 1e18) * strike;
  const committedDisplay = isBuy
    ? `$${(position.collateral / 1e6).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
    : `${(position.collateral / 1e18).toFixed(2)} ETH`;

  // Premium in LUSD base units (6 decimals)
  const premiumUsd = Number(position.net_premium) / 1e6;
  const returnPct = committedUsd > 0 ? (premiumUsd / committedUsd) * 100 : 0;

  // oToken amount (8 decimals)
  const ethAmount = position.amount / 1e8;
  const ethAmountDisplay = ethAmount.toFixed(2);

  // Expiry: total duration from indexed_at to expiry
  const indexedTime = new Date(position.indexed_at).getTime();
  const expiryTime = position.expiry * 1000;
  const totalDays = Math.max(1, Math.floor((expiryTime - indexedTime) / 86_400_000));
  const expiryDays = Math.max(0, Math.floor((expiryTime - Date.now()) / 86_400_000));

  // APR: annualize the return over the position duration
  const apr = committedUsd > 0 ? (premiumUsd / committedUsd) * (365 / totalDays) * 100 : 0;

  // Yield metric display
  const yieldValue = yieldMetric === "apr" ? apr : returnPct;
  const yieldLabel = yieldMetric === "apr" ? "APR" : "ROI";

  const canSettle = isActive && position.vault_id != null && position.otoken_address != null;

  const [settling, setSettling] = useState(false);
  const [settleResult, setSettleResult] = useState<SettleResult | null>(null);
  const [settleError, setSettleError] = useState<string | null>(null);

  async function handleSettle(forceItm: boolean) {
    if (!canSettle) return;
    setSettling(true);
    setSettleError(null);
    try {
      const result = await api.demoSettle(
        position.user_address,
        position.vault_id!,
        position.otoken_address!,
        forceItm,
      );
      setSettleResult(result);
      onSettled?.();
      window.dispatchEvent(new Event("balance:refetch"));
    } catch (err) {
      console.error("[PositionCard] Settle failed:", err);
      setSettleError(err instanceof Error ? err.message : "Settlement failed");
    } finally {
      setSettling(false);
    }
  }

  // Settled state (from backend or from just-settled result)
  const isSettled = position.is_settled || settleResult?.settled;
  const isItm = position.is_itm ?? settleResult?.is_itm ?? false;
  const expiryPrice = position.expiry_price ?? settleResult?.expiry_price ?? null;
  const expiryPriceDisplay = expiryPrice != null
    ? `$${(expiryPrice / 1e8).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
    : null;

  // Cost basis for ITM assigned positions
  // Put assigned: user bought ETH → cost basis = strike - premium per ETH
  // Call assigned: user sold ETH → effective sale price = strike + premium per ETH
  const premiumPerEth = ethAmount > 0 ? premiumUsd / ethAmount : 0;
  const costBasis = isBuy ? strike - premiumPerEth : strike + premiumPerEth;

  // Unrealized gain for ITM: compare current spot to cost basis
  const unrealizedPerEth = spot != null
    ? isBuy
      ? spot - costBasis   // bought ETH: gain if spot > cost basis
      : costBasis - spot   // sold ETH: gain if cost basis > spot (already realized)
    : null;
  const unrealizedPct = unrealizedPerEth != null && costBasis > 0
    ? (unrealizedPerEth / costBasis) * 100
    : null;
  const unrealizedTotal = unrealizedPerEth != null ? unrealizedPerEth * ethAmount : null;

  // CTA link helpers
  const nextSide = isBuy ? "sell" : "buy";
  const sameSide = isBuy ? "buy" : "sell";
  const ctaEarnHref = (side: string) => `${earnBase}?side=${side}`;

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-5 space-y-3">
      {/* ── ACTIVE POSITION ── */}
      {isActive && !settleResult && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between">
            <p className="text-base font-semibold text-[var(--bone)]">
              {isBuy ? "Buy" : "Sell"} ETH at <span className="font-mono">${strike.toLocaleString()}</span>/ETH
            </p>
            {optimistic && (
              <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)]">
                <span className="h-2 w-2 rounded-full bg-[var(--accent)] animate-pulse" />
                Confirming...
              </span>
            )}
          </div>

          {/* Countdown — prominent */}
          <p className="text-lg font-bold text-[var(--bone)]">
            {expiryDays > 1
              ? `${expiryDays}d left`
              : expiryDays === 1
                ? "Expires tomorrow"
                : "Expires today"}
          </p>

          {/* Premium earned — accent + mono */}
          <p className="text-base font-bold font-mono text-[var(--accent)]">
            ${premiumUsd.toFixed(0)} earned
            <span className="text-sm font-normal text-[var(--text-secondary)] ml-2">
              {yieldValue < 10 ? yieldValue.toFixed(1) : Math.round(yieldValue)}% {yieldLabel}
            </span>
          </p>

          {/* Full-width distance bar */}
          {spot && (
            <DistanceIndicator
              strike={strike}
              spot={spot}
              isPut={isBuy}
              isSettled={false}
              size="full"
            />
          )}

          <p className="text-xs text-[var(--text-secondary)]">
            Committed {committedDisplay}
          </p>
        </>
      )}

      {/* ── SETTLED: OTM — No trade ── */}
      {isSettled && !isItm && (
        <div className="space-y-3">
          {/* Badge */}
          <div className="flex items-center justify-between">
            <p className="text-base font-semibold text-[var(--bone)]">
              {isBuy ? "Buy" : "Sell"} ETH at <span className="font-mono">${strike.toLocaleString()}</span>/ETH
            </p>
            <span className="text-xs font-medium text-[var(--accent)] bg-[var(--accent)]/10 px-2 py-0.5 rounded-full">
              Earned
            </span>
          </div>

          {/* Two clear lines */}
          <p className="text-sm text-[var(--text)]">
            Your price wasn&apos;t reached. No trade.
          </p>
          <p className="text-sm text-[var(--text-secondary)]">
            Committed {committedDisplay} → Returned {committedDisplay} +{" "}
            <span className="text-[var(--accent)] font-semibold font-mono">${premiumUsd.toFixed(0)} earned</span>
          </p>

          <p className="text-xs text-[var(--text-secondary)]">
            {expiryPriceDisplay && <>Closed at {expiryPriceDisplay}/ETH · </>}
            {returnPct.toFixed(1)}% in {totalDays}d · {yieldValue < 10 ? yieldValue.toFixed(1) : Math.round(yieldValue)}% {yieldLabel}
          </p>

          {/* CTA: Earn again */}
          <Link
            href={ctaEarnHref(sameSide)}
            className="block w-full text-center rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 py-3 text-sm font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/20 transition-colors"
          >
            Earn again
          </Link>
        </div>
      )}

      {/* ── SETTLED: ITM — Assigned ── */}
      {isSettled && isItm && (
        <div className="space-y-3">
          {/* Badge — positive framing */}
          <div className="flex items-center justify-between">
            <p className="text-base font-semibold text-[var(--bone)]">
              {isBuy ? "Bought" : "Sold"} <span className="font-mono">{ethAmountDisplay}</span> ETH
            </p>
            <span className="text-xs font-medium text-[var(--accent)] bg-[var(--accent)]/10 px-2 py-0.5 rounded-full">
              Assigned
            </span>
          </div>

          {/* Cost basis */}
          <div className="space-y-1">
            <p className="text-sm text-[var(--text)]">
              {isBuy
                ? `You bought ETH at $${costBasis.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                : `You sold ETH at $${costBasis.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            </p>
            <p className="text-xs text-[var(--text-secondary)]">
              Strike ${strike.toLocaleString()} {isBuy ? "−" : "+"} premium ${premiumPerEth.toLocaleString(undefined, { maximumFractionDigits: 0 })}/ETH = cost basis ${costBasis.toLocaleString(undefined, { maximumFractionDigits: 0 })}/ETH
            </p>
          </div>

          {/* Unrealized gain/loss — live with spot */}
          {unrealizedPerEth != null && spot != null && (
            <div className={`rounded-xl px-4 py-3 ${unrealizedPerEth >= 0 ? "bg-[var(--accent)]/10" : "bg-[var(--danger)]/10"}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--text-secondary)]">
                  {isBuy ? "Unrealized gain" : "Realized gain"}
                </span>
                <span className={`text-base font-bold font-mono ${unrealizedPerEth >= 0 ? "text-[var(--accent)]" : "text-[var(--danger)]"}`}>
                  {unrealizedPerEth >= 0 ? "+" : ""}${(unrealizedTotal ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>
              <div className="flex items-center justify-between mt-0.5">
                <span className="text-xs text-[var(--text-secondary)]">
                  ETH now: ${spot.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
                {unrealizedPct != null && (
                <span className={`text-xs font-mono ${unrealizedPerEth >= 0 ? "text-[var(--accent)]" : "text-[var(--danger)]"}`}>
                  {unrealizedPerEth >= 0 ? "+" : ""}{unrealizedPct.toFixed(1)}%/ETH
                </span>
                )}
              </div>
            </div>
          )}

          {/* Premium kept */}
          <p className="text-sm text-[var(--text-secondary)]">
            + kept{" "}
            <span className="text-[var(--accent)] font-semibold font-mono">${premiumUsd.toFixed(0)} in premium</span>
          </p>

          {/* CTA: Next step */}
          <Link
            href={ctaEarnHref(nextSide)}
            className="block w-full text-center rounded-xl bg-[var(--accent)] py-3.5 text-sm font-semibold text-[var(--bg)] hover:bg-[var(--accent-hover)] transition-colors"
          >
            {isBuy
              ? "Earn more: sell ETH at a higher price"
              : "Earn more: buy ETH at a lower price"}
          </Link>
        </div>
      )}

      {/* Extra visual slot (V2 sparklines) */}
      {renderExtra?.(position, strike)}

      {settleError && (
        <p className="text-sm text-[var(--danger)]">{settleError}</p>
      )}

      {canSettle && !settleResult && (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleSettle(false)}
            disabled={settling}
            className="rounded-xl bg-[var(--surface)] border border-[var(--border)] py-2.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--border)] disabled:opacity-40 transition-colors"
          >
            {settling ? "Settling..." : "Demo: No trade"}
          </button>
          <button
            onClick={() => handleSettle(true)}
            disabled={settling}
            className="rounded-xl bg-[var(--surface)] border border-[var(--border)] py-2.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--border)] disabled:opacity-40 transition-colors"
          >
            {settling ? "Settling..." : isBuy ? "Demo: Buy ETH" : "Demo: Sell ETH"}
          </button>
        </div>
      )}
    </div>
  );
}
