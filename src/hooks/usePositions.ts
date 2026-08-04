"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type Position } from "@/lib/api";
import {
  subscribeDataInvalidation,
  wasDataInvalidatedRecently,
} from "@/lib/dataInvalidation";
import {
  invalidateSharedRequest,
  sharedRequest,
} from "@/lib/sharedRequest";
import { useVisibilityPolling } from "@/hooks/useVisibilityPolling";
import { useRequestGeneration } from "@/hooks/useRequestGeneration";

const POSITION_REQUEST_TTL_MS = 1_000;
const POSITION_FAST_INTERVAL_MS = 3_000;
const POSITION_FAST_DURATION_MS = 30_000;

function uniqueCaseSensitive(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function uniqueBaseAddresses(values: Array<string | undefined>): string[] {
  return Array.from(
    new Set(
      values
        .filter((value): value is string => Boolean(value))
        .map((value) => value.toLowerCase()),
    ),
  );
}

function dedupePositions(positions: Position[]): Position[] {
  const seen = new Set<string>();
  return positions.filter((position) => {
    if (seen.has(position.id)) return false;
    seen.add(position.id);
    return true;
  });
}

export function usePositions(
  address: string | undefined,
  fundingAddress: string | undefined,
  solanaAddresses?: string | string[] | undefined,
  pollInterval = 15_000,
  baseAddresses?: string[],
  b1naryPrivyUserId?: string,
) {
  const baseKey = uniqueBaseAddresses([
    address,
    fundingAddress,
    ...(baseAddresses ?? []),
  ])
    .sort()
    .join("|");
  const solanaKey = uniqueCaseSensitive(
    Array.isArray(solanaAddresses) ? solanaAddresses : [solanaAddresses],
  )
    .sort()
    .join("|");
  const baseWallets = useMemo(() => (baseKey ? baseKey.split("|") : []), [baseKey]);
  const solanaWallets = useMemo(
    () => (solanaKey ? solanaKey.split("|") : []),
    [solanaKey],
  );
  const sourceKey = b1naryPrivyUserId
    ? `privy:${b1naryPrivyUserId}`
    : `wallets:${baseKey}:${solanaKey}`;
  const enabled = Boolean(b1naryPrivyUserId || baseKey || solanaKey);
  const requestKey = `positions:${sourceKey}`;
  const [snapshot, setSnapshot] = useState<{
    sourceKey: string;
    positions: Position[];
  }>({ sourceKey, positions: [] });
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState<{
    sourceKey: string;
    message: string | null;
  }>({ sourceKey, message: null });
  const requestGeneration = useRequestGeneration(sourceKey);

  const loadPositions = useCallback(async () => {
    if (!enabled) return [];
    return sharedRequest(requestKey, POSITION_REQUEST_TTL_MS, async () => {
      if (b1naryPrivyUserId) {
        const response = await api.getB1naryPositionsByPrivyUserId(
          b1naryPrivyUserId,
        );
        return response.positions;
      }
      const results = await Promise.all(
        [...baseWallets, ...solanaWallets].map((wallet) =>
          api.getPositions(wallet),
        ),
      );
      return dedupePositions(results.flat());
    });
  }, [b1naryPrivyUserId, baseWallets, enabled, requestKey, solanaWallets]);

  const fetchPositions = useCallback(async () => {
    const generation = requestGeneration.capture();
    try {
      const nextPositions = await loadPositions();
      if (!requestGeneration.isCurrent(generation)) return;
      setSnapshot({ sourceKey, positions: nextPositions });
      setErrorState({ sourceKey, message: null });
    } catch (cause) {
      if (!requestGeneration.isCurrent(generation)) return;
      setSnapshot((previous) =>
        previous.sourceKey === sourceKey
          ? previous
          : { sourceKey, positions: [] },
      );
      setErrorState({
        sourceKey,
        message:
          cause instanceof Error ? cause.message : "Failed to fetch positions",
      });
    } finally {
      if (requestGeneration.isCurrent(generation)) setLoading(false);
    }
  }, [loadPositions, requestGeneration, sourceKey]);

  const { refreshNow, startFastPolling } = useVisibilityPolling({
    refresh: fetchPositions,
    enabled,
    pollKey: sourceKey,
    intervalMs: pollInterval,
    staleTimeMs: pollInterval,
    fastIntervalMs: POSITION_FAST_INTERVAL_MS,
    fastDurationMs: POSITION_FAST_DURATION_MS,
  });

  useEffect(() => {
    if (enabled) {
      setLoading(true);
      return;
    }
    setSnapshot({ sourceKey, positions: [] });
    setErrorState({ sourceKey, message: null });
    setLoading(false);
  }, [enabled, sourceKey]);

  useEffect(() => {
    if (
      wasDataInvalidatedRecently("positions", POSITION_FAST_DURATION_MS)
    ) {
      invalidateSharedRequest(requestKey);
      startFastPolling();
    }
    return subscribeDataInvalidation("positions", () => {
      invalidateSharedRequest(requestKey);
      startFastPolling(true);
    });
  }, [requestKey, startFastPolling]);

  const refresh = useCallback(async () => {
    invalidateSharedRequest(requestKey);
    await refreshNow();
  }, [refreshNow, requestKey]);

  const snapshotIsCurrent = snapshot.sourceKey === sourceKey;
  return {
    positions: snapshotIsCurrent ? snapshot.positions : [],
    loading: enabled ? !snapshotIsCurrent || loading : false,
    error:
      errorState.sourceKey === sourceKey ? errorState.message : null,
    refresh,
  };
}
