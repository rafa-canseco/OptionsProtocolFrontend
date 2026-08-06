"use client";

import { useCallback, useRef, useState } from "react";
import { api, type PriceQuote } from "@/lib/api";
import {
  invalidateSharedRequest,
  sharedRequest,
} from "@/lib/sharedRequest";
import { useVisibilityPolling } from "@/hooks/useVisibilityPolling";
import { useRequestGeneration } from "@/hooks/useRequestGeneration";

const PRICE_REQUEST_TTL_MS = 1_000;
const EMPTY_RETRY_INTERVAL_MS = 2_000;
const EMPTY_RETRY_WINDOW_MS = 6_000;

export function usePrices(asset?: string, pollInterval = 10_000) {
  const requestKey = `prices:${asset ?? "all"}`;
  const [snapshot, setSnapshot] = useState<{
    requestKey: string;
    prices: PriceQuote[];
  }>({ requestKey, prices: [] });
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState<{
    requestKey: string;
    message: string | null;
  }>({ requestKey, message: null });
  const requestGeneration = useRequestGeneration(requestKey);
  const stateRef = useRef({ requestKey, hasData: false, retryStarted: false });
  const pollingRef = useRef({
    startFastPolling: () => {},
    stopFastPolling: () => {},
  });

  if (stateRef.current.requestKey !== requestKey) {
    stateRef.current = { requestKey, hasData: false, retryStarted: false };
  }

  const fetchPrices = useCallback(async () => {
    const generation = requestGeneration.capture();
    try {
      const data = await sharedRequest(
        requestKey,
        PRICE_REQUEST_TTL_MS,
        () => api.getPrices(asset),
      );
      if (!requestGeneration.isCurrent(generation)) return;
      setSnapshot((previous) => ({
        requestKey,
        prices:
          data.length === 0 &&
          previous.requestKey === requestKey &&
          previous.prices.length > 0
            ? previous.prices
            : data,
      }));
      if (data.length > 0) {
        stateRef.current.hasData = true;
        stateRef.current.retryStarted = false;
        pollingRef.current.stopFastPolling();
      } else if (
        !stateRef.current.hasData &&
        !stateRef.current.retryStarted
      ) {
        stateRef.current.retryStarted = true;
        pollingRef.current.startFastPolling();
      }
      setErrorState({ requestKey, message: null });
    } catch (cause) {
      if (!requestGeneration.isCurrent(generation)) return;
      setSnapshot((previous) =>
        previous.requestKey === requestKey
          ? previous
          : { requestKey, prices: [] },
      );
      setErrorState({
        requestKey,
        message:
          cause instanceof Error ? cause.message : "Failed to fetch prices",
      });
    } finally {
      if (requestGeneration.isCurrent(generation)) setLoading(false);
    }
  }, [asset, requestGeneration, requestKey]);

  const polling = useVisibilityPolling({
    refresh: fetchPrices,
    pollKey: requestKey,
    intervalMs: pollInterval,
    staleTimeMs: pollInterval,
    fastIntervalMs: EMPTY_RETRY_INTERVAL_MS,
    fastDurationMs: EMPTY_RETRY_WINDOW_MS,
  });
  pollingRef.current = polling;
  const refreshNow = polling.refreshNow;

  const refresh = useCallback(async () => {
    invalidateSharedRequest(requestKey);
    await refreshNow();
  }, [refreshNow, requestKey]);

  const snapshotIsCurrent = snapshot.requestKey === requestKey;
  return {
    prices: snapshotIsCurrent ? snapshot.prices : [],
    loading: snapshotIsCurrent ? loading : true,
    error:
      errorState.requestKey === requestKey ? errorState.message : null,
    refresh,
  };
}
