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

  // Expiry
  const expiryDays = Math.max(0, Math.ceil((position.expiry * 1000 - Date.now()) / 86_400_000));

  const canSettle = isActive && position.vault_id != null && position.otoken_address != null;

  const [settling, setSettling] = useState(false);
  const [settleResult, setSettleResult] = useState<SettleResult | null>(null);
  const [settleError, setSettleError] = useState<string | null>(null);

  async function handleSettle() {
    if (!canSettle) return;
    setSettling(true);
    setSettleError(null);
    try {
      const result = await api.demoSettle(
        position.user_address,
        position.vault_id!,
        position.otoken_address!,
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

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-5 space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-base font-semibold text-[var(--text)]">
          {isBuy ? "Buy" : "Sell"} ETH at ${strike.toLocaleString()}/ETH
        </p>
        {isSettled && (
          <span className="text-xs font-medium text-[var(--accent)] bg-[var(--accent)]/10 px-2 py-0.5 rounded-full">
            ✓ Completed
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
            ({returnPct.toFixed(1)}%)
          </p>
          <p className="text-xs text-[var(--text-secondary)]">
            {expiryDays > 0 ? `${expiryDays}d left` : "Expired"}
          </p>
        </>
      )}

      {/* Settled — OTM */}
      {isSettled && !isItm && (
        <div className="space-y-1">
          <p className="text-sm text-[var(--text-secondary)]">
            {committedDisplay} returned +{" "}
            <span className="text-[var(--accent)] font-semibold">${premiumUsd.toFixed(0)} earned</span>
          </p>
          <p className="text-xs text-[var(--text-secondary)]">
            Return: {returnPct.toFixed(1)}%
          </p>
        </div>
      )}

      {/* Settled — ITM */}
      {isSettled && isItm && (
        <div className="space-y-1">
          <p className="text-sm text-[var(--text-secondary)]">
            {isBuy
              ? `Bought ${ethAmount} ETH @ $${strike.toLocaleString()} + kept $${premiumUsd.toFixed(0)}`
              : `Sold ${ethAmount} ETH @ $${strike.toLocaleString()} + kept $${premiumUsd.toFixed(0)}`}
          </p>
          <p className="text-xs text-[var(--text-secondary)]">
            {isBuy ? `Cost basis: $${strike.toLocaleString()}/ETH` : `Sale price: $${strike.toLocaleString()}/ETH`}
          </p>
        </div>
      )}

      {settleError && (
        <p className="text-sm text-[var(--danger)]">{settleError}</p>
      )}

      {canSettle && !settleResult && (
        <button
          onClick={handleSettle}
          disabled={settling}
          className="w-full rounded-xl bg-[var(--surface)] border border-[var(--border)] py-2.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--border)] disabled:opacity-40 transition-colors"
        >
          {settling ? "Settling..." : "Settle Now"}
        </button>
      )}
    </div>
  );
}
