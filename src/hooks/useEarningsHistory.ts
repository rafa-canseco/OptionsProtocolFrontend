"use client";

import { useState, useEffect, useCallback } from "react";
import { api, type WeeklySnapshot } from "@/lib/api";

export function useEarningsHistory(address: string | undefined) {
  const [history, setHistory] = useState<WeeklySnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!address) {
      setHistory([]);
      setLoading(false);
      return;
    }
    try {
      const data = await api.getEarningsHistory(address);
      setHistory(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch earnings history");
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { history, loading, error, refresh };
}
