import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const contractsMock = vi.hoisted(() => ({
  publicClient: { multicall: vi.fn() },
  ADDRESSES: {
    usdc: "0x0000000000000000000000000000000000000001",
    weth: "0x0000000000000000000000000000000000000002",
    wbtc: "0x0000000000000000000000000000000000000003",
  },
  CHAIN: {
    contracts: { multicall3: { address: "0x0000000000000000000000000000000000000004" } },
  },
  ERC20_ABI: [],
}));

vi.mock("@/lib/contracts", () => contractsMock);

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("useBalances", () => {
  it("normalizes address sets, single-flights multicalls, never polls, and enforces cooldown", async () => {
    vi.useFakeTimers({ now: new Date("2026-08-22T00:00:00Z") });
    let hidden = false;
    vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden);
    contractsMock.publicClient.multicall.mockResolvedValue([
      BigInt(1_000_000),
      BigInt("2000000000000000000"),
      BigInt(3_000_000),
      BigInt("4000000000000000000"),
    ]);
    const { useBalances } = await import("@/hooks/useBalances");
    const a = "0x000000000000000000000000000000000000000A" as const;
    const b = "0x000000000000000000000000000000000000000b" as const;
    const first = renderHook(() => useBalances([b, a, b]));
    const second = renderHook(() => useBalances([a.toLowerCase() as typeof a, b]));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(contractsMock.publicClient.multicall).toHaveBeenCalledTimes(2);
    expect(first.result.current.ethRaw).toBe(BigInt("8000000000000000000"));

    await act(async () => vi.advanceTimersByTimeAsync(5 * 60_000));
    expect(contractsMock.publicClient.multicall).toHaveBeenCalledTimes(2);

    act(() => window.dispatchEvent(new Event("focus")));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(contractsMock.publicClient.multicall).toHaveBeenCalledTimes(4);

    act(() => window.dispatchEvent(new Event("balance:refetch")));
    await act(async () => vi.advanceTimersByTimeAsync(5_000));
    hidden = true;
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    await act(async () => vi.advanceTimersByTimeAsync(5_000));
    expect(contractsMock.publicClient.multicall).toHaveBeenCalledTimes(4);
    hidden = false;
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(contractsMock.publicClient.multicall).toHaveBeenCalledTimes(6);

    first.unmount();
    second.unmount();
  });
});
