import { act, renderHook } from "@testing-library/react";
import type { Address } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useFundVault } from "@/hooks/useFundVault";
import type {
  FundPositionResponse,
  FundSummaryResponse,
} from "@/lib/api";
import {
  fundDepositStorageKey,
  type OptimisticFundDeposit,
} from "@/lib/fundDepositReconciliation";

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
    window.sessionStorage.clear();
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
    let snapshot;
    await act(async () => {
      snapshot = await result.current.refetch();
    });
    expect(snapshot).toEqual({
      summary: { fund: { fundKey: "base-sepolia:csp" } },
      position: { address: USER },
    });
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

  it("preserves stale confirmed evidence and removes it only after canonical indexing", async () => {
    const staleSummary = summary();
    const stalePosition = position();
    mocks.getFund.mockResolvedValue(staleSummary);
    mocks.getConfig.mockResolvedValue({ fundKey: "base-sepolia:csp" });
    mocks.getPosition.mockResolvedValue(stalePosition);
    const { result, unmount } = renderHook(() => useFundVault(USER));
    await flushRequests();

    const deposit: OptimisticFundDeposit = {
      transactionHash: `0x${"a".repeat(64)}`,
      fundKey: "base-sepolia:csp",
      fundAddress: "0x1000000000000000000000000000000000000001",
      smartWallet: USER,
      sender: USER,
      assets: "97000000",
      shares: "100000000000000000000",
      blockNumber: "101",
      positionSharesBefore: stalePosition.shares,
      confirmedAt: Date.now(),
    };
    await act(async () => {
      result.current.addConfirmedDeposit(deposit);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.optimisticDeposits).toEqual([deposit]);
    expect(result.current.summary?.netAssets).toBe("1067000000");
    expect(result.current.position?.shares).toBe(
      "200000000000000000000",
    );
    expect(
      window.sessionStorage.getItem(
        fundDepositStorageKey("base-sepolia:csp", USER),
      ),
    ).toContain(deposit.transactionHash);

    await act(async () => {
      await result.current.refetch();
    });
    expect(result.current.optimisticDeposits).toEqual([deposit]);

    mocks.getFund.mockResolvedValue(
      summary({
        netAssets: "1067000000",
        shareSupply: "1100000000000000000000",
        asOfBlock: 101,
      }),
    );
    mocks.getPosition.mockResolvedValue(
      position({
        shares: "200000000000000000000",
        accountingValue: "194000000",
        asOfBlock: 101,
      }),
    );
    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.optimisticDeposits).toEqual([]);
    expect(result.current.summary?.netAssets).toBe("1067000000");
    expect(
      window.sessionStorage.getItem(
        fundDepositStorageKey("base-sepolia:csp", USER),
      ),
    ).toBeNull();
    unmount();
  });
});

function summary(
  overrides: Partial<FundSummaryResponse> = {},
): FundSummaryResponse {
  return {
    fund: {
      fundKey: "base-sepolia:csp",
      chainId: 84532,
      fundAddress: "0x1000000000000000000000000000000000000001",
      shareToken: {
        address: "0x2000000000000000000000000000000000000002",
        symbol: "b1CSP",
        decimals: 18,
      },
      accountingAsset: {
        address: "0x3000000000000000000000000000000000000003",
        symbol: "USDC",
        decimals: 6,
      },
      deploymentStatus: "DEPLOYED",
    },
    netAssets: "970000000",
    shareSupply: "1000000000000000000000",
    virtualShares: "0",
    sharePriceAssets: "970000",
    composition: {
      idleAssets: "200000000",
      strategyAccountingAssets: "800000000",
      assignedWeth: "0",
      reservedClaimAssets: "0",
      grossAssets: "1000000000",
    },
    nav: {
      reportNonce: 1,
      validAfterBlock: 1,
      validUntilBlock: 1_000,
      stale: false,
    },
    status: {
      reconciled: true,
      depositsPaused: false,
      redemptionsPaused: false,
      executionLocked: false,
      flowProcessing: false,
    },
    actions: actions(),
    asOfBlock: 100,
    asOfBlockHash: null,
    indexedAt: "2026-07-29T00:00:00Z",
    stale: false,
    ...overrides,
  };
}

function position(
  overrides: Partial<FundPositionResponse> = {},
): FundPositionResponse {
  return {
    fundKey: "base-sepolia:csp",
    address: USER,
    shares: "100000000000000000000",
    accountingValue: "97000000",
    redemption: {
      pendingShares: "0",
      claimableShares: "0",
      claimableAssets: "0",
      status: "idle",
      nextAction: "none",
      latestBatchId: 0,
      latestBatchProcessing: false,
      latestBatchUnwindCommitted: false,
    },
    actions: actions(),
    asOfBlock: 100,
    indexedAt: "2026-07-29T00:00:00Z",
    stale: false,
    ...overrides,
  };
}

function actions() {
  return {
    deposit: { available: true, reasonCode: null },
    requestRedemption: { available: true, reasonCode: null },
    cancelRedemption: { available: false, reasonCode: null },
    claimRedemption: { available: false, reasonCode: null },
  };
}
