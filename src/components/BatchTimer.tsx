"use client";

import { useState, useEffect } from "react";
import { api, type BatchStatus } from "@/lib/api";

export function BatchTimer() {
  const [status, setStatus] = useState<BatchStatus | null>(null);
  const [countdown, setCountdown] = useState("");

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

  if (status.circuit_breaker.is_paused) {
    return (
      <p className="text-center text-sm text-[var(--text-secondary)]">
        Prices are updating. Check back shortly.
      </p>
    );
  }

  if (status.pending_orders === 0) return null;

  return (
    <p className="text-center text-sm text-[var(--text-secondary)]">
      {status.pending_orders} order{status.pending_orders !== 1 ? "s" : ""} settling in{" "}
      <span className="font-medium text-[var(--text)]">{countdown}</span>
    </p>
  );
}
