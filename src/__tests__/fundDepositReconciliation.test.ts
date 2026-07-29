import {
  encodeAbiParameters,
  encodeEventTopics,
  type Address,
  type Hex,
} from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  FundPositionResponse,
  FundSummaryResponse,
} from "@/lib/api";
import {
  applyOptimisticFundDeposits,
  confirmedFundDepositFromReceipt,
  fundDepositIsIndexed,
  fundDepositStorageKey,
  loadOptimisticFundDeposits,
  persistOptimisticFundDeposits,
  unresolvedFundDeposits,
  type OptimisticFundDeposit,
} from "@/lib/fundDepositReconciliation";
import { FUND_VAULT_ABI } from "@/lib/fundVault";

vi.mock("@/lib/contracts", () => ({
  CHAIN: { id: 84532 },
  ADDRESSES: {
    usdc: "0xAB51a471493832C1D70cef8ff937A850cf37c860",
    weth: "0x8A6Aa2304797898d46eC1d342Fedc817D3a973B6",
  },
  ERC20_ABI: [],
}));

const FUND = "0x1000000000000000000000000000000000000001" as Address;
const OTHER_FUND =
  "0x2000000000000000000000000000000000000002" as Address;
const USER = "0x4000000000000000000000000000000000000004" as Address;
const OTHER_USER =
  "0x5000000000000000000000000000000000000005" as Address;
const HASH = `0x${"a".repeat(64)}` as Hex;

describe("confirmed fund deposit evidence", () => {
  it("decodes exact assets and shares from the trusted fund receipt", () => {
    const deposit = confirmedFundDepositFromReceipt({
      receipt: depositReceipt({
        fundAddress: FUND,
        owner: USER,
        assets: BigInt(194_000000),
        shares: BigInt("200000000000000000000"),
      }),
      transactionHash: HASH,
      fundKey: "base-sepolia:csp",
      fundAddress: FUND,
      smartWallet: USER,
      positionSharesBefore: BigInt("100000000000000000000"),
      confirmedAt: 1_000,
    });

    expect(deposit).toMatchObject({
      transactionHash: HASH,
      fundKey: "base-sepolia:csp",
      fundAddress: FUND,
      smartWallet: USER,
      sender: USER,
      assets: "194000000",
      shares: "200000000000000000000",
      blockNumber: "101",
      positionSharesBefore: "100000000000000000000",
      confirmedAt: 1_000,
    });
  });

  it("rejects reverted receipts and deposits from another fund or receiver", () => {
    const base = {
      transactionHash: HASH,
      fundKey: "base-sepolia:csp",
      fundAddress: FUND,
      smartWallet: USER,
      positionSharesBefore: BigInt(0),
    };
    expect(() =>
      confirmedFundDepositFromReceipt({
        ...base,
        receipt: {
          ...depositReceipt({ fundAddress: FUND, owner: USER }),
          status: "reverted",
        },
      }),
    ).toThrow(/reverted/i);
    expect(() =>
      confirmedFundDepositFromReceipt({
        ...base,
        receipt: depositReceipt({
          fundAddress: OTHER_FUND,
          owner: USER,
        }),
      }),
    ).toThrow(/trusted deposit/i);
    expect(() =>
      confirmedFundDepositFromReceipt({
        ...base,
        receipt: depositReceipt({
          fundAddress: FUND,
          owner: OTHER_USER,
        }),
      }),
    ).toThrow(/trusted deposit/i);
  });
});

describe("optimistic fund deposit overlay", () => {
  it("updates USDC shares, accounting value, fund size, idle and gross assets", () => {
    const summary = fundSummary();
    const position = fundPosition();
    const deposit = optimisticDeposit({
      assets: "194000000",
      shares: "200000000000000000000",
    });

    const display = applyOptimisticFundDeposits(
      summary,
      position,
      [deposit],
      USER,
    )!;

    expect(display.summary.netAssets).toBe("1164000000");
    expect(display.summary.shareSupply).toBe("1200000000000000000000");
    expect(display.summary.sharePriceAssets).toBe("970000");
    expect(display.summary.composition.idleAssets).toBe("394000000");
    expect(display.summary.composition.grossAssets).toBe("1194000000");
    expect(display.position?.shares).toBe("300000000000000000000");
    expect(display.position?.accountingValue).toBe("291000000");
    expect(summary.netAssets).toBe("970000000");
    expect(position.shares).toBe("100000000000000000000");
  });

  it("uses the same exact arithmetic for an 18-decimal WETH fund", () => {
    const summary = fundSummary({
      fundKey: "base-sepolia:covered-call",
      assetSymbol: "WETH",
      assetDecimals: 18,
      netAssets: "8500000000000000000",
      shareSupply: "1000000000000000000000",
      sharePriceAssets: "8500000000000000",
      idleAssets: "6500000000000000000",
      grossAssets: "9000000000000000000",
    });
    const position = fundPosition({
      fundKey: "base-sepolia:covered-call",
      shares: "100000000000000000000",
      accountingValue: "850000000000000000",
    });
    const deposit = optimisticDeposit({
      fundKey: "base-sepolia:covered-call",
      assets: "850000000000000000",
      shares: "100000000000000000000",
    });

    const display = applyOptimisticFundDeposits(
      summary,
      position,
      [deposit],
      USER,
    )!;

    expect(display.summary.netAssets).toBe("9350000000000000000");
    expect(display.summary.composition.idleAssets).toBe(
      "7350000000000000000",
    );
    expect(display.summary.sharePriceAssets).toBe("8500000000000000");
    expect(display.position?.shares).toBe("200000000000000000000");
    expect(display.position?.accountingValue).toBe("1700000000000000000");
  });

  it("does not double count once block and canonical shares include the deposit", () => {
    const deposit = optimisticDeposit({
      shares: "20000000000000000000",
      positionSharesBefore: "100000000000000000000",
    });
    const snapshot = {
      summary: fundSummary({ asOfBlock: 101 }),
      position: fundPosition({
        shares: "120000000000000000000",
        asOfBlock: 101,
      }),
    };

    expect(fundDepositIsIndexed(snapshot, deposit)).toBe(true);
    expect(unresolvedFundDeposits(snapshot, [deposit])).toEqual([]);
    const display = applyOptimisticFundDeposits(
      snapshot.summary,
      snapshot.position,
      [deposit],
      USER,
    )!;
    expect(display.summary).toBe(snapshot.summary);
    expect(display.position).toBe(snapshot.position);
  });

  it("keeps the overlay while indexed shares are still on an older block", () => {
    const deposit = optimisticDeposit({
      shares: "20000000000000000000",
      positionSharesBefore: "100000000000000000000",
    });
    const snapshot = {
      summary: fundSummary({ asOfBlock: 100 }),
      position: fundPosition({
        shares: "120000000000000000000",
        asOfBlock: 100,
      }),
    };

    expect(fundDepositIsIndexed(snapshot, deposit)).toBe(false);
    expect(unresolvedFundDeposits(snapshot, [deposit])).toEqual([deposit]);
  });
});

