"use client";

import { useCallback, useEffect, useState } from "react";
import {
  api,
  type YieldUserSummary,
  type YieldUserPositions,
  type YieldUserHistory,
  type YieldStats,
} from "@/lib/api";
import { subscribeDataInvalidation } from "@/lib/dataInvalidation";
import { useRequestGeneration } from "@/hooks/useRequestGeneration";
import { useVisibilityPolling } from "@/hooks/useVisibilityPolling";

interface YieldData {
  summary: YieldUserSummary | null;
  positions: YieldUserPositions | null;
  history: YieldUserHistory | null;
  stats: YieldStats | null;
}

const EMPTY_YIELD_DATA: YieldData = {
  summary: null,
  positions: null,
  history: null,
  stats: null,
};
const MANUAL_REFRESH_INTERVAL_MS = 60_000;

function mergeAssetSummaries(summaries: YieldUserSummary[]): YieldUserSummary | null {
  if (summaries.length === 0) return null;
  const wallet = summaries[0]?.wallet ?? "";
  const byAsset = new Map<string, YieldUserSummary["assets"][number]>();
  for (const summary of summaries) {
    for (const asset of summary.assets) {
      const prev = byAsset.get(asset.asset);
      byAsset.set(asset.asset, prev ? {
        ...asset,
        pending_raw: prev.pending_raw + asset.pending_raw,
        pending: prev.pending + asset.pending,
        delivered_raw: prev.delivered_raw + asset.delivered_raw,
        delivered: prev.delivered + asset.delivered,
        estimated_accruing_raw: prev.estimated_accruing_raw + asset.estimated_accruing_raw,
        estimated_accruing: prev.estimated_accruing + asset.estimated_accruing,
        total_raw: prev.total_raw + asset.total_raw,
        total: prev.total + asset.total,
      } : asset);
    }
  }
  return { wallet, assets: Array.from(byAsset.values()) };
}

function mergeYieldPositions(all: YieldUserPositions[]): YieldUserPositions | null {
  if (all.length === 0) return null;
  const wallet = all[0]?.wallet ?? "";
  const positionsMap = new Map<string, YieldUserPositions["positions"][number]>();
  const totalsMap = new Map<string, YieldUserPositions["totals"][number]>();

  for (const entry of all) {
    for (const pos of entry.positions) positionsMap.set(pos.id, pos);
    for (const total of entry.totals) {
      const prev = totalsMap.get(total.asset);
      totalsMap.set(total.asset, {
        asset: total.asset,
        estimated_yield: (prev?.estimated_yield ?? 0) + total.estimated_yield,
      });
    }
  }

  return {
    wallet,
    positions: Array.from(positionsMap.values()),
    totals: Array.from(totalsMap.values()),
  };
}

function mergeYieldHistory(all: YieldUserHistory[]): YieldUserHistory | null {
  if (all.length === 0) return null;
  const wallet = all[0]?.wallet ?? "";
  const historyMap = new Map<string, YieldUserHistory["history"][number]>();
  for (const entry of all) {
    for (const item of entry.history) historyMap.set(item.id, item);
  }
  return { wallet, history: Array.from(historyMap.values()) };
}

export function useYield(
  address: string | undefined,
  solanaAddress?: string | undefined,
) {
  const sourceKey = `yield:${address?.toLowerCase() ?? "none"}:${solanaAddress ?? "none"}`;
  const addresses = [address, solanaAddress].filter(
    (value, index, values): value is string =>
      Boolean(value) && values.indexOf(value) === index,
  );
  const enabled = addresses.length > 0;
  const [snapshot, setSnapshot] = useState<{
    sourceKey: string;
    data: YieldData;
  }>({ sourceKey, data: EMPTY_YIELD_DATA });
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState<{
    sourceKey: string;
    message: string | null;
  }>({ sourceKey, message: null });
  const requestGeneration = useRequestGeneration(sourceKey);

  const fetchYield = useCallback(async () => {
    const generation = requestGeneration.capture();
    if (addresses.length === 0) return;
    try {
      const [summaries, positionsList, historyList, stats] = await Promise.all([
        Promise.all(addresses.map((item) => api.getYieldSummary(item))),
        Promise.all(addresses.map((item) => api.getYieldPositions(item))),
        Promise.all(addresses.map((item) => api.getYieldHistory(item))),
        api.getYieldStats(),
      ]);
      if (!requestGeneration.isCurrent(generation)) return;
      setSnapshot({
        sourceKey,
        data: {
          summary: mergeAssetSummaries(summaries),
          positions: mergeYieldPositions(positionsList),
          history: mergeYieldHistory(historyList),
          stats,
        },
      });
      setErrorState({ sourceKey, message: null });
    } catch (cause) {
      if (!requestGeneration.isCurrent(generation)) return;
      setSnapshot((previous) =>
        previous.sourceKey === sourceKey
          ? previous
          : { sourceKey, data: EMPTY_YIELD_DATA },
      );
      setErrorState({
        sourceKey,
        message:
          cause instanceof Error ? cause.message : "Failed to fetch yield data",
      });
    } finally {
      if (requestGeneration.isCurrent(generation)) setLoading(false);
    }
  }, [addresses, requestGeneration, sourceKey]);

  const { refreshNow } = useVisibilityPolling({
    refresh: fetchYield,
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
    setSnapshot({ sourceKey, data: EMPTY_YIELD_DATA });
    setErrorState({ sourceKey, message: null });
    setLoading(false);
  }, [enabled, sourceKey]);

  useEffect(
    () => subscribeDataInvalidation("yield", () => void refreshNow()),
    [refreshNow],
  );

  const snapshotIsCurrent = snapshot.sourceKey === sourceKey;
  const data = snapshotIsCurrent ? snapshot.data : EMPTY_YIELD_DATA;
  return {
    ...data,
    loading: enabled ? !snapshotIsCurrent || loading : false,
    error:
      errorState.sourceKey === sourceKey ? errorState.message : null,
    refresh: refreshNow,
  };
}
