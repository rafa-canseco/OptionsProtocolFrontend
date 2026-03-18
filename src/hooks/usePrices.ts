"use client";

import { useState, useEffect, useCallback } from "react";
import { api, type PriceQuote } from "@/lib/api";

export function usePrices(asset?: string, pollInterval = 10_000) {
  const [prices, setPrices] = useState<PriceQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await api.getPrices(asset);
      setPrices(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch prices");
    } finally {
      setLoading(false);
    }
  }, [asset]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, pollInterval);
    return () => clearInterval(id);
  }, [refresh, pollInterval]);

  return { prices, loading, error, refresh };
}
