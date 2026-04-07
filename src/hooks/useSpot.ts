"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

export function useSpot(asset: string, pollInterval = 10_000) {
  const [spot, setSpot] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.getSpot(asset);
      setSpot(data.spot);
    } catch (err) {
      console.error(`[useSpot] Failed to fetch ${asset} spot price:`, err);
    } finally {
      setLoading(false);
    }
  }, [asset]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, pollInterval);
    return () => clearInterval(id);
  }, [refresh, pollInterval]);

  return { spot, loading };
}
