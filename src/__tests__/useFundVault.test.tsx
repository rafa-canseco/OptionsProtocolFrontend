import { act, renderHook } from "@testing-library/react";
import { StrictMode, type ReactNode } from "react";
import type { Address } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFundVault } from "@/hooks/useFundVault";
import { invalidateData } from "@/lib/dataInvalidation";
import { clearSharedRequests } from "@/lib/sharedRequest";

const mocks = vi.hoisted(() => ({
  getFund: vi.fn(),
  getConfig: vi.fn(),
  getPosition: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  api: {
    getFund: mocks.getFund,
    getFundConfig: mocks.getConfig,
    getFundPosition: mocks.getPosition,
  },
}));

vi.mock("@/lib/fundVault", () => ({
  FUND_KEY: "base-sepolia:csp",
  FUND_ADDRESS: "0x1000000000000000000000000000000000000001",
  configuredFundKey: vi.fn(() => "base-sepolia:csp"),
  configuredFundAddress: vi.fn(
    () => "0x1000000000000000000000000000000000000001",
  ),
  fundTrustError: vi.fn(() => null),
}));

const USER = "0x4000000000000000000000000000000000000004" as Address;
const USER_B = "0x5000000000000000000000000000000000000005" as Address;

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

describe("useFundVault refresh policy", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.clearAllMocks();
    clearSharedRequests();
    mocks.getFund.mockResolvedValue({
      fund: { fundKey: "base-sepolia:csp" },
      generation: 4,
      asOfBlock: 100,
      asOfBlockHash: `0x${"1".repeat(64)}`,
      publishedAt: "2026-08-22T00:00:00Z",
      stale: false,
    });
    mocks.getConfig.mockResolvedValue({ fundKey: "base-sepolia:csp" });
    mocks.getPosition.mockResolvedValue({
      address: USER,
      generation: 4,
      asOfBlock: 100,
      asOfBlockHash: `0x${"1".repeat(64)}`,
      publishedAt: "2026-08-22T00:00:00Z",
      stale: false,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts one dynamic request under StrictMode", async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <StrictMode>{children}</StrictMode>
    );
    const { unmount } = renderHook(() => useFundVault(USER), { wrapper });
    await flushRequests();

    expect(mocks.getFund).toHaveBeenCalledTimes(1);
    expect(mocks.getPosition).toHaveBeenCalledTimes(1);
    expect(mocks.getConfig).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("caches config, pauses hidden polling, and refreshes stale dynamic state", async () => {
    vi.useFakeTimers();
    let visibility: DocumentVisibilityState = "visible";
    vi.spyOn(document, "visibilityState", "get").mockImplementation(
      () => visibility,
    );
    const { rerender, unmount } = renderHook(
      ({ address }: { address: Address | undefined }) => useFundVault(address),
      { initialProps: { address: undefined as Address | undefined } },
    );
    await flushRequests();
    expect(mocks.getFund).toHaveBeenCalledTimes(1);
    expect(mocks.getConfig).toHaveBeenCalledTimes(1);
    expect(mocks.getPosition).not.toHaveBeenCalled();

    rerender({ address: USER });
    await flushRequests();
    expect(mocks.getFund).toHaveBeenCalledTimes(2);
    expect(mocks.getConfig).toHaveBeenCalledTimes(1);
    expect(mocks.getPosition).toHaveBeenCalledTimes(1);

    await act(async () => vi.advanceTimersByTimeAsync(29_999));
    expect(mocks.getFund).toHaveBeenCalledTimes(2);
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(mocks.getFund).toHaveBeenCalledTimes(3);
    expect(mocks.getConfig).toHaveBeenCalledTimes(1);
    expect(mocks.getPosition).toHaveBeenCalledTimes(2);

    act(() => window.dispatchEvent(new Event("focus")));
    await flushRequests();
    expect(mocks.getFund).toHaveBeenCalledTimes(3);

    visibility = "hidden";
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    await act(async () => vi.advanceTimersByTimeAsync(60_000));
    expect(mocks.getFund).toHaveBeenCalledTimes(3);

    visibility = "visible";
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    await flushRequests();
    expect(mocks.getFund).toHaveBeenCalledTimes(4);
    expect(mocks.getConfig).toHaveBeenCalledTimes(1);
    expect(mocks.getPosition).toHaveBeenCalledTimes(3);

    act(() => invalidateData(["vault"], "vault-transaction-confirmed"));
    await flushRequests();
    expect(mocks.getFund).toHaveBeenCalledTimes(5);
    expect(mocks.getConfig).toHaveBeenCalledTimes(1);
    expect(mocks.getPosition).toHaveBeenCalledTimes(4);
    unmount();
  });

  it("keeps config cached for five minutes", async () => {
    vi.useFakeTimers();
    const { unmount } = renderHook(() => useFundVault(USER));
    await flushRequests();
    await act(async () => vi.advanceTimersByTimeAsync(299_999));
    expect(mocks.getConfig).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(mocks.getConfig).toHaveBeenCalledTimes(2);
    unmount();
  });

  it("requests post-transaction generation, block, and equal-height hash bounds", async () => {
    const blockHash = `0x${"2".repeat(64)}`;
    const { result } = renderHook(() => useFundVault(USER));
    await flushRequests();
    mocks.getFund.mockResolvedValueOnce({
      fund: { fundKey: "base-sepolia:csp" },
      generation: 5,
      asOfBlock: 101,
      asOfBlockHash: blockHash,
      publishedAt: "2026-08-22T00:00:30Z",
      stale: false,
    });
    mocks.getPosition.mockResolvedValueOnce({
      address: USER,
      generation: 5,
      asOfBlock: 101,
      asOfBlockHash: blockHash,
      publishedAt: "2026-08-22T00:00:30Z",
      stale: false,
    });

    await act(async () => result.current.refetch({
      minGeneration: 5,
      minBlock: 101,
      minBlockHash: blockHash,
    }));

    expect(mocks.getFund).toHaveBeenLastCalledWith(
      "base-sepolia:csp",
      { minGeneration: 5, minBlock: 101, minBlockHash: blockHash },
      expect.any(AbortSignal),
    );
    expect(mocks.getPosition).toHaveBeenLastCalledWith(
      "base-sepolia:csp",
      USER,
      { minGeneration: 5, minBlock: 101, minBlockHash: blockHash },
      expect.any(AbortSignal),
    );
  });

  it("invalidates an older ordinary poll when a bounded operation publishes first", async () => {
    const oldFund = deferred<Record<string, unknown>>();
    const oldPosition = deferred<Record<string, unknown>>();
    const newerHash = `0x${"2".repeat(64)}`;
    const { result } = renderHook(() => useFundVault(USER));
    await flushRequests();
    mocks.getFund.mockImplementationOnce(() => oldFund.promise).mockResolvedValueOnce({
      fund: { fundKey: "base-sepolia:csp", version: 5 },
      generation: 5,
      asOfBlock: 101,
      asOfBlockHash: newerHash,
      publishedAt: "2026-08-22T00:00:30Z",
      stale: false,
    });
    mocks.getPosition.mockImplementationOnce(() => oldPosition.promise).mockResolvedValueOnce({
      address: USER,
      generation: 5,
      asOfBlock: 101,
      asOfBlockHash: newerHash,
      publishedAt: "2026-08-22T00:00:30Z",
      stale: false,
    });

    let ordinary!: Promise<unknown>;
    act(() => { ordinary = result.current.refetch(); });
    await flushRequests();
    await act(async () => result.current.refetch({
      minGeneration: 5,
      minBlock: 101,
      minBlockHash: newerHash,
    }));
    expect(result.current.summary).toMatchObject({
      generation: 5,
      fund: { version: 5 },
    });
    expect(result.current.position).toMatchObject({ generation: 5 });

    await act(async () => {
      oldFund.resolve({
        fund: { fundKey: "base-sepolia:csp", version: 4 },
        generation: 4,
        asOfBlock: 100,
        asOfBlockHash: `0x${"1".repeat(64)}`,
        publishedAt: "2026-08-22T00:00:00Z",
        stale: false,
      });
      oldPosition.resolve({
        address: USER,
        generation: 4,
        asOfBlock: 100,
        asOfBlockHash: `0x${"1".repeat(64)}`,
        publishedAt: "2026-08-22T00:00:00Z",
        stale: false,
      });
      await ordinary;
    });
    expect(result.current.summary).toMatchObject({
      generation: 5,
      fund: { version: 5 },
    });
    expect(result.current.position).toMatchObject({ generation: 5 });
  });

  it("bounds a hung post-transaction request to 120 seconds without changing global stale", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useFundVault(USER));
    await flushRequests();
    const prior = result.current.summary;
    mocks.getFund.mockImplementationOnce(
      (_fundKey: string, _freshness: unknown, signal: AbortSignal) =>
        new Promise((_, reject) => signal.addEventListener("abort", () => reject(new Error("aborted")))),
    );
    const operation = result.current.refetch({
      minGeneration: 5,
      minBlock: 101,
      minBlockHash: `0x${"2".repeat(64)}`,
    }).catch((error) => error as Error);

    await act(async () => vi.advanceTimersByTimeAsync(120_000));
    const error = await operation;
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/still pending/i);
    expect(result.current.summary).toBe(prior);
    expect(result.current.error).toBeNull();
  });

  it("times out repeated stale Backend responses at exactly 120 seconds", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useFundVault(USER));
    await flushRequests();
    let settled = false;
    const operation = result.current.refetch({
      minGeneration: 5,
      minBlock: 101,
      minBlockHash: `0x${"2".repeat(64)}`,
    }).catch((error) => error as Error).finally(() => { settled = true; });

    await act(async () => vi.advanceTimersByTimeAsync(119_999));
    expect(settled).toBe(false);
    await act(async () => vi.advanceTimersByTimeAsync(1));
    const error = await operation;
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/still pending/i);
  });

  it("ignores obsolete summary and position responses after the wallet changes", async () => {
    const fundA = deferred<Record<string, unknown>>();
    const fundB = deferred<Record<string, unknown>>();
    const positionA = deferred<Record<string, unknown>>();
    const positionB = deferred<Record<string, unknown>>();
    mocks.getFund
      .mockImplementationOnce(() => fundA.promise)
      .mockImplementationOnce(() => fundB.promise);
    mocks.getPosition.mockImplementation((_: string, address: Address) =>
      address === USER ? positionA.promise : positionB.promise,
    );

    const { result, rerender } = renderHook(
      ({ address }: { address: Address }) => useFundVault(address),
      { initialProps: { address: USER } },
    );
    await flushRequests();
    rerender({ address: USER_B });
    await flushRequests();
    const newer = {
      generation: 5,
      asOfBlock: 101,
      asOfBlockHash: `0x${"2".repeat(64)}`,
      publishedAt: "2026-08-22T00:00:30Z",
      stale: false,
    };
    await act(async () => {
      fundB.resolve({ fund: { fundKey: "base-sepolia:csp", version: 5 }, ...newer });
      positionB.resolve({ address: USER_B, ...newer });
    });
    expect(result.current.summary).toMatchObject({ fund: { version: 5 } });
    expect(result.current.position).toMatchObject({ address: USER_B });

    const older = {
      generation: 4,
      asOfBlock: 100,
      asOfBlockHash: `0x${"1".repeat(64)}`,
      publishedAt: "2026-08-22T00:00:00Z",
      stale: false,
    };
    await act(async () => {
      fundA.resolve({ fund: { fundKey: "base-sepolia:csp", version: 4 }, ...older });
      positionA.resolve({ address: USER, ...older });
    });
    expect(result.current.summary).toMatchObject({ fund: { version: 5 } });
    expect(result.current.position).toMatchObject({ address: USER_B });
  });

  it("runs one trailing fund refresh after an in-flight transaction refresh", async () => {
    const metadata = {
      generation: 4,
      asOfBlock: 100,
      asOfBlockHash: `0x${"1".repeat(64)}`,
      publishedAt: "2026-08-22T00:00:00Z",
      stale: false,
    };
    const firstFund = deferred<{
      fund: { fundKey: string; version: number };
    } & typeof metadata>();
    mocks.getFund
      .mockImplementationOnce(() => firstFund.promise)
      .mockResolvedValueOnce({
        fund: { fundKey: "base-sepolia:csp", version: 2 },
        ...metadata,
      });

    const { result } = renderHook(() => useFundVault(USER));
    await flushRequests();
    expect(mocks.getFund).toHaveBeenCalledTimes(1);

    act(() => invalidateData(["vault"], "vault-transaction-confirmed"));
    let manualRefresh!: Promise<unknown>;
    act(() => {
      manualRefresh = result.current.refetch();
    });
    expect(mocks.getFund).toHaveBeenCalledTimes(1);

    await act(async () => {
      firstFund.resolve({
        fund: { fundKey: "base-sepolia:csp", version: 1 },
        ...metadata,
      });
      await manualRefresh;
    });
    expect(mocks.getFund).toHaveBeenCalledTimes(2);
    expect(result.current.summary).toMatchObject({
      fund: { fundKey: "base-sepolia:csp", version: 2 },
    });
  });

  it("never combines different Backend snapshot generations", async () => {
    const { result } = renderHook(() => useFundVault(USER));
    await flushRequests();
    const prior = result.current.summary;
    mocks.getFund.mockResolvedValueOnce({
      ...prior!,
      generation: 5,
      asOfBlock: 101,
    });
    mocks.getPosition.mockResolvedValueOnce({
      ...result.current.position!,
      generation: 6,
      asOfBlock: 101,
    });

    await act(async () => result.current.refetch());
    expect(result.current.summary).toBe(prior);
    expect(result.current.error).toMatch(/not coherent/i);
  });

  it("preserves the last snapshot when refresh fails", async () => {
    const { result } = renderHook(() => useFundVault(USER));
    await flushRequests();
    const prior = result.current.summary;
    mocks.getFund.mockRejectedValueOnce(new Error("offline"));
    await act(async () => result.current.refetch());
    expect(result.current.summary).toBe(prior);
    expect(result.current.error).toBe("offline");
  });
});
