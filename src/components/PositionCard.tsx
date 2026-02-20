"use client";

import { useState } from "react";
import type { Position, SettleResult } from "@/lib/api";
import { api } from "@/lib/api";

interface Props {
  position: Position;
  onSettled?: () => void;
}

export function PositionCard({ position, onSettled }: Props) {
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
  const ethAmount = (position.amount / 1e8).toFixed(2);

  // Expiry: total duration from indexed_at to expiry
  const indexedTime = new Date(position.indexed_at).getTime();
  const expiryTime = position.expiry * 1000;
  const totalDays = Math.max(1, Math.round((expiryTime - indexedTime) / 86_400_000));
  const expiryDays = Math.max(0, Math.ceil((expiryTime - Date.now()) / 86_400_000));

  // APR: annualize the return over the position duration
  const apr = committedUsd > 0 ? (premiumUsd / committedUsd) * (365 / totalDays) * 100 : 0;

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

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-5 space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-base font-semibold text-[var(--text)]">
          {isBuy ? "Buy" : "Sell"} ETH at ${strike.toLocaleString()}/ETH
        </p>
        {isSettled && !isItm && (
          <span className="text-xs font-medium text-[var(--accent)] bg-[var(--accent)]/10 px-2 py-0.5 rounded-full">
            Earned
          </span>
        )}
        {isSettled && isItm && (
          <span className="text-xs font-medium text-[var(--accent)] bg-[var(--accent)]/10 px-2 py-0.5 rounded-full">
            Order filled
          </span>
        )}
      </div>

      {/* Active position */}
      {isActive && !settleResult && (
        <>
          <p className="text-sm text-[var(--text-secondary)]">
            Committed {committedDisplay} ·{" "}
            <span className="text-[var(--accent)] font-semibold">
              Earned ${premiumUsd.toFixed(0)}
            </span>{" "}
            ({Math.round(apr)}% APR)
          </p>
          <p className="text-xs text-[var(--text-secondary)]">
            {expiryDays > 0 ? `${expiryDays}d left` : "Expired"}
          </p>
        </>
      )}

      {/* No trade — price didn't reach strike */}
      {isSettled && !isItm && (
        <div className="space-y-1">
          <p className="text-sm text-[var(--text)]">
            Price didn&apos;t reach ${strike.toLocaleString()} — no trade
          </p>
          <p className="text-sm text-[var(--text-secondary)]">
            {committedDisplay} returned +{" "}
            <span className="text-[var(--accent)] font-semibold">${premiumUsd.toFixed(0)} earned</span>
          </p>
          <p className="text-xs text-[var(--text-secondary)]">
            {expiryPriceDisplay && <>Closed at {expiryPriceDisplay}/ETH · </>}
            {returnPct.toFixed(1)}% in {totalDays}d · {Math.round(apr)}% APR
          </p>
        </div>
      )}

      {/* Trade filled — price reached strike */}
      {isSettled && isItm && (
        <div className="space-y-1">
          <p className="text-sm text-[var(--text)]">
            {expiryPriceDisplay && <>Closed at {expiryPriceDisplay}/ETH — </>}
            {isBuy
              ? `you bought ${ethAmount} ETH`
              : `you sold ${ethAmount} ETH`}
          </p>
          <p className="text-sm text-[var(--text-secondary)]">
            at ${strike.toLocaleString()}/ETH + kept{" "}
            <span className="text-[var(--accent)] font-semibold">${premiumUsd.toFixed(0)} in earnings</span>
          </p>
        </div>
      )}

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
