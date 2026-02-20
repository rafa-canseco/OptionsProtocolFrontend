"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api, type Position } from "@/lib/api";

export function usePositions(address: string | undefined, pollInterval = 15_000) {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountTime = useRef(Date.now());

  const refresh = useCallback(async () => {
    if (!address) {
      setPositions([]);
      setLoading(false);
      return;
    }
    try {
      const data = await api.getPositions(address);
      setPositions(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch positions");
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    refresh();
    if (!address) return;

    // Poll faster for the first 30s after mount (new position may still be indexing)
    const fastPoll = setInterval(refresh, 3_000);
    const stopFastPoll = setTimeout(() => clearInterval(fastPoll), 30_000);

    const slowPoll = setInterval(refresh, pollInterval);

    return () => {
      clearInterval(fastPoll);
      clearTimeout(stopFastPoll);
      clearInterval(slowPoll);
    };
  }, [refresh, address, pollInterval]);

  // Re-fetch when a transaction completes (AcceptModal dispatches this)
  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener("balance:refetch", handler);
    return () => window.removeEventListener("balance:refetch", handler);
  }, [refresh]);

  return { positions, loading, error, refresh };
}
