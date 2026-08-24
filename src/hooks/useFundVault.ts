"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Address } from "viem";
import type {
  FundConfigResponse,
  FundFreshnessBounds,
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

export const FUND_REFRESH_INTERVAL_MS = 30_000;
export const FUND_CONFIG_CACHE_TTL_MS = 5 * 60_000;
const FUND_OPERATION_POLL_INTERVAL_MS = 3_000;
const FUND_OPERATION_TIMEOUT_MS = 120_000;

export type FundVaultSnapshot = {
  summary: FundSummaryResponse;
  position: FundPositionResponse | null;
  config: FundConfigResponse;
};

export type FundVaultState = {
  summary: FundSummaryResponse | null;
  position: FundPositionResponse | null;
  config: FundConfigResponse | null;
  loading: boolean;
  error: string | null;
  trustError: string | null;
  refetch: (freshness?: FundFreshnessBounds) => Promise<FundVaultSnapshot | void>;
};

export function useFundVault(
  address: Address | undefined,
  deployment: TrustedFundDeployment = BASE_SEPOLIA_CSP_FUND,
): FundVaultState {
  const [summary, setSummary] = useState<FundSummaryResponse | null>(null);
  const [position, setPosition] = useState<FundPositionResponse | null>(null);
  const [config, setConfig] = useState<FundConfigResponse | null>(null);
  const configRef = useRef<FundConfigResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState<{
    pollKey: string;
    message: string | null;
  } | null>(null);
  const snapshotKeyRef = useRef<string | null>(null);
  const requestEpochRef = useRef(0);
  const acceptedSnapshotRef = useRef<{
    pollKey: string;
    generation: number;
    block: number;
    blockHash: string | null;
  } | null>(null);
  const operationIdRef = useRef(0);
  const activeOperationRef = useRef<{ id: number; pollKey: string } | null>(null);
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

  const requestSnapshot = useCallback(async (
    freshness?: FundFreshnessBounds,
    signal?: AbortSignal,
  ) => {
    if (!fundKey || !fundAddress) throw new Error("Fund allowlist is not configured.");
    if (freshness && !configRef.current) {
      throw new Error("Fund configuration is not loaded.");
    }
    const [nextSummary, nextConfig, nextPosition] = await Promise.all([
      api.getFund(fundKey, freshness, signal),
      freshness
        ? Promise.resolve(configRef.current!)
        : sharedRequest(
            `fund-config:${fundKey}:${fundAddress}`,
            FUND_CONFIG_CACHE_TTL_MS,
            () => api.getFundConfig(fundKey),
          ),
      address ? api.getFundPosition(fundKey, address, freshness, signal) : null,
    ]);
    if (nextPosition && !fundSnapshotsAreCoherent(nextSummary, nextPosition)) {
      throw new Error("Backend fund snapshot is not coherent yet.");
    }
    return { nextSummary, nextConfig, nextPosition };
  }, [address, fundAddress, fundKey]);

  const applySnapshot = useCallback((
    snapshot: Awaited<ReturnType<typeof requestSnapshot>>,
  ): boolean => {
    const generation = Number.isSafeInteger(snapshot.nextSummary.generation)
      ? snapshot.nextSummary.generation
      : -1;
    const block = Number.isSafeInteger(snapshot.nextSummary.asOfBlock)
      ? snapshot.nextSummary.asOfBlock!
      : -1;
    const blockHash = snapshot.nextSummary.asOfBlockHash?.toLowerCase() ?? null;
    const accepted = acceptedSnapshotRef.current;
    if (
      accepted?.pollKey === pollKey &&
      (
        generation < accepted.generation ||
        block < accepted.block ||
        (
          generation === accepted.generation &&
          block === accepted.block &&
          accepted.blockHash !== null &&
          blockHash !== null &&
          blockHash !== accepted.blockHash
        )
      )
    ) return false;

    acceptedSnapshotRef.current = { pollKey, generation, block, blockHash };
    setSummary(snapshot.nextSummary);
    configRef.current = snapshot.nextConfig;
    setConfig(snapshot.nextConfig);
    setPosition(snapshot.nextPosition);
    snapshotKeyRef.current = pollKey;
    setSnapshotKey(pollKey);
    setErrorState({ pollKey, message: null });
    return true;
  }, [pollKey]);

  const fetchFund = useCallback(async () => {
    if (activeOperationRef.current?.pollKey === pollKey) return;
    const generation = requestGeneration.capture();
    const requestEpoch = requestEpochRef.current;
    if (snapshotKeyRef.current !== pollKey) setLoading(true);
    try {
      const snapshot = await requestSnapshot();
      if (
        requestGeneration.isCurrent(generation) &&
        requestEpochRef.current === requestEpoch
      ) applySnapshot(snapshot);
    } catch (cause) {
      if (
        !requestGeneration.isCurrent(generation) ||
        requestEpochRef.current !== requestEpoch
      ) return;
      if (snapshotKeyRef.current !== pollKey) {
        setSummary(null);
        configRef.current = null;
        setConfig(null);
        setPosition(null);
        snapshotKeyRef.current = pollKey;
        setSnapshotKey(pollKey);
      }
      setErrorState({
        pollKey,
        message: cause instanceof Error ? cause.message : "Could not refresh fund data.",
      });
    } finally {
      if (requestGeneration.isCurrent(generation)) setLoading(false);
    }
  }, [applySnapshot, pollKey, requestGeneration, requestSnapshot]);

  const { refreshNow } = useVisibilityPolling({
    refresh: fetchFund,
    enabled,
    pollKey,
    intervalMs: FUND_REFRESH_INTERVAL_MS,
    staleTimeMs: FUND_REFRESH_INTERVAL_MS,
  });
  const refetch = useCallback(async (freshness?: FundFreshnessBounds) => {
    if (!freshness) return refreshNow();
    const operation = { id: ++operationIdRef.current, pollKey };
    requestEpochRef.current += 1;
    const generation = requestGeneration.capture();
    activeOperationRef.current = operation;
    const deadline = Date.now() + FUND_OPERATION_TIMEOUT_MS;
    try {
      while (Date.now() < deadline) {
        if (activeOperationRef.current?.id !== operation.id) {
          throw new Error("A newer fund refresh replaced this operation.");
        }
        if (!requestGeneration.isCurrent(generation)) {
          throw new Error("Fund context changed while waiting for Backend.");
        }
        if (document.visibilityState !== "hidden") {
          const controller = new AbortController();
          const abortTimer = window.setTimeout(
            () => controller.abort(),
            deadline - Date.now(),
          );
          const snapshot = await requestSnapshot(freshness, controller.signal)
            .catch(() => null)
            .finally(() => window.clearTimeout(abortTimer));
          if (!requestGeneration.isCurrent(generation)) {
            throw new Error("Fund context changed while waiting for Backend.");
          }
          if (activeOperationRef.current?.id !== operation.id) {
            throw new Error("A newer fund refresh replaced this operation.");
          }
          if (
            snapshot &&
            fundSnapshotMeetsBounds(snapshot.nextSummary, freshness) &&
            (!snapshot.nextPosition || fundSnapshotMeetsBounds(snapshot.nextPosition, freshness))
          ) {
            if (applySnapshot(snapshot)) {
              return {
                summary: snapshot.nextSummary,
                position: snapshot.nextPosition,
                config: snapshot.nextConfig,
              };
            }
          }
        }
        const remaining = deadline - Date.now();
        if (remaining <= 0) break;
        await new Promise((resolve) => window.setTimeout(
          resolve,
          Math.min(FUND_OPERATION_POLL_INTERVAL_MS, remaining),
        ));
      }
      throw new Error("Transaction confirmed. Fund update is still pending.");
    } finally {
      if (activeOperationRef.current?.id === operation.id) {
        activeOperationRef.current = null;
      }
    }
  }, [applySnapshot, pollKey, refreshNow, requestGeneration, requestSnapshot]);
  useEffect(
    () => subscribeDataInvalidation("vault", () => void refreshNow()),
    [refreshNow],
  );
  useEffect(() => {
    if (enabled) return;
    setSummary(null);
    acceptedSnapshotRef.current = null;
    configRef.current = null;
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
    refetch,
  };
}

function fundSnapshotsAreCoherent(
  summary: Pick<FundSummaryResponse, "generation" | "asOfBlock" | "asOfBlockHash">,
  position: Pick<FundPositionResponse, "generation" | "asOfBlock" | "asOfBlockHash">,
): boolean {
  return summary.generation === position.generation &&
    summary.asOfBlock === position.asOfBlock &&
    summary.asOfBlockHash?.toLowerCase() === position.asOfBlockHash?.toLowerCase();
}

function fundSnapshotMeetsBounds(
  snapshot: Pick<FundSummaryResponse, "generation" | "asOfBlock" | "asOfBlockHash">,
  bounds: FundFreshnessBounds,
): boolean {
  if (
    snapshot.generation < bounds.minGeneration ||
    snapshot.asOfBlock === null ||
    snapshot.asOfBlockHash === null
  ) return false;
  if (snapshot.asOfBlock < bounds.minBlock) return false;
  return snapshot.asOfBlock !== bounds.minBlock ||
    snapshot.asOfBlockHash?.toLowerCase() === bounds.minBlockHash.toLowerCase();
}
