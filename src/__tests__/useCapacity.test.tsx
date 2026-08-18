import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearSharedRequests } from "@/lib/sharedRequest";
import type { Capacity } from "@/lib/api";

const apiMock = vi.hoisted(() => ({ getCapacity: vi.fn() }));
vi.mock("@/lib/api", () => ({ api: apiMock }));

async function flushRequests() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("useCapacity refresh policy", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    clearSharedRequests();
    apiMock.getCapacity.mockResolvedValue({ asset: "btc", availableUsd: 1_000 });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("makes no hidden requests and refreshes once stale on visibility", async () => {
    let visibility: DocumentVisibilityState = "visible";
    vi.spyOn(document, "visibilityState", "get").mockImplementation(
      () => visibility,
    );
    const { useCapacity } = await import("@/hooks/useCapacity");
    const { unmount } = renderHook(() => useCapacity("btc", 30_000));
    await flushRequests();
    expect(apiMock.getCapacity).toHaveBeenCalledTimes(1);

    visibility = "hidden";
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    await act(async () => vi.advanceTimersByTimeAsync(120_000));
    expect(apiMock.getCapacity).toHaveBeenCalledTimes(1);

    visibility = "visible";
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    await flushRequests();
    expect(apiMock.getCapacity).toHaveBeenCalledTimes(2);
    unmount();
  });

  it("ignores a stale capacity response after the asset changes", async () => {
    const ethCapacity = { asset: "eth", availableUsd: 2_000 } as unknown as Capacity;
    const btcCapacity = { asset: "btc", availableUsd: 1_000 } as unknown as Capacity;
    let resolveEth!: (value: Capacity) => void;
    let resolveBtc!: (value: Capacity) => void;
    apiMock.getCapacity.mockImplementation(
      (asset: string) => new Promise<Capacity>((resolve) => {
        if (asset === "eth") resolveEth = resolve;
        else resolveBtc = resolve;
      }),
    );

    const { useCapacity } = await import("@/hooks/useCapacity");
    const { result, rerender, unmount } = renderHook(
      ({ asset }: { asset: string }) => useCapacity(asset, 30_000),
      { initialProps: { asset: "eth" } },
    );
    await flushRequests();
    rerender({ asset: "btc" });
    await flushRequests();
    expect(result.current.capacity).toBeNull();

    await act(async () => resolveBtc(btcCapacity));
    expect(result.current.capacity).toBe(btcCapacity);
    await act(async () => resolveEth(ethCapacity));
    expect(result.current.capacity).toBe(btcCapacity);
    unmount();
  });
});
