"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Address } from "viem";
import type {
  FundConfigResponse,
  FundPositionResponse,
  FundSummaryResponse,
} from "@/lib/api";
import { api } from "@/lib/api";
import { FUND_ADDRESS, FUND_KEY, fundTrustError } from "@/lib/fundVault";

const FUND_REFRESH_INTERVAL_MS = 5_000;

export type FundVaultState = {
  summary: FundSummaryResponse | null;
  position: FundPositionResponse | null;
  config: FundConfigResponse | null;
  loading: boolean;
  error: string | null;
  trustError: string | null;
  refetch: () => Promise<void>;
};

export function useFundVault(address: Address | undefined): FundVaultState {
  const [summary, setSummary] = useState<FundSummaryResponse | null>(null);
  const [position, setPosition] = useState<FundPositionResponse | null>(null);
  const [config, setConfig] = useState<FundConfigResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const refetch = useCallback(async () => {
    const nextRequestId = ++requestId.current;
    if (!FUND_KEY || !FUND_ADDRESS) {
      setError("CSP fund allowlist is not configured.");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [nextSummary, nextConfig, nextPosition] = await Promise.all([
        api.getFund(FUND_KEY),
        api.getFundConfig(FUND_KEY),
        address ? api.getFundPosition(FUND_KEY, address) : null,
      ]);
      if (requestId.current !== nextRequestId) return;
      setSummary(nextSummary);
      setConfig(nextConfig);
      setPosition(nextPosition);
      setError(null);
    } catch (cause) {
      if (requestId.current !== nextRequestId) return;
      setError(cause instanceof Error ? cause.message : "Could not refresh fund data.");
    } finally {
      if (requestId.current === nextRequestId) setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useEffect(() => {
    const handleFocus = () => void refetch();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void refetch();
    };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [refetch]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refetch();
    }, FUND_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [refetch]);

  const trustError = summary && config
    ? fundTrustError(summary, config, position, address)
    : null;
  return { summary, position, config, loading, error, trustError, refetch };
}
