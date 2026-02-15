"use client";

import type { Position } from "@/lib/api";
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

export function PositionCard({ position }: { position: Position }) {
  const isBuy = position.option_type === "put";
  const isActive = position.status === "pending" || position.status === "batched";

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
    </div>
  );
}
