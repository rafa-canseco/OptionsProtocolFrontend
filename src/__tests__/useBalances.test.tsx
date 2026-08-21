import { act, renderHook, waitFor } from "@testing-library/react";
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

describe("useBalances", () => {
  afterEach(() => vi.clearAllMocks());

  it("uses one multicall per address and retains cache, deduplication, and forced refresh", async () => {
    contractsMock.publicClient.multicall.mockResolvedValue([
      BigInt(1_000_000), BigInt("2000000000000000000"), BigInt(3_000_000), BigInt("4000000000000000000"),
    ]);
    const { useBalances } = await import("@/hooks/useBalances");
    const address = "0x0000000000000000000000000000000000000005" as const;
    const first = renderHook(() => useBalances(address));
    const second = renderHook(() => useBalances(address));

    await waitFor(() => {
      expect(contractsMock.publicClient.multicall).toHaveBeenCalledTimes(1);
      expect(first.result.current.ethRaw).toBe(BigInt("4000000000000000000"));
    });
    expect(contractsMock.publicClient.multicall).toHaveBeenLastCalledWith({
      allowFailure: false,
      contracts: expect.arrayContaining([
        expect.objectContaining({ address: contractsMock.ADDRESSES.usdc, functionName: "balanceOf", args: [address] }),
        expect.objectContaining({ address: contractsMock.ADDRESSES.weth, functionName: "balanceOf", args: [address] }),
        expect.objectContaining({ address: contractsMock.ADDRESSES.wbtc, functionName: "balanceOf", args: [address] }),
        expect.objectContaining({ address: contractsMock.CHAIN.contracts.multicall3.address, functionName: "getEthBalance", args: [address] }),
      ]),
    });

    await act(async () => { await first.result.current.refetch(); });
    expect(contractsMock.publicClient.multicall).toHaveBeenCalledTimes(1);
    await act(async () => { await first.result.current.refetch(true); });
    expect(contractsMock.publicClient.multicall).toHaveBeenCalledTimes(2);
    first.unmount();
    second.unmount();
  });
});
