"use client";

import { useState, useEffect } from "react";
import { api, type BatchStatus } from "@/lib/api";

export function BatchTimer() {
  const [status, setStatus] = useState<BatchStatus | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setStatus(await api.getBatchStatus());
      } catch {}
    };
    load();
    const id = setInterval(load, 10_000);
    return () => clearInterval(id);
  }, []);

  const [countdown, setCountdown] = useState("");

  useEffect(() => {
    if (!status) return;
    const tick = () => {
      const intervalMs = status.batch_interval_minutes * 60 * 1000;
      const lastBatch = status.last_batch_at
        ? new Date(status.last_batch_at).getTime()
        : Date.now();
      const nextBatch = lastBatch + intervalMs;
      const remaining = Math.max(0, nextBatch - Date.now());
      const mins = Math.floor(remaining / 60_000);
      const secs = Math.floor((remaining % 60_000) / 1000);
      setCountdown(`${mins}:${secs.toString().padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [status]);

  if (!status) return null;

  return (
    <div className="flex items-center gap-4 rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-4">
      <div className="flex-1">
        <p className="text-sm text-[var(--muted)]">Next batch settlement</p>
        <p className="text-2xl font-mono font-bold">{countdown}</p>
      </div>
      <div className="text-right">
        <p className="text-sm text-[var(--muted)]">Pending orders</p>
        <p className="text-2xl font-bold">{status.pending_orders}</p>
      </div>
      {status.circuit_breaker.is_paused && (
        <div className="rounded-lg bg-[var(--danger)] px-3 py-1 text-sm font-medium">
          PAUSED: {status.circuit_breaker.pause_reason}
        </div>
      )}
    </div>
  );
}
