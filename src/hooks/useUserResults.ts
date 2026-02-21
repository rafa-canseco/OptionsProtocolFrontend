"use client";

import { useState, useEffect } from "react";
import { api, type UserWeeklyResult, type UserStats } from "@/lib/api";

export function useUserResults(address: string | undefined) {
  const [weeklyResult, setWeeklyResult] = useState<UserWeeklyResult | null>(
    null,
  );
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) {
      setWeeklyResult(null);
      setStats(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    Promise.all([
      api.getUserWeeklyResult(address),
      api.getUserStats(address),
    ])
      .then(([weekly, userStats]) => {
        if (cancelled) return;
        setWeeklyResult(weekly);
        setStats(userStats);
        setError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to fetch results");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [address]);

  return { weeklyResult, stats, loading, error };
}
