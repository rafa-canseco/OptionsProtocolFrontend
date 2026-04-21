"use client";

import { useCallback, useEffect, useState } from "react";

const COINGECKO_IDS: Partial<Record<string, string>> = {
  eth: "ethereum",
  sol: "solana",
};

interface CoinGeckoSpotResponse {
  [coinId: string]: {
    usd?: number;
    last_updated_at?: number;
  };
}

export function useCoinGeckoSpot(asset: string, pollInterval = 30_000) {
  const [spot, setSpot] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const coinId = COINGECKO_IDS[asset];
    if (!coinId) {
      setLoading(false);
      return;
    }

    try {
      const params = new URLSearchParams({
        ids: coinId,
        vs_currencies: "usd",
        include_last_updated_at: "true",
      });
      const res = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?${params.toString()}`,
      );
      if (!res.ok) {
        throw new Error(`CoinGecko ${res.status}`);
      }

      const data = (await res.json()) as CoinGeckoSpotResponse;
      const nextSpot = data[coinId]?.usd;
      if (typeof nextSpot === "number" && Number.isFinite(nextSpot)) {
        setSpot(nextSpot);
      }
    } catch (err) {
      console.error(`[useCoinGeckoSpot] Failed to fetch ${asset}:`, err);
    } finally {
      setLoading(false);
    }
  }, [asset]);

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, pollInterval);
    return () => window.clearInterval(id);
  }, [refresh, pollInterval]);

  return { spot, loading };
}
