"use client";

import { useState, useCallback } from "react";
import { api, type Capacity } from "@/lib/api";
import { sharedRequest } from "@/lib/sharedRequest";
import { useVisibilityPolling } from "@/hooks/useVisibilityPolling";
import { useRequestGeneration } from "@/hooks/useRequestGeneration";
import { isBackendGatedAssetSlug } from "@/lib/assets";

const CAPACITY_CACHE_TTL_MS = 10_000;

export function useCapacity(asset?: string, pollInterval = 30_000) {
  const requestKey = asset ?? "all";
  const [snapshot, setSnapshot] = useState<{
    requestKey: string;
    capacity: Capacity | null;
  }>({ requestKey, capacity: null });
  const [loading, setLoading] = useState(true);
  const requestGeneration = useRequestGeneration(requestKey);

  const refresh = useCallback(async () => {
    const generation = requestGeneration.capture();
    try {
      const data = await sharedRequest(
        `capacity:${requestKey}`,
        CAPACITY_CACHE_TTL_MS,
        () => api.getCapacity(asset),
      );
      if (!requestGeneration.isCurrent(generation)) return;
      setSnapshot({ requestKey, capacity: data });
    } catch {
      if (!requestGeneration.isCurrent(generation)) return;
      // Route-gated assets fail closed when readiness cannot be refreshed.
      setSnapshot((previous) =>
        isBackendGatedAssetSlug(requestKey) || previous.requestKey !== requestKey
          ? { requestKey, capacity: null }
          : previous,
      );
    } finally {
      if (requestGeneration.isCurrent(generation)) setLoading(false);
    }
  }, [asset, requestGeneration, requestKey]);

  useVisibilityPolling({
    refresh,
    pollKey: requestKey,
    intervalMs: pollInterval,
    staleTimeMs: pollInterval,
  });

  const snapshotIsCurrent = snapshot.requestKey === requestKey;
  return {
    capacity: snapshotIsCurrent ? snapshot.capacity : null,
    loading: snapshotIsCurrent ? loading : true,
  };
}
