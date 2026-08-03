import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  YieldStats,
  YieldUserHistory,
  YieldUserPositions,
  YieldUserSummary,
} from "@/lib/api";
import {
  clearDataInvalidations,
  invalidateData,
} from "@/lib/dataInvalidation";

const apiMock = vi.hoisted(() => ({
  getYieldSummary: vi.fn(),
  getYieldPositions: vi.fn(),
  getYieldHistory: vi.fn(),
  getYieldStats: vi.fn(),
}));
vi.mock("@/lib/api", () => ({ api: apiMock }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}

function summary(wallet: string): YieldUserSummary {
  return { wallet, assets: [] } as YieldUserSummary;
}

function positions(wallet: string): YieldUserPositions {
  return { wallet, positions: [], totals: [] } as YieldUserPositions;
}

function history(wallet: string): YieldUserHistory {
  return { wallet, history: [] } as YieldUserHistory;
}

const stats = {} as YieldStats;

async function flushRequests() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("useYield", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearDataInvalidations();
    apiMock.getYieldPositions.mockImplementation(async (wallet: string) =>
      positions(wallet),
    );
    apiMock.getYieldHistory.mockImplementation(async (wallet: string) =>
      history(wallet),
    );
    apiMock.getYieldStats.mockResolvedValue(stats);
  });

  it("never publishes yield data from an obsolete wallet or after logout", async () => {
    const walletA = deferred<YieldUserSummary>();
    const walletB = deferred<YieldUserSummary>();
    const walletC = deferred<YieldUserSummary>();
    apiMock.getYieldSummary.mockImplementation((wallet: string) => {
      if (wallet === "wallet-a") return walletA.promise;
      if (wallet === "wallet-b") return walletB.promise;
      return walletC.promise;
    });

    const { useYield } = await import("@/hooks/useYield");
    const { result, rerender } = renderHook(
      ({ address }: { address?: string }) => useYield(address),
      { initialProps: { address: "wallet-a" as string | undefined } },
    );
    await flushRequests();
    rerender({ address: "wallet-b" });
    await flushRequests();
    expect(result.current.summary).toBeNull();

    await act(async () => walletB.resolve(summary("wallet-b")));
    expect(result.current.summary?.wallet).toBe("wallet-b");
    await act(async () => walletA.resolve(summary("wallet-a")));
    expect(result.current.summary?.wallet).toBe("wallet-b");

    rerender({ address: "wallet-c" });
    await flushRequests();
    rerender({ address: undefined });
    expect(result.current.summary).toBeNull();
    await act(async () => walletC.resolve(summary("wallet-c")));
    expect(result.current.summary).toBeNull();
  });

  it("coalesces repeated invalidations into one trailing yield read", async () => {
    const first = deferred<YieldUserSummary>();
    const trailing = deferred<YieldUserSummary>();
    apiMock.getYieldSummary
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => trailing.promise);

    const { useYield } = await import("@/hooks/useYield");
    const { result } = renderHook(() => useYield("wallet-a"));
    await flushRequests();
    expect(apiMock.getYieldSummary).toHaveBeenCalledTimes(1);

    act(() => {
      invalidateData(["yield"], "trade-confirmed");
      invalidateData(["yield"], "trade-confirmed");
      invalidateData(["yield"], "trade-confirmed");
    });
    expect(apiMock.getYieldSummary).toHaveBeenCalledTimes(1);

    await act(async () => {
      first.resolve(summary("before"));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(apiMock.getYieldSummary).toHaveBeenCalledTimes(2);

    await act(async () => trailing.resolve(summary("after")));
    expect(apiMock.getYieldSummary).toHaveBeenCalledTimes(2);
    expect(apiMock.getYieldPositions).toHaveBeenCalledTimes(2);
    expect(apiMock.getYieldHistory).toHaveBeenCalledTimes(2);
    expect(apiMock.getYieldStats).toHaveBeenCalledTimes(2);
    expect(result.current.summary?.wallet).toBe("after");
  });
});
