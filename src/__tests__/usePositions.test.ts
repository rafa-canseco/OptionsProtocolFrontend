import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearDataInvalidations,
  invalidateData,
} from "@/lib/dataInvalidation";
import { clearSharedRequests } from "@/lib/sharedRequest";

const apiMock = vi.hoisted(() => ({
  getPositions: vi.fn(),
  getB1naryPositionsByPrivyUserId: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ api: apiMock }));

function position(id: string) {
  return { id, indexed_at: "2026-05-06T00:00:00Z" };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}

async function flushRequests() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("usePositions", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.clearAllMocks();
    clearSharedRequests();
    clearDataInvalidations();
    apiMock.getPositions.mockResolvedValue([]);
    apiMock.getB1naryPositionsByPrivyUserId.mockResolvedValue({
      positions: [],
      errors: [],
    });
  });

  it("uses the Privy aggregate as the canonical source without wallet reads", async () => {
    apiMock.getB1naryPositionsByPrivyUserId.mockResolvedValue({
      positions: [position("shared"), position("account-only")],
      errors: [],
    });

    const { usePositions } = await import("@/hooks/usePositions");
    const { result } = renderHook(() =>
      usePositions(
        "0xSmart",
        undefined,
        ["SolanaEmbedded"],
        60_000,
        ["0xEmbedded"],
        "privy-user-1",
      ),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(apiMock.getB1naryPositionsByPrivyUserId).toHaveBeenCalledTimes(1);
    expect(apiMock.getPositions).not.toHaveBeenCalled();
    expect(result.current.positions.map((item) => item.id)).toEqual([
      "shared",
      "account-only",
    ]);
  });

  it("falls back to unique wallet reads only when there is no Privy ID", async () => {
    apiMock.getPositions.mockImplementation(async (wallet: string) => [
      position(wallet === "0xSmart" ? "shared" : wallet),
    ]);

    const { usePositions } = await import("@/hooks/usePositions");
    const { result } = renderHook(() =>
      usePositions(
        "0xSmart",
        "0xSmart",
        ["SolanaEmbedded", "SolanaEmbedded"],
        60_000,
      ),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(apiMock.getB1naryPositionsByPrivyUserId).not.toHaveBeenCalled();
    expect(apiMock.getPositions).toHaveBeenCalledTimes(2);
    expect(result.current.positions).toHaveLength(2);
  });

  it("deduplicates Base addresses case-insensitively and preserves Solana case", async () => {
    const { usePositions } = await import("@/hooks/usePositions");
    const { result } = renderHook(() =>
      usePositions(
        "0xAbCd",
        undefined,
        ["SolCase", "solcase"],
        60_000,
        ["0xabcd", "0xABCD"],
      ),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(apiMock.getPositions).toHaveBeenCalledTimes(3);
    expect(apiMock.getPositions).toHaveBeenCalledWith("0xabcd");
    expect(apiMock.getPositions).toHaveBeenCalledWith("SolCase");
    expect(apiMock.getPositions).toHaveBeenCalledWith("solcase");
  });

  it("ignores an obsolete Privy response after the user changes", async () => {
    const userA = deferred<{ positions: ReturnType<typeof position>[]; errors: never[] }>();
    const userB = deferred<{ positions: ReturnType<typeof position>[]; errors: never[] }>();
    const userC = deferred<{ positions: ReturnType<typeof position>[]; errors: never[] }>();
    apiMock.getB1naryPositionsByPrivyUserId.mockImplementation(
      (userId: string) => {
        if (userId === "privy-a") return userA.promise;
        if (userId === "privy-b") return userB.promise;
        return userC.promise;
      },
    );

    const { usePositions } = await import("@/hooks/usePositions");
    const { result, rerender } = renderHook(
      ({ userId }: { userId?: string }) =>
        usePositions(undefined, undefined, undefined, 60_000, undefined, userId),
      { initialProps: { userId: "privy-a" as string | undefined } },
    );
    await flushRequests();
    rerender({ userId: "privy-b" });
    await flushRequests();
    expect(result.current.positions).toEqual([]);

    await act(async () => {
      userB.resolve({ positions: [position("user-b")], errors: [] });
      await Promise.resolve();
    });
    expect(result.current.positions.map((item) => item.id)).toEqual(["user-b"]);

    await act(async () => {
      userA.resolve({ positions: [position("user-a")], errors: [] });
      await Promise.resolve();
    });
    expect(result.current.positions.map((item) => item.id)).toEqual(["user-b"]);

    rerender({ userId: "privy-c" });
    await flushRequests();
    rerender({ userId: undefined });
    expect(result.current.positions).toEqual([]);
    await act(async () => {
      userC.resolve({ positions: [position("user-c")], errors: [] });
      await Promise.resolve();
    });
    expect(result.current.positions).toEqual([]);
  });

  it("pauses while hidden and starts bounded fast feedback after a trade", async () => {
    vi.useFakeTimers();
    let visibility: DocumentVisibilityState = "visible";
    vi.spyOn(document, "visibilityState", "get").mockImplementation(
      () => visibility,
    );

    const { usePositions } = await import("@/hooks/usePositions");
    const { unmount } = renderHook(() =>
      usePositions(undefined, undefined, undefined, 15_000, undefined, "privy-1"),
    );
    await flushRequests();
    expect(apiMock.getB1naryPositionsByPrivyUserId).toHaveBeenCalledTimes(1);

    visibility = "hidden";
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    await act(async () => vi.advanceTimersByTimeAsync(60_000));
    expect(apiMock.getB1naryPositionsByPrivyUserId).toHaveBeenCalledTimes(1);

    visibility = "visible";
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    await flushRequests();
    expect(apiMock.getB1naryPositionsByPrivyUserId).toHaveBeenCalledTimes(2);

    act(() => invalidateData(["positions"], "trade-confirmed"));
    await flushRequests();
    expect(apiMock.getB1naryPositionsByPrivyUserId).toHaveBeenCalledTimes(3);
    await act(async () => vi.advanceTimersByTimeAsync(30_000));
    expect(apiMock.getB1naryPositionsByPrivyUserId).toHaveBeenCalledTimes(13);
    await act(async () => vi.advanceTimersByTimeAsync(14_999));
    expect(apiMock.getB1naryPositionsByPrivyUserId).toHaveBeenCalledTimes(13);

    unmount();
    vi.useRealTimers();
  });

  it("queues one immediate uncached trailing read for repeated invalidations", async () => {
    vi.useFakeTimers();
    const beforeTrade = deferred<{
      positions: ReturnType<typeof position>[];
      errors: never[];
    }>();
    const afterTrade = deferred<{
      positions: ReturnType<typeof position>[];
      errors: never[];
    }>();
    apiMock.getB1naryPositionsByPrivyUserId
      .mockImplementationOnce(() => beforeTrade.promise)
      .mockImplementationOnce(() => afterTrade.promise);

    const { usePositions } = await import("@/hooks/usePositions");
    const { result, unmount } = renderHook(() =>
      usePositions(undefined, undefined, undefined, 15_000, undefined, "privy-1"),
    );
    await flushRequests();
    expect(apiMock.getB1naryPositionsByPrivyUserId).toHaveBeenCalledTimes(1);

    act(() => {
      invalidateData(["positions"], "trade-confirmed");
      invalidateData(["positions"], "trade-confirmed");
      window.dispatchEvent(new Event("balance:refetch"));
    });
    await flushRequests();
    expect(apiMock.getB1naryPositionsByPrivyUserId).toHaveBeenCalledTimes(1);

    await act(async () => {
      beforeTrade.resolve({
        positions: [position("before-trade")],
        errors: [],
      });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(apiMock.getB1naryPositionsByPrivyUserId).toHaveBeenCalledTimes(2);

    await act(async () => {
      afterTrade.resolve({
        positions: [position("after-trade")],
        errors: [],
      });
      await Promise.resolve();
    });
    expect(apiMock.getB1naryPositionsByPrivyUserId).toHaveBeenCalledTimes(2);
    expect(result.current.positions.map((item) => item.id)).toEqual([
      "after-trade",
    ]);
    unmount();
  });
});
