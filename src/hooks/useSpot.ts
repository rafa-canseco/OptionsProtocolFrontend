"use client";

import { useCallback, useState } from "react";
import { api } from "@/lib/api";
import { sharedRequest } from "@/lib/sharedRequest";
import { useVisibilityPolling } from "@/hooks/useVisibilityPolling";
import { useRequestGeneration } from "@/hooks/useRequestGeneration";

const SPOT_CACHE_TTL_MS = 4_000;

export function useSpot(asset: string, pollInterval = 10_000) {
  const [snapshot, setSnapshot] = useState<{
    asset: string;
    spot: number | undefined;
  }>({ asset, spot: undefined });
  const [loading, setLoading] = useState(true);
  const requestGeneration = useRequestGeneration(asset);

  const refresh = useCallback(async () => {
    const generation = requestGeneration.capture();
    try {
      const data = await sharedRequest(
        `spot:${asset}`,
        SPOT_CACHE_TTL_MS,
        () => api.getSpot(asset),
      );
      if (!requestGeneration.isCurrent(generation)) return;
      setSnapshot({ asset, spot: data.spot });
    } catch (err) {
      if (!requestGeneration.isCurrent(generation)) return;
      setSnapshot((previous) =>
        previous.asset === asset
          ? previous
          : { asset, spot: undefined },
      );
      console.error(`[useSpot] Failed to fetch ${asset} spot price:`, err);
    } finally {
      if (requestGeneration.isCurrent(generation)) setLoading(false);
    }
  }, [asset, requestGeneration]);

  useVisibilityPolling({
    refresh,
    pollKey: asset,
    intervalMs: pollInterval,
    staleTimeMs: pollInterval,
  });

  const snapshotIsCurrent = snapshot.asset === asset;
  return {
    spot: snapshotIsCurrent ? snapshot.spot : undefined,
    loading: snapshotIsCurrent ? loading : true,
  };
}
