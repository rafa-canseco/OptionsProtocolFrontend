"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import type {
  PositionPortfolioPageRequest,
  PositionPortfolioWallet,
} from "@/lib/api";
import {
  subscribeDataInvalidation,
  wasDataInvalidatedRecently,
} from "@/lib/dataInvalidation";
import { sharedRequest } from "@/lib/sharedRequest";
import { useVisibilityPolling } from "@/hooks/useVisibilityPolling";
import { useRequestGeneration } from "@/hooks/useRequestGeneration";
import {
  createAccountPortfolioSource,
  createWalletPortfolioSource,
  PositionPortfolioProtocolError,
  type PortfolioPage,
  type PortfolioRoute,
  type PositionPortfolioSource,
} from "@/lib/positionPortfolioApi";
import {
  createPositionPortfolioState,
  positionPortfolioReducer,
  selectPositions,
  type PositionPortfolioAction,
} from "@/lib/positionPortfolio";
import {
  classifyPortfolioError,
  trackPortfolioEvent,
} from "@/lib/positionPortfolioTelemetry";

const POSITION_REQUEST_TTL_MS = 1_000;
const POSITION_FAST_INTERVAL_MS = 3_000;
const POSITION_FAST_DURATION_MS = 30_000;
const POSITION_PAGE_LIMIT = 100;

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

function visible(): boolean {
  return typeof document === "undefined" || document.visibilityState !== "hidden";
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : "Failed to fetch positions";
}

