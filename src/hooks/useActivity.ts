"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type Activity } from "@/lib/api";
import { subscribeDataInvalidation } from "@/lib/dataInvalidation";
import { useRequestGeneration } from "@/hooks/useRequestGeneration";
import { useVisibilityPolling } from "@/hooks/useVisibilityPolling";

const MANUAL_REFRESH_INTERVAL_MS = 60_000;

export function useActivity(
  address: string | undefined,
  alsoAddress?: string | undefined,
) {
  const sourceKey = `activity:${address?.toLowerCase() ?? "none"}:${alsoAddress?.toLowerCase() ?? "none"}`;
  const enabled = Boolean(address);
  const [snapshot, setSnapshot] = useState<{
    sourceKey: string;
    activity: Activity | null;
  }>({ sourceKey, activity: null });
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState<{
    sourceKey: string;
    message: string | null;
  }>({ sourceKey, message: null });
  const requestGeneration = useRequestGeneration(sourceKey);

  const fetchActivity = useCallback(async () => {
    const generation = requestGeneration.capture();
    if (!address) return;
    try {
      const nextActivity = await api.getActivity(address, alsoAddress);
      if (!requestGeneration.isCurrent(generation)) return;
      setSnapshot({ sourceKey, activity: nextActivity });
      setErrorState({ sourceKey, message: null });
    } catch (cause) {
      if (!requestGeneration.isCurrent(generation)) return;
      setSnapshot((previous) =>
        previous.sourceKey === sourceKey
          ? previous
          : { sourceKey, activity: null },
      );
      setErrorState({
        sourceKey,
        message:
          cause instanceof Error ? cause.message : "Failed to fetch activity",
      });
    } finally {
      if (requestGeneration.isCurrent(generation)) setLoading(false);
    }
  }, [address, alsoAddress, requestGeneration, sourceKey]);

  const { refreshNow } = useVisibilityPolling({
    refresh: fetchActivity,
    enabled,
    pollKey: sourceKey,
    intervalMs: MANUAL_REFRESH_INTERVAL_MS,
    periodic: false,
  });

  useEffect(() => {
    if (enabled) {
      setLoading(true);
      return;
    }
    setSnapshot({ sourceKey, activity: null });
    setErrorState({ sourceKey, message: null });
    setLoading(false);
  }, [enabled, sourceKey]);

  useEffect(
    () => subscribeDataInvalidation("activity", () => void refreshNow()),
    [refreshNow],
  );

  const snapshotIsCurrent = snapshot.sourceKey === sourceKey;
  return {
    activity: snapshotIsCurrent ? snapshot.activity : null,
    loading: enabled ? !snapshotIsCurrent || loading : false,
    error:
      errorState.sourceKey === sourceKey ? errorState.message : null,
    refresh: refreshNow,
  };
}
