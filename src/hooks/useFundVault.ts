"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Address } from "viem";
import type {
  FundConfigResponse,
  FundPositionResponse,
  FundSummaryResponse,
} from "@/lib/api";
import { api } from "@/lib/api";
import { subscribeDataInvalidation } from "@/lib/dataInvalidation";
import { sharedRequest } from "@/lib/sharedRequest";
import { useVisibilityPolling } from "@/hooks/useVisibilityPolling";
import { useRequestGeneration } from "@/hooks/useRequestGeneration";
import {
  configuredFundAddress,
  configuredFundKey,
  fundTrustError,
} from "@/lib/fundVault";
import {
  BASE_SEPOLIA_CSP_FUND,
  type TrustedFundDeployment,
} from "@/lib/fundDeployment";

const FUND_REFRESH_INTERVAL_MS = 5_000;
const FUND_CONFIG_CACHE_TTL_MS = 5 * 60_000;

export type FundVaultState = {
  summary: FundSummaryResponse | null;
  position: FundPositionResponse | null;
  config: FundConfigResponse | null;
  loading: boolean;
  error: string | null;
  trustError: string | null;
  refetch: () => Promise<void>;
};

export function useFundVault(
  address: Address | undefined,
  deployment: TrustedFundDeployment = BASE_SEPOLIA_CSP_FUND,
): FundVaultState {
  const [summary, setSummary] = useState<FundSummaryResponse | null>(null);
  const [position, setPosition] = useState<FundPositionResponse | null>(null);
  const [config, setConfig] = useState<FundConfigResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState<{
    pollKey: string;
    message: string | null;
  } | null>(null);
  const snapshotKeyRef = useRef<string | null>(null);
  const [snapshotKey, setSnapshotKey] = useState<string | null>(null);
  const fundKey = configuredFundKey(deployment);
  const fundAddress = configuredFundAddress(deployment);
  const enabled = Boolean(fundKey && fundAddress);
  const pollKey = [
    fundKey ?? "unconfigured",
    fundAddress ?? "unconfigured",
    address ?? "anonymous",
  ].join(":");
  const requestGeneration = useRequestGeneration(pollKey);

  const fetchFund = useCallback(async () => {
    const generation = requestGeneration.capture();
    if (!fundKey || !fundAddress) {
      if (!requestGeneration.isCurrent(generation)) return;
      setErrorState({
        pollKey,
        message: "Fund allowlist is not configured.",
      });
      setLoading(false);
      return;
    }
    if (snapshotKeyRef.current !== pollKey) setLoading(true);
    try {
      const [nextSummary, nextConfig, nextPosition] = await Promise.all([
        api.getFund(fundKey),
        sharedRequest(
          `fund-config:${fundKey}:${fundAddress}`,
          FUND_CONFIG_CACHE_TTL_MS,
          () => api.getFundConfig(fundKey),
        ),
        address ? api.getFundPosition(fundKey, address) : null,
      ]);
      if (!requestGeneration.isCurrent(generation)) return;
      setSummary(nextSummary);
      setConfig(nextConfig);
      setPosition(nextPosition);
      snapshotKeyRef.current = pollKey;
      setSnapshotKey(pollKey);
      setErrorState({ pollKey, message: null });
    } catch (cause) {
      if (!requestGeneration.isCurrent(generation)) return;
      if (snapshotKeyRef.current !== pollKey) {
        setSummary(null);
        setConfig(null);
        setPosition(null);
        snapshotKeyRef.current = pollKey;
        setSnapshotKey(pollKey);
      }
      setErrorState({
        pollKey,
        message:
          cause instanceof Error
            ? cause.message
            : "Could not refresh fund data.",
      });
    } finally {
      if (requestGeneration.isCurrent(generation)) setLoading(false);
    }
  }, [address, fundAddress, fundKey, pollKey, requestGeneration]);

  const { refreshNow } = useVisibilityPolling({
    refresh: fetchFund,
    enabled,
    pollKey,
    intervalMs: FUND_REFRESH_INTERVAL_MS,
    staleTimeMs: FUND_REFRESH_INTERVAL_MS,
  });
  useEffect(
    () => subscribeDataInvalidation("vault", () => void refreshNow()),
    [refreshNow],
  );
  useEffect(() => {
    if (enabled) return;
    setSummary(null);
    setConfig(null);
    setPosition(null);
    snapshotKeyRef.current = pollKey;
    setSnapshotKey(pollKey);
    setErrorState({
      pollKey,
      message: "Fund allowlist is not configured.",
    });
    setLoading(false);
  }, [enabled, pollKey]);

  const snapshotIsCurrent = snapshotKey === pollKey;
  const currentSummary = snapshotIsCurrent ? summary : null;
  const currentPosition = snapshotIsCurrent ? position : null;
  const currentConfig = snapshotIsCurrent ? config : null;
  const trustError = currentSummary && currentConfig
    ? fundTrustError(
        currentSummary,
        currentConfig,
        currentPosition,
        address,
        deployment,
      )
    : null;
  return {
    summary: currentSummary,
    position: currentPosition,
    config: currentConfig,
    loading: enabled ? !snapshotIsCurrent || loading : false,
    error: errorState?.pollKey === pollKey ? errorState.message : null,
    trustError,
    refetch: refreshNow,
  };
}
