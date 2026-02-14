"use client";

import { useState, useEffect, useCallback } from "react";
import { api, type Position } from "@/lib/api";

export function usePositions(address: string | undefined, pollInterval = 15_000) {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    const id = setInterval(refresh, pollInterval);
    return () => clearInterval(id);
  }, [refresh, address, pollInterval]);

  return { positions, loading, error, refresh };
}
