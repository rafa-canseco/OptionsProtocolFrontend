import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Activity } from "@/lib/api";
import {
  clearDataInvalidations,
  invalidateData,
} from "@/lib/dataInvalidation";

const apiMock = vi.hoisted(() => ({ getActivity: vi.fn() }));
vi.mock("@/lib/api", () => ({ api: apiMock }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}

function activity(wallet: string): Activity {
  return { wallet } as unknown as Activity;
}

async function flushRequests() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("useActivity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearDataInvalidations();
  });

  it("never publishes activity from an obsolete wallet or after logout", async () => {
    const walletA = deferred<Activity>();
    const walletB = deferred<Activity>();
    const walletC = deferred<Activity>();
    apiMock.getActivity.mockImplementation((address: string) => {
      if (address === "wallet-a") return walletA.promise;
      if (address === "wallet-b") return walletB.promise;
      return walletC.promise;
    });

    const { useActivity } = await import("@/hooks/useActivity");
    const { result, rerender } = renderHook(
      ({ address }: { address?: string }) => useActivity(address),
      { initialProps: { address: "wallet-a" as string | undefined } },
    );
    await flushRequests();
    rerender({ address: "wallet-b" });
    await flushRequests();
    expect(result.current.activity).toBeNull();

    await act(async () => walletB.resolve(activity("wallet-b")));
    expect(result.current.activity).toEqual(activity("wallet-b"));
    await act(async () => walletA.resolve(activity("wallet-a")));
    expect(result.current.activity).toEqual(activity("wallet-b"));

    rerender({ address: "wallet-c" });
    await flushRequests();
    rerender({ address: undefined });
    expect(result.current.activity).toBeNull();
    await act(async () => walletC.resolve(activity("wallet-c")));
    expect(result.current.activity).toBeNull();
  });

  it("coalesces repeated invalidations into one trailing activity read", async () => {
    const first = deferred<Activity>();
    const trailing = deferred<Activity>();
    apiMock.getActivity
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => trailing.promise);

    const { useActivity } = await import("@/hooks/useActivity");
    const { result } = renderHook(() => useActivity("wallet-a"));
    await flushRequests();
    expect(apiMock.getActivity).toHaveBeenCalledTimes(1);

    act(() => {
      invalidateData(["activity"], "trade-confirmed");
      invalidateData(["activity"], "trade-confirmed");
      invalidateData(["activity"], "trade-confirmed");
    });
    expect(apiMock.getActivity).toHaveBeenCalledTimes(1);

    await act(async () => {
      first.resolve(activity("before"));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(apiMock.getActivity).toHaveBeenCalledTimes(2);

    await act(async () => trailing.resolve(activity("after")));
    expect(apiMock.getActivity).toHaveBeenCalledTimes(2);
    expect(result.current.activity).toEqual(activity("after"));
  });
});