function requestCacheKey(
  sourceKey: string,
  operation: string,
  epoch: number,
  request?: PositionPortfolioPageRequest,
  route?: PortfolioRoute,
): string {
  return JSON.stringify([
    "positions",
    sourceKey,
    operation,
    route ?? "discover",
    request?.stream ?? "snapshot",
    request?.cursor ?? "first",
    request?.changedAfter ?? "none",
    String(request?.limit ?? "default"),
    String(epoch),
  ]);
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
  const wallets = useMemo<PositionPortfolioWallet[]>(
    () => [
      ...baseWallets.map((wallet) => ({ chain: "base" as const, address: wallet })),
      ...solanaWallets.map((wallet) => ({ chain: "solana" as const, address: wallet })),
    ],
    [baseWallets, solanaWallets],
  );
  const source = useMemo<PositionPortfolioSource | null>(() => {
    if (b1naryPrivyUserId) return createAccountPortfolioSource(b1naryPrivyUserId);
    if (wallets.length > 0) return createWalletPortfolioSource(wallets);
    return null;
  }, [b1naryPrivyUserId, wallets]);

  const [state, dispatch] = useReducer(
    positionPortfolioReducer,
    sourceKey,
    createPositionPortfolioState,
  );
  const stateRef = useRef(state);
  stateRef.current = state;
  const send = useCallback((action: PositionPortfolioAction) => {
    stateRef.current = positionPortfolioReducer(stateRef.current, action);
    dispatch(action);
  }, []);
  const [loading, setLoading] = useState(enabled);
  const requestGeneration = useRequestGeneration(sourceKey);
  const cacheEpochRef = useRef(0);
  const settledRequestRef = useRef<symbol | null>(null);
  const resumePendingRef = useRef(false);

  const loadShared = useCallback(
    <T,>(
      operation: string,
      load: () => Promise<T>,
      request?: PositionPortfolioPageRequest,
      route?: PortfolioRoute,
    ) =>
      sharedRequest(
        requestCacheKey(
          sourceKey,
          operation,
          cacheEpochRef.current,
          request,
          route,
        ),
        POSITION_REQUEST_TTL_MS,
        load,
      ),
    [sourceKey],
  );

  const reportFailure = useCallback(
    (
      cause: unknown,
      operation: "initial" | "active" | "settled" | "changes",
      generation: number,
      stream: "snapshot" | "active" | "settled" | "changes",
    ) => {
      if (!requestGeneration.isCurrent(generation)) return;
      send({
        type: "failure",
        sourceKey,
        operation,
        message: errorMessage(cause),
      });
      trackPortfolioEvent({
        source_kind: source?.kind ?? "wallet_batch",
        operation: "request_failed",
        stream,
        ...classifyPortfolioError(cause),
      });
    },
    [requestGeneration, send, source?.kind, sourceKey],
  );

  const loadPage = useCallback(
    async (
      request: PositionPortfolioPageRequest,
      operation: string,
      route: PortfolioRoute,
    ) => {
      if (!source) {
        throw new PositionPortfolioProtocolError("Portfolio source is unavailable");
      }
      const page = await loadShared(
        operation,
        () => source.getPage(request, route),
        request,
        route,
      );
      if (page.route !== route) {
        throw new PositionPortfolioProtocolError(
          "Portfolio continuation route changed",
        );
      }
      return page;
    },
    [loadShared, source],
  );

  const drainActive = useCallback(
    async (
      initialCursor: string | null,
      expectedWatermark: string | null,
      generation: number,
      route: PortfolioRoute,
    ) => {
      let cursor = initialCursor;
      let pageCount = 0;
      let rowCount = 0;
      const startedAt = Date.now();
      while (cursor && requestGeneration.isCurrent(generation)) {
        if (!visible()) {
          resumePendingRef.current = true;
          return;
        }
        const request: PositionPortfolioPageRequest = {
          stream: "active",
          cursor,
          limit: POSITION_PAGE_LIMIT,
        };
        send({ type: "begin", sourceKey, operation: "active" });
        try {
          const page = await loadPage(request, "active-continuation", route);
          if (!requestGeneration.isCurrent(generation)) return;
          if (expectedWatermark !== null && page.watermark !== expectedWatermark) {
            throw new PositionPortfolioProtocolError(
              "Active traversal watermark changed",
            );
          }
          if (page.nextCursor === cursor) {
            throw new PositionPortfolioProtocolError(
              "Active traversal cursor did not advance",
            );
          }
          send({ type: "traversal_page", sourceKey, stream: "active", page });
          pageCount += 1;
          rowCount += page.positions.length;
          cursor = page.nextCursor;
        } catch (cause) {
          reportFailure(cause, "active", generation, "active");
          return;
        }
      }
      resumePendingRef.current = false;
      if (pageCount > 0 && requestGeneration.isCurrent(generation)) {
        trackPortfolioEvent({
          source_kind: source?.kind ?? "wallet_batch",
          operation: "active_complete",
          stream: "active",
          page_count: pageCount,
          row_count: rowCount,
          duration_ms: Date.now() - startedAt,
        });
      }
    }, [loadPage, reportFailure, requestGeneration, send, source?.kind, sourceKey],
  );

  const refreshActivePage = useCallback(
    async (generation: number, route: PortfolioRoute) => {
      if (!visible()) return;
      const request: PositionPortfolioPageRequest = {
        stream: "active",
        limit: POSITION_PAGE_LIMIT,
      };
      try {
        const page = await loadPage(request, "active-refresh", route);
        if (!requestGeneration.isCurrent(generation)) return;
        send({ type: "active_refresh", sourceKey, positions: page.positions });
      } catch (cause) {
        reportFailure(cause, "active", generation, "active");
      }
    }, [loadPage, reportFailure, requestGeneration, send, sourceKey],
  );

  const refreshChanges = useCallback(
    async (
      changedAfter: string,
      generation: number,
      route: PortfolioRoute,
    ) => {
      if (!visible()) return;
      send({ type: "begin", sourceKey, operation: "changes" });
      let cursor: string | null = null;
      let upperWatermark: string | null = null;
      let pageCount = 0;
      let rowCount = 0;
      const startedAt = Date.now();
      try {
        do {
          if (!visible()) {
            resumePendingRef.current = true;
            send({ type: "changes_paused", sourceKey });
            return;
          }
          const request: PositionPortfolioPageRequest = {
            stream: "changes",
            cursor,
            changedAfter,
            limit: POSITION_PAGE_LIMIT,
          };
          const page = await loadPage(request, "changes", route);
          if (!requestGeneration.isCurrent(generation)) return;
          if (upperWatermark !== null && page.watermark !== upperWatermark) {
            throw new PositionPortfolioProtocolError(
              "Changes watermark changed during traversal",
            );
          }
          if (Date.parse(page.watermark) < Date.parse(changedAfter)) {
            throw new PositionPortfolioProtocolError(
              "Changes watermark precedes the committed watermark",
            );
          }
          if (cursor !== null && page.nextCursor === cursor) {
            throw new PositionPortfolioProtocolError(
              "Changes traversal cursor did not advance",
            );
          }
          upperWatermark ??= page.watermark;
          send({ type: "changes_page", sourceKey, positions: page.positions });
          pageCount += 1;
          rowCount += page.positions.length;
          cursor = page.nextCursor;
        } while (cursor !== null);

        if (upperWatermark && requestGeneration.isCurrent(generation)) {
          send({
            type: "changes_complete",
            sourceKey,
            watermark: upperWatermark,
          });
          trackPortfolioEvent({
            source_kind: source?.kind ?? "wallet_batch",
            operation: "delta_complete",
            stream: "changes",
            page_count: pageCount,
            row_count: rowCount,
            duration_ms: Date.now() - startedAt,
          });
        }
      } catch (cause) {
        reportFailure(cause, "changes", generation, "changes");
      }
    }, [loadPage, reportFailure, requestGeneration, send, source?.kind, sourceKey],
  );

  const initialize = useCallback(
    async (generation: number, preferredRoute?: PortfolioRoute) => {
      if (!source) return;
      const startedAt = Date.now();
      try {
        const snapshot = await loadShared(
          "snapshot",
          () => source.getSnapshot(preferredRoute),
          undefined,
          preferredRoute,
        );
        if (!requestGeneration.isCurrent(generation)) return;
        if (snapshot.mode === "legacy") {
          send({
            type: "legacy_snapshot",
            sourceKey,
            positions: snapshot.positions,
            route: snapshot.route,
          });
          setLoading(false);
          trackPortfolioEvent({
            source_kind: source.kind,
            operation: "legacy_fallback",
            stream: "snapshot",
            mode: "legacy",
            row_count: snapshot.positions.length,
            duration_ms: Date.now() - startedAt,
          });
          return;
        }
        send({
          type: "bounded_snapshot",
          sourceKey,
          positions: snapshot.positions,
          pagination: snapshot.pagination,
          route: snapshot.route,
        });
        setLoading(false);
        trackPortfolioEvent({
          source_kind: source.kind,
          operation: "mode_selected",
          stream: "snapshot",
          mode: "bounded",
          row_count: snapshot.positions.length,
          duration_ms: Date.now() - startedAt,
        });
        await drainActive(
          snapshot.pagination.active.next_cursor,
          snapshot.pagination.watermark,
          generation,
          snapshot.route,
        );
      } catch (cause) {
        reportFailure(cause, "initial", generation, "snapshot");
        if (requestGeneration.isCurrent(generation)) setLoading(false);
      }
    }, [drainActive, loadShared, reportFailure, requestGeneration, send, source, sourceKey],
  );

  const fetchPositions = useCallback(async () => {
    if (!enabled || !source) return;
    const generation = requestGeneration.capture();
    const current = stateRef.current;
    if (current.sourceKey !== sourceKey || current.mode === "uninitialized") {
      await initialize(generation);
      return;
    }
    if (current.mode === "legacy") {
      await initialize(generation, current.route ?? undefined);
      return;
    }
    if (!current.route) {
      reportFailure(
        new PositionPortfolioProtocolError("Portfolio snapshot route is unavailable"),
        "initial",
        generation,
        "snapshot",
      );
      return;
    }

    await Promise.all([
      refreshActivePage(generation, current.route),
      current.watermark
        ? refreshChanges(current.watermark, generation, current.route)
        : Promise.resolve(),
    ]);
    const latest = stateRef.current;
    if (
      requestGeneration.isCurrent(generation) &&
      latest.sourceKey === sourceKey &&
      latest.active.hasMore
    ) {
      await drainActive(
        latest.active.cursor,
        latest.active.watermark,
        generation,
        latest.route ?? current.route,
      );
    }
  }, [
    drainActive,
    enabled,
    initialize,
    refreshActivePage,
    refreshChanges,
    reportFailure,
    requestGeneration,
    source,
    sourceKey,
  ]);

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
    cacheEpochRef.current = 0;
    settledRequestRef.current = null;
    resumePendingRef.current = false;
    send({ type: "reset", sourceKey });
    setLoading(enabled);
  }, [enabled, send, sourceKey]);

  useEffect(() => {
    if (wasDataInvalidatedRecently("positions", POSITION_FAST_DURATION_MS)) {
      cacheEpochRef.current += 1;
      startFastPolling();
    }
    return subscribeDataInvalidation("positions", () => {
      cacheEpochRef.current += 1;
      startFastPolling(true);
    });
  }, [sourceKey, startFastPolling]);

  useEffect(() => {
    const resumeTraversal = () => {
      if (visible() && resumePendingRef.current) {
        resumePendingRef.current = false;
        void refreshNow();
      }
    };
    document.addEventListener("visibilitychange", resumeTraversal);
    return () => document.removeEventListener("visibilitychange", resumeTraversal);
  }, [refreshNow]);

  const refresh = useCallback(async () => {
    cacheEpochRef.current += 1;
    await refreshNow();
  }, [refreshNow]);

  const loadMoreSettled = useCallback(async () => {
    const current = stateRef.current;
    if (
      !source ||
      current.sourceKey !== sourceKey ||
      current.mode !== "bounded" ||
      !current.settled.hasMore ||
      !current.settled.cursor ||
      !current.route ||
      settledRequestRef.current !== null ||
      !visible()
    ) {
      return;
    }
    const generation = requestGeneration.capture();
    const request: PositionPortfolioPageRequest = {
      stream: "settled",
      cursor: current.settled.cursor,
      limit: POSITION_PAGE_LIMIT,
    };
    const requestToken = Symbol("settled-request");
    settledRequestRef.current = requestToken;
    send({ type: "begin", sourceKey, operation: "settled" });
    const startedAt = Date.now();
    try {
      const page: PortfolioPage = await loadPage(
        request,
        "settled-continuation",
        current.route,
      );
      if (!requestGeneration.isCurrent(generation)) return;
      if (
        current.settled.watermark !== null &&
        page.watermark !== current.settled.watermark
      ) {
        throw new PositionPortfolioProtocolError(
          "Settled traversal watermark changed",
        );
      }
      if (page.nextCursor === current.settled.cursor) {
        throw new PositionPortfolioProtocolError(
          "Settled traversal cursor did not advance",
        );
      }
      send({ type: "traversal_page", sourceKey, stream: "settled", page });
      trackPortfolioEvent({
        source_kind: source.kind,
        operation: "settled_page",
        stream: "settled",
        page_count: 1,
        row_count: page.positions.length,
        duration_ms: Date.now() - startedAt,
      });
    } catch (cause) {
      reportFailure(cause, "settled", generation, "settled");
    } finally {
      if (settledRequestRef.current === requestToken) {
        settledRequestRef.current = null;
      }
    }
  }, [loadPage, reportFailure, requestGeneration, send, source, sourceKey]);

  const current = state.sourceKey === sourceKey ? state : createPositionPortfolioState(sourceKey);
  return {
    positions: enabled ? selectPositions(current) : [],
    loading: enabled ? loading || !current.initialized : false,
    error: current.error ?? current.active.error ?? current.settled.error,
    refresh,
    loadMoreSettled,
    settledHasMore: current.mode === "bounded" && current.settled.hasMore,
    settledLoading: current.settled.loading,
  };
}
