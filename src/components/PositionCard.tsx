"use client";

import type { Position } from "@/lib/api";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-900/50 text-yellow-400",
  batched: "bg-blue-900/50 text-blue-400",
  settled: "bg-green-900/50 text-green-400",
  expired: "bg-[var(--card)] text-[var(--muted)]",
  failed: "bg-red-900/50 text-red-400",
};

export function PositionCard({ position }: { position: Position }) {
  const isCall = position.option_type === "call";

  return (
    <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className={`rounded px-2 py-0.5 text-xs font-bold uppercase ${
              isCall ? "bg-green-900/50 text-green-400" : "bg-red-900/50 text-red-400"
            }`}
          >
            {position.option_type}
          </span>
          <span className="font-mono text-sm">${position.strike.toLocaleString()}</span>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[position.status] || ""}`}>
          {position.status}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 text-sm">
        <div>
          <p className="text-xs text-[var(--muted)]">Premium</p>
          <p className="font-mono">${position.premium.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-xs text-[var(--muted)]">Expiry</p>
          <p className="font-mono">{position.expiry_days}d</p>
        </div>
        <div>
          <p className="text-xs text-[var(--muted)]">Spot at Lock</p>
          <p className="font-mono">${position.spot_at_lock.toLocaleString()}</p>
        </div>
      </div>

      {position.tx_hash && (
        <a
          href={`https://sepolia.basescan.org/tx/${position.tx_hash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 block text-xs text-[var(--accent)] hover:underline"
        >
          View tx {position.tx_hash.slice(0, 10)}...
        </a>
      )}

      <p className="mt-2 text-xs text-[var(--muted)]">
        {new Date(position.created_at).toLocaleString()}
      </p>
    </div>
  );
}
