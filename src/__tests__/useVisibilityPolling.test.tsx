import { act, renderHook } from "@testing-library/react";
import { StrictMode, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useVisibilityPolling } from "@/hooks/useVisibilityPolling";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useVisibilityPolling", () => {
  it("does not invoke a refresh queued by a disposed effect", async () => {
    const refresh = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const { unmount } = renderHook(() =>
      useVisibilityPolling({
        refresh,
        pollKey: "disposed",
        intervalMs: 1_000,
      }),
    );

    unmount();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(refresh).not.toHaveBeenCalled();
  });

  it("starts one initial refresh under StrictMode", async () => {
    const refresh = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <StrictMode>{children}</StrictMode>
    );
    const { unmount } = renderHook(
      () =>
        useVisibilityPolling({
          refresh,
          pollKey: "strict",
          intervalMs: 1_000,
        }),
      { wrapper },
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("does not invoke the obsolete callback after pollKey changes", async () => {
    const calls: string[] = [];
    const { rerender, unmount } = renderHook(
      ({ pollKey }: { pollKey: string }) =>
        useVisibilityPolling({
          refresh: async () => { calls.push(pollKey); },
          pollKey,
          intervalMs: 1_000,
        }),
      { initialProps: { pollKey: "wallet-a" } },
    );

    rerender({ pollKey: "wallet-b" });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(calls).toEqual(["wallet-b"]);
    unmount();
  });

  it("never overlaps requests and schedules from completion", async () => {
    vi.useFakeTimers();
    let resolveFirst: (() => void) | undefined;
    const refresh = vi
      .fn<() => Promise<void>>()
      .mockImplementationOnce(
        () => new Promise<void>((resolve) => { resolveFirst = resolve; }),
      )
      .mockResolvedValue(undefined);

    const { unmount } = renderHook(() =>
      useVisibilityPolling({
        refresh,
        pollKey: "test",
        intervalMs: 1_000,
      }),
    );
    await act(async () => Promise.resolve());
    expect(refresh).toHaveBeenCalledTimes(1);

    await act(async () => vi.advanceTimersByTimeAsync(5_000));
    expect(refresh).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFirst?.();
      await Promise.resolve();
    });
    await act(async () => vi.advanceTimersByTimeAsync(999));
    expect(refresh).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(refresh).toHaveBeenCalledTimes(2);
    unmount();
  });

  it("bounds 3-second fast polling and returns to the regular cadence", async () => {
    vi.useFakeTimers({ now: new Date("2026-08-03T10:00:00Z") });
    const refresh = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const { result, unmount } = renderHook(() =>
      useVisibilityPolling({
        refresh,
        pollKey: "bounded-fast-polling",
        intervalMs: 15_000,
        fastIntervalMs: 3_000,
        fastDurationMs: 30_000,
      }),
    );
    await act(async () => Promise.resolve());
    expect(refresh).toHaveBeenCalledTimes(1);

    act(() => result.current.startFastPolling());
    await act(async () => Promise.resolve());
    expect(refresh).toHaveBeenCalledTimes(2);

    await act(async () => vi.advanceTimersByTimeAsync(2_999));
    expect(refresh).toHaveBeenCalledTimes(2);
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(refresh).toHaveBeenCalledTimes(3);

    await act(async () => vi.advanceTimersByTimeAsync(27_000));
    expect(refresh).toHaveBeenCalledTimes(12);
    await act(async () => vi.advanceTimersByTimeAsync(14_999));
    expect(refresh).toHaveBeenCalledTimes(12);
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(refresh).toHaveBeenCalledTimes(13);
    unmount();
  });

  it("coalesces concurrent refreshes into exactly one trailing request", async () => {
    vi.useFakeTimers();
    let resolveFirst: (() => void) | undefined;
    let resolveSecond: (() => void) | undefined;
    const refresh = vi
      .fn<() => Promise<void>>()
      .mockImplementationOnce(
        () => new Promise<void>((resolve) => { resolveFirst = resolve; }),
      )
      .mockImplementationOnce(
        () => new Promise<void>((resolve) => { resolveSecond = resolve; }),
      );

    const { result, unmount } = renderHook(() =>
      useVisibilityPolling({
        refresh,
        pollKey: "trailing",
        intervalMs: 10_000,
      }),
    );
    await act(async () => Promise.resolve());
    expect(refresh).toHaveBeenCalledTimes(1);

    let firstRefresh: Promise<void> | undefined;
    let secondRefresh: Promise<void> | undefined;
    act(() => {
      firstRefresh = result.current.refreshNow();
      secondRefresh = result.current.refreshNow();
    });
    expect(refresh).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFirst?.();
      await Promise.resolve();
    });
    expect(refresh).toHaveBeenCalledTimes(2);

    await act(async () => {
      resolveSecond?.();
      await Promise.all([firstRefresh, secondRefresh]);
    });
    expect(refresh).toHaveBeenCalledTimes(2);
    unmount();
  });
});
