import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearSharedRequests } from "@/lib/sharedRequest";
import type { PriceQuote } from "@/lib/api";

const apiMock = vi.hoisted(() => ({ getPrices: vi.fn() }));
vi.mock("@/lib/api", () => ({ api: apiMock }));

async function flushRequests() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("usePrices", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    clearSharedRequests();
    apiMock.getPrices.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("bounds empty quote retries to one non-accumulating fast window", async () => {
    const { usePrices } = await import("@/hooks/usePrices");
    const { unmount } = renderHook(() => usePrices("eth", 10_000));
    await flushRequests();
    expect(apiMock.getPrices).toHaveBeenCalledTimes(1);

    await act(async () => vi.advanceTimersByTimeAsync(6_000));
    expect(apiMock.getPrices).toHaveBeenCalledTimes(4);
    await act(async () => vi.advanceTimersByTimeAsync(9_999));
    expect(apiMock.getPrices).toHaveBeenCalledTimes(4);
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(apiMock.getPrices).toHaveBeenCalledTimes(5);
    unmount();
  });

  it("ignores a stale quote response after the asset changes", async () => {
    const ethQuotes = [{ quote_id: "eth" }] as unknown as PriceQuote[];
    const btcQuotes = [{ quote_id: "btc" }] as unknown as PriceQuote[];
    let resolveEth!: (value: PriceQuote[]) => void;
    let resolveBtc!: (value: PriceQuote[]) => void;
    apiMock.getPrices.mockImplementation(
      (asset: string) => new Promise<PriceQuote[]>((resolve) => {
        if (asset === "eth") resolveEth = resolve;
        else resolveBtc = resolve;
      }),
    );

    const { usePrices } = await import("@/hooks/usePrices");
    const { result, rerender, unmount } = renderHook(
      ({ asset }: { asset: string }) => usePrices(asset, 10_000),
      { initialProps: { asset: "eth" } },
    );
    await flushRequests();
    rerender({ asset: "btc" });
    await flushRequests();
    expect(result.current.prices).toEqual([]);

    await act(async () => resolveBtc(btcQuotes));
    expect(result.current.prices).toBe(btcQuotes);
    await act(async () => resolveEth(ethQuotes));
    expect(result.current.prices).toBe(btcQuotes);
    unmount();
  });
});
