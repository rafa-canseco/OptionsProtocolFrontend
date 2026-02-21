"use client";

import { useState, useEffect, useMemo } from "react";
import type { SimulateResult } from "@/lib/api";

const USE_MOCK = true; // flip to false when B1N-5 ships

/** Get the most recent Friday 08:00 UTC before now */
function lastFriday(): Date {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun .. 6=Sat
  // Days since last Friday
  const diff = (day + 2) % 7; // Fri=0, Sat=1, Sun=2, Mon=3...
  const fri = new Date(now);
  fri.setUTCDate(fri.getUTCDate() - (diff === 0 && now.getUTCHours() < 8 ? 7 : diff));
  fri.setUTCHours(8, 0, 0, 0);
  return fri;
}

/** Friday-to-Friday week label */
export function weekLabel(): string {
  const end = lastFriday();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 7);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return `${fmt(start)}–${fmt(end)}`;
}

/** Generate mock simulate result that varies by strike distance from spot */
function mockSimulate(strike: number, side: "buy" | "sell", spot: number): SimulateResult {
  const distance = side === "buy" ? (spot - strike) / spot : (strike - spot) / spot;
  const distPct = Math.max(0, Math.min(distance, 0.25));

  // Premium scales with how close the strike is to spot (higher = closer)
  const basePremium = side === "buy" ? 48 : 35;
  const premiumMultiplier = 1 + (0.15 - distPct) * 8; // closer to spot = higher premium
  const premium = Math.round(basePremium * Math.max(0.3, Math.min(premiumMultiplier, 2.5)));

  // Assignment: only if strike is very close to spot (mock: never assigned for >5% OTM)
  const wasAssigned = distPct < 0.03;

  // ETH closed somewhere near spot (slight weekly drift)
  const weekDrift = -0.023; // -2.3% mock
  const ethClose = Math.round(spot * (1 + weekDrift));
  const ethLow = Math.round(spot * (1 + weekDrift - 0.04)); // low was 4% below close

  return {
    premium_earned: premium,
    was_assigned: wasAssigned,
    eth_low_of_week: ethLow,
    eth_close: ethClose,
    comparison: {
      hold_return: weekDrift,
      stake_return: 0.0008, // ~3.5% APR / 52 weeks
      dca_return: -0.011,
    },
  };
}

export function useSimulate(strike: number | null, side: "buy" | "sell", spot: number) {
  // Mock path: synchronous via useMemo — no loading flash, no re-renders
  const mockResult = useMemo(() => {
    if (!USE_MOCK || strike === null) return null;
    return mockSimulate(strike, side, spot);
  }, [strike, side, spot]);

  // Real API path (when B1N-5 ships)
  const [apiResult, setApiResult] = useState<SimulateResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (USE_MOCK || strike === null) return;

    let cancelled = false;
    setLoading(true);

    import("@/lib/api").then(({ api }) =>
      api.simulate(strike, side)
        .then((data) => {
          if (!cancelled) {
            setApiResult(data);
            setError(null);
          }
        })
        .catch((e) => {
          if (!cancelled) setError(e instanceof Error ? e.message : "Simulation failed");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        }),
    );
    return () => { cancelled = true; };
  }, [strike, side, spot]);

  if (USE_MOCK) {
    return { result: mockResult, loading: false, error: null };
  }
  return { result: apiResult, loading, error };
}
