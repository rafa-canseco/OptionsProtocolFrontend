"use client";

import { useState, useEffect } from "react";
import { api, type Leaderboard } from "@/lib/api";

// Competition window: Mar 30 – Apr 12 2026 UTC
const COMPETITION_START = 1743292800;
const COMPETITION_END = 1744502399;

export function useLeaderboard() {
  const [data, setData] = useState<Leaderboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .getLeaderboard(COMPETITION_START, COMPETITION_END)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading, error };
}
