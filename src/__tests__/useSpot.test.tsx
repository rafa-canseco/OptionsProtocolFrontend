import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearSharedRequests } from "@/lib/sharedRequest";

const apiMock = vi.hoisted(() => ({ getSpot: vi.fn() }));
vi.mock("@/lib/api", () => ({ api: apiMock }));

describe("useSpot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearSharedRequests();
    apiMock.getSpot.mockResolvedValue({ asset: "eth", spot: 3_500 });
  });

  it("shares the initial request across consumers of the same asset", async () => {
    const { useSpot } = await import("@/hooks/useSpot");
    const first = renderHook(() => useSpot("eth"));
    const second = renderHook(() => useSpot("eth"));

    await waitFor(() => {
      expect(first.result.current.loading).toBe(false);
      expect(second.result.current.loading).toBe(false);
    });
    expect(apiMock.getSpot).toHaveBeenCalledTimes(1);
    first.unmount();
    second.unmount();
  });

  it("ignores a stale asset response after the key changes", async () => {
    let resolveEth!: (value: { asset: string; spot: number }) => void;
    let resolveBtc!: (value: { asset: string; spot: number }) => void;
    const eth = new Promise<{ asset: string; spot: number }>((resolve) => {
      resolveEth = resolve;
    });
    const btc = new Promise<{ asset: string; spot: number }>((resolve) => {
      resolveBtc = resolve;
    });
    apiMock.getSpot.mockImplementation((asset: string) =>
      asset === "eth" ? eth : btc,
    );

    const { useSpot } = await import("@/hooks/useSpot");
    const { result, rerender } = renderHook(
      ({ asset }: { asset: string }) => useSpot(asset),
      { initialProps: { asset: "eth" } },
    );
    rerender({ asset: "btc" });
    expect(result.current.spot).toBeUndefined();

    await act(async () => resolveBtc({ asset: "btc", spot: 70_000 }));
    expect(result.current.spot).toBe(70_000);
    await act(async () => resolveEth({ asset: "eth", spot: 3_500 }));
    expect(result.current.spot).toBe(70_000);
  });
});
