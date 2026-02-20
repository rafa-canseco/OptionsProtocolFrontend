"use client";

import { useState } from "react";
import type { Position, SettleResult } from "@/lib/api";
import { api } from "@/lib/api";
import { ExpiryCountdown } from "./ExpiryCountdown";

function ProgressBar({ createdAt, expiryDays }: { createdAt: string; expiryDays: number }) {
  const start = new Date(createdAt).getTime();
  const end = start + expiryDays * 86_400_000;
  const now = Date.now();
  const progress = Math.min(1, Math.max(0, (now - start) / (end - start)));

  return (
    <div className="h-1.5 w-full rounded-full bg-[var(--border)]">
      <div
        className="h-full rounded-full bg-[var(--accent)] transition-all"
        style={{ width: `${progress * 100}%` }}
      />
    </div>
  );
}

function SettleResultDisplay({ result, isPut }: { result: SettleResult; isPut: boolean }) {
  if (!result.settled) {
    return <p className="text-sm text-[var(--danger)]">Settlement failed.</p>;
  }

  if (result.is_itm) {
    const asset = result.delivered_asset === "ETH" || !isPut ? "ETH" : "USD";
    const amount = result.delivered_amount ?? 0;
    const formatted = asset === "USD"
      ? `$${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
      : `${amount.toFixed(4)} ETH`;
    return (
      <p className="text-sm text-[var(--accent)]">
        In the money — received {formatted}
      </p>
    );
  }

  return (
    <p className="text-sm text-[var(--accent)]">
      Out of the money — collateral returned
    </p>
  );
}

interface Props {
  position: Position;
  onSettled?: () => void;
}

export function PositionCard({ position, onSettled }: Props) {
  const isBuy = position.option_type === "put";
  const isActive = position.status === "pending" || position.status === "batched";
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

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-5 space-y-3">
      <p className="text-base font-semibold text-[var(--text)]">
        {isBuy ? "Buy" : "Sell"} ETH at ${position.strike.toLocaleString()}
      </p>

      <p className="text-sm text-[var(--text-secondary)]">
        <span className="text-[var(--accent)] font-semibold">Earned ${position.premium.toFixed(0)}</span>
        {isActive && (
          <>
            {" · "}
            <ExpiryCountdown createdAt={position.created_at} expiryDays={position.expiry_days} />
            {" left"}
          </>
        )}
      </p>

      {isActive && <ProgressBar createdAt={position.created_at} expiryDays={position.expiry_days} />}

      {settleResult && (
        <SettleResultDisplay result={settleResult} isPut={position.option_type === "put"} />
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
