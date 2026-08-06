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
    mocks.getFund.mockResolvedValue({ fund: { fundKey: "base-sepolia:csp" } });
    mocks.getConfig.mockResolvedValue({ fundKey: "base-sepolia:csp" });
    mocks.getPosition.mockResolvedValue({ address: USER });
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

    await act(async () => vi.advanceTimersByTimeAsync(4_999));
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

  it("ignores an obsolete fund position after the wallet changes", async () => {
    const positionA = deferred<{ address: Address }>();
    const positionB = deferred<{ address: Address }>();
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
    expect(result.current.position).toBeNull();

    await act(async () => positionB.resolve({ address: USER_B }));
    expect(result.current.position).toEqual({ address: USER_B });
    await act(async () => positionA.resolve({ address: USER }));
    expect(result.current.position).toEqual({ address: USER_B });
  });

  it("runs one trailing fund refresh after an in-flight transaction refresh", async () => {
    const firstFund = deferred<{ fund: { fundKey: string; version: number } }>();
    mocks.getFund
      .mockImplementationOnce(() => firstFund.promise)
      .mockResolvedValueOnce({
        fund: { fundKey: "base-sepolia:csp", version: 2 },
      });

    const { result } = renderHook(() => useFundVault(USER));
    await flushRequests();
    expect(mocks.getFund).toHaveBeenCalledTimes(1);

    act(() => invalidateData(["vault"], "vault-transaction-confirmed"));
    let manualRefresh!: Promise<void>;
    act(() => {
      manualRefresh = result.current.refetch();
    });
    expect(mocks.getFund).toHaveBeenCalledTimes(1);

    await act(async () => {
      firstFund.resolve({
        fund: { fundKey: "base-sepolia:csp", version: 1 },
      });
      await manualRefresh;
    });
    expect(mocks.getFund).toHaveBeenCalledTimes(2);
    expect(result.current.summary).toEqual({
      fund: { fundKey: "base-sepolia:csp", version: 2 },
    });
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