describe("optimistic deposit session recovery", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("restores unresolved records by fund and smart wallet", () => {
    const deposit = optimisticDeposit();
    persistOptimisticFundDeposits("base-sepolia:csp", USER, [deposit]);

    expect(
      window.sessionStorage.getItem(
        fundDepositStorageKey("base-sepolia:csp", USER),
      ),
    ).toContain(HASH);
    expect(loadOptimisticFundDeposits("base-sepolia:csp", USER)).toEqual([
      deposit,
    ]);
    expect(
      loadOptimisticFundDeposits("base-sepolia:csp", OTHER_USER),
    ).toEqual([]);
  });
});

function depositReceipt({
  fundAddress,
  owner,
  assets = BigInt(100_000000),
  shares = BigInt("100000000000000000000"),
}: {
  fundAddress: Address;
  owner: Address;
  assets?: bigint;
  shares?: bigint;
}) {
  const topics = encodeEventTopics({
    abi: FUND_VAULT_ABI,
    eventName: "Deposit",
    args: { sender: USER, owner },
  });
  const data = encodeAbiParameters(
    [{ type: "uint256" }, { type: "uint256" }],
    [assets, shares],
  );
  return {
    status: "success" as const,
    blockNumber: BigInt(101),
    logs: [{ address: fundAddress, topics, data }],
  } as unknown as Parameters<
    typeof confirmedFundDepositFromReceipt
  >[0]["receipt"];
}

function optimisticDeposit(
  overrides: Partial<OptimisticFundDeposit> = {},
): OptimisticFundDeposit {
  return {
    transactionHash: HASH,
    fundKey: "base-sepolia:csp",
    fundAddress: FUND,
    smartWallet: USER,
    sender: USER,
    assets: "97000000",
    shares: "100000000000000000000",
    blockNumber: "101",
    positionSharesBefore: "100000000000000000000",
    confirmedAt: 1_000,
    ...overrides,
  };
}

function fundSummary({
  fundKey = "base-sepolia:csp",
  assetSymbol = "USDC",
  assetDecimals = 6,
  netAssets = "970000000",
  shareSupply = "1000000000000000000000",
  sharePriceAssets = "970000",
  idleAssets = "200000000",
  grossAssets = "1000000000",
  asOfBlock = 100,
}: {
  fundKey?: string;
  assetSymbol?: string;
  assetDecimals?: number;
  netAssets?: string;
  shareSupply?: string;
  sharePriceAssets?: string;
  idleAssets?: string;
  grossAssets?: string;
  asOfBlock?: number;
} = {}): FundSummaryResponse {
  return {
    fund: {
      fundKey,
      chainId: 84532,
      fundAddress: FUND,
      shareToken: {
        address: OTHER_FUND,
        symbol: "b1FUND",
        decimals: 18,
      },
      accountingAsset: {
        address: "0x3000000000000000000000000000000000000003",
        symbol: assetSymbol,
        decimals: assetDecimals,
      },
      deploymentStatus: "DEPLOYED",
    },
    netAssets,
    shareSupply,
    virtualShares: "0",
    sharePriceAssets,
    composition: {
      idleAssets,
      strategyAccountingAssets: "800000000",
      assignedWeth: "0",
      reservedClaimAssets: "0",
      grossAssets,
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
    actions: {
      deposit: { available: true, reasonCode: null },
      requestRedemption: { available: true, reasonCode: null },
      cancelRedemption: { available: false, reasonCode: null },
      claimRedemption: { available: false, reasonCode: null },
    },
    asOfBlock,
    asOfBlockHash: null,
    indexedAt: "2026-07-29T00:00:00Z",
    stale: false,
  };
}

function fundPosition({
  fundKey = "base-sepolia:csp",
  shares = "100000000000000000000",
  accountingValue = "97000000",
  asOfBlock = 100,
}: {
  fundKey?: string;
  shares?: string;
  accountingValue?: string;
  asOfBlock?: number;
} = {}): FundPositionResponse {
  return {
    fundKey,
    address: USER,
    shares,
    accountingValue,
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
    actions: fundSummary().actions,
    asOfBlock,
    indexedAt: "2026-07-29T00:00:00Z",
    stale: false,
  };
}
