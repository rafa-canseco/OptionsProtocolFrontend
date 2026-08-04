"use client";

import { useCallback, useEffect, useRef } from "react";

type VisibilityPollingOptions = {
  refresh: () => Promise<void>;
  enabled?: boolean;
  pollKey: string;
  intervalMs: number;
  staleTimeMs?: number;
  fastIntervalMs?: number;
  fastDurationMs?: number;
  periodic?: boolean;
};

type PollingControls = {
  refreshNow: () => Promise<void>;
  startFastPolling: (queueImmediate?: boolean) => void;
  stopFastPolling: () => void;
};

const idleControls: PollingControls = {
  refreshNow: async () => {},
  startFastPolling: () => {},
  stopFastPolling: () => {},
};

export function useVisibilityPolling({
  refresh,
  enabled = true,
  pollKey,
  intervalMs,
  staleTimeMs = intervalMs,
  fastIntervalMs = 3_000,
  fastDurationMs = 30_000,
  periodic = true,
}: VisibilityPollingOptions): PollingControls {
  const refreshRef = useRef(refresh);
  const controlsRef = useRef<PollingControls>(idleControls);
  refreshRef.current = refresh;

  useEffect(() => {
    if (!enabled) {
      controlsRef.current = idleControls;
      return;
    }

    let disposed = false;
    let timer: number | null = null;
    let inFlight: Promise<void> | null = null;
    let lastCompletedAt = 0;
    let fastUntil = 0;
    let refreshPending = false;
    let trailingRequested = false;

    const isVisible = () => document.visibilityState !== "hidden";
    const clearTimer = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
    };

    function kick() {
      void run(false).catch(() => {});
    }
    function schedule() {
      clearTimer();
      if (disposed || !periodic || !isVisible()) return;
      const now = Date.now();
      const fastRemaining = fastUntil - now;
      const regularRemaining = Math.max(0, intervalMs - (now - lastCompletedAt));
      const delay = fastRemaining >= fastIntervalMs
        ? fastIntervalMs
        : regularRemaining;
      timer = window.setTimeout(kick, delay);
    }

    function run(queueIfBusy: boolean): Promise<void> {
      if (disposed) return Promise.resolve();
      if (!isVisible()) {
        refreshPending = true;
        return Promise.resolve();
      }
      if (inFlight) {
        if (queueIfBusy) trailingRequested = true;
        return inFlight;
      }
      trailingRequested = false;
      refreshPending = false;
      clearTimer();
      const request = Promise.resolve()
        .then(() => {
          if (disposed) return;
          return refreshRef.current();
        })
        .finally(() => {
          if (inFlight === request) inFlight = null;
          if (disposed) return;
          lastCompletedAt = Date.now();
          if (trailingRequested) {
            if (isVisible()) {
              trailingRequested = false;
              return run(false);
            }
            refreshPending = true;
          }
          schedule();
        });
      inFlight = request;
      return request;
    }

    const resumeIfStale = () => {
      if (!isVisible()) {
        clearTimer();
        return;
      }
      if (
        refreshPending ||
        lastCompletedAt === 0 ||
        (periodic && Date.now() - lastCompletedAt >= staleTimeMs)
      ) {
        kick();
      } else if (periodic) {
        schedule();
      }
    };

    controlsRef.current = {
      refreshNow: () => run(true),
      startFastPolling: (queueImmediate = false) => {
        fastUntil = Math.max(fastUntil, Date.now() + fastDurationMs);
        void run(queueImmediate).catch(() => {});
      },
      stopFastPolling: () => {
        fastUntil = 0;
        schedule();
      },
    };

    window.addEventListener("focus", resumeIfStale);
    document.addEventListener("visibilitychange", resumeIfStale);
    kick();

    return () => {
      disposed = true;
      clearTimer();
      window.removeEventListener("focus", resumeIfStale);
      document.removeEventListener("visibilitychange", resumeIfStale);
      controlsRef.current = idleControls;
    };
  }, [
    enabled,
    fastDurationMs,
    fastIntervalMs,
    intervalMs,
    periodic,
    pollKey,
    staleTimeMs,
  ]);

  return {
    refreshNow: useCallback(() => controlsRef.current.refreshNow(), []),
    startFastPolling: useCallback(
      (queueImmediate = false) =>
        controlsRef.current.startFastPolling(queueImmediate),
      [],
    ),
    stopFastPolling: useCallback(() => controlsRef.current.stopFastPolling(), []),
  };
}
