import { act, renderHook } from "@testing-library/react";
import type { Address } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useFundVault } from "@/hooks/useFundVault";

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
  fundTrustError: vi.fn(() => null),
}));

const USER = "0x4000000000000000000000000000000000000004" as Address;

async function flushRequests() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("useFundVault refresh policy", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    mocks.getFund.mockResolvedValue({ fund: { fundKey: "base-sepolia:csp" } });
    mocks.getConfig.mockResolvedValue({ fundKey: "base-sepolia:csp" });
    mocks.getPosition.mockResolvedValue({ address: USER });
  });

  it("refreshes on lifecycle, manual events, and while the page is visible", async () => {
    vi.useFakeTimers();
    const intervalSpy = vi.spyOn(window, "setInterval");
    const { result, rerender, unmount } = renderHook(
      ({ address }: { address: Address | undefined }) => useFundVault(address),
      { initialProps: { address: undefined as Address | undefined } },
    );
    await flushRequests();
    expect(mocks.getFund).toHaveBeenCalledTimes(1);
    expect(mocks.getPosition).not.toHaveBeenCalled();
    rerender({ address: USER });
    await flushRequests();
    expect(mocks.getPosition).toHaveBeenCalledTimes(1);
    act(() => window.dispatchEvent(new Event("focus")));
    await flushRequests();
    expect(mocks.getPosition).toHaveBeenCalledTimes(2);
    await act(async () => result.current.refetch());
    expect(mocks.getPosition).toHaveBeenCalledTimes(3);
    expect(intervalSpy).toHaveBeenCalledWith(expect.any(Function), 5_000);
    await act(async () => {
      vi.advanceTimersByTime(5_000);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mocks.getPosition).toHaveBeenCalledTimes(4);
    unmount();
    vi.useRealTimers();
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
