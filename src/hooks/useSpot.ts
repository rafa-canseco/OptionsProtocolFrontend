"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

const MARKET_PRICE_IDS: Partial<Record<string, string>> = {
  btc: "bitcoin",
  eth: "ethereum",
  sol: "solana",
};

type MarketPriceResponse = Record<string, { usd?: number }>;

async function getMarketSpot(asset: string): Promise<number | undefined> {
  const coinId = MARKET_PRICE_IDS[asset.toLowerCase()];
  if (!coinId) return undefined;

  const params = new URLSearchParams({
    ids: coinId,
    vs_currencies: "usd",
  });
  const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?${params}`);
  if (!res.ok) return undefined;

  const data = (await res.json()) as MarketPriceResponse;
  const spot = data[coinId]?.usd;
  return typeof spot === "number" && Number.isFinite(spot) ? spot : undefined;
}

export function useSpot(asset: string, pollInterval = 10_000) {
  const [spot, setSpot] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.getSpot(asset);
      setSpot(data.spot);
    } catch (err) {
      const fallbackSpot = await getMarketSpot(asset);
      if (fallbackSpot !== undefined) {
        setSpot(fallbackSpot);
      } else {
        console.error(`[useSpot] Failed to fetch ${asset} spot price:`, err);
      }
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
