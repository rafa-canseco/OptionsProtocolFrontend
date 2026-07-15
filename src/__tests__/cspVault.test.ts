import { beforeEach, describe, expect, it, vi } from "vitest";
import { decodeFunctionData, type Address } from "viem";
import {
  ETH_CSP_VAULT_ABI,
  assertCspWriteAllowed,
  buildCspActionCall,
  buildCspDepositCalls,
  deriveCspPositionState,
  getCspWithdrawPlan,
  hasCspPosition,
  mapCspPosition,
  mergeCspVaultConfig,
  minSharesOutForDeposit,
  transactionHashFromResult,
} from "@/lib/cspVault";
import { ERC20_ABI } from "@/lib/contracts";
import type { CspUserPositionResponse, CspVaultResponse } from "@/lib/api";
import { VAULTS } from "@/lib/vaults";

vi.mock("@/lib/contracts", () => ({
  CHAIN: { id: 84532 },
  ADDRESSES: {
    usdc: "0x2222222222222222222222222222222222222222",
    weth: "0x3333333333333333333333333333333333333333",
  },
  ERC20_ABI: [
    {
      type: "function",
      name: "approve",
      inputs: [
        { name: "spender", type: "address" },
        { name: "amount", type: "uint256" },
      ],
      outputs: [{ type: "bool" }],
      stateMutability: "nonpayable",
    },
  ],
}));

const VAULT = "0x1111111111111111111111111111111111111111" as Address;
const USDC = "0x2222222222222222222222222222222222222222" as Address;
const WETH = "0x3333333333333333333333333333333333333333" as Address;
const USER = "0x4444444444444444444444444444444444444444" as Address;

function action(available: boolean, reason: string | null = null) {
  return { available, reason, mode: null };
}

function vault(overrides: Partial<CspVaultResponse> = {}): CspVaultResponse {
  return {
    vaultKey: "base-sepolia:eth-usdc-csp",
    chainId: 84532,
    vaultAddress: VAULT,
    assets: {
      deposit: { symbol: "USDC", address: USDC, decimals: 6 },
      assigned: { symbol: "WETH", address: WETH, decimals: 18 },
    },
    status: "idle",
    summary: {
      totalManagedAssets: "100000000",
      totalShares: "100000000",
      sharePriceAssets: "1000000",
      availableIdleAssets: "100000000",
      activeCollateral: "0",
      activeBatchCount: 0,
      utilizationBps: 0,
      pendingDepositAssets: "0",
      pendingWithdrawalShares: "0",
      accountedUnderlyingAssets: "0",
    },
    currentCycle: {
      epochId: 1,
      status: "idle",
      startedAt: 1,
      endedAt: null,
      premiumEarned: "0",
      performanceFee: "0",
      assignmentShortfall: "0",
      closed: false,
      batchesTruncated: false,
      batches: [],
    },
    asOfBlock: 100,
    indexedAt: "2026-07-15T00:00:00Z",
    finality: "head",
    stale: false,
    ...overrides,
  };
}

function user(overrides: Partial<CspUserPositionResponse> = {}): CspUserPositionResponse {
  return {
    vaultKey: "base-sepolia:eth-usdc-csp",
    chainId: 84532,
    vaultAddress: VAULT,
    address: USER,
    position: {
      activeShares: "100000000",
      activeAssets: "100000000",
      pendingDepositAssets: "0",
      withdrawal: {
        epochId: null,
        shares: "0",
        claimable: false,
        usdcAssets: "0",
        wethAssets: "0",
      },
      claimableAssignedWeth: "0",
    },
    actions: {
      deposit: action(true),
      cancelPendingDeposit: action(false, "NO_PENDING_DEPOSIT"),
      withdrawIdle: action(true),
      requestWithdraw: action(true),
      claimWithdraw: action(false, "NO_CLOSED_WITHDRAWAL"),
      claimAssignedWeth: action(false, "NOTHING_TO_CLAIM"),
    },
    asOfBlock: 100,
    indexedAt: "2026-07-15T00:00:00Z",
    finality: "head",
    stale: false,
    ...overrides,
  };
}

describe("csp vault helpers", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("NEXT_PUBLIC_CSP_VAULT_KEY", "base-sepolia:eth-usdc-csp");
    vi.stubEnv("NEXT_PUBLIC_CSP_VAULT_ADDRESS", VAULT);
  });

  it("blocks writes when the snapshot is stale", () => {
    expect(() => assertCspWriteAllowed(vault({ stale: true }), user(), "deposit", USER))
      .toThrow(/stale/i);
    expect(() => assertCspWriteAllowed(vault(), user({ stale: true }), "deposit", USER))
      .toThrow(/stale/i);
  });

  it("blocks writes when backend action availability is false", () => {
    const blocked = user({
      actions: {
        ...user().actions,
        deposit: action(false, "ACTIVE_BATCHES"),
      },
    });

    expect(() => assertCspWriteAllowed(vault(), blocked, "deposit", USER))
      .toThrow(/ACTIVE_BATCHES/);
  });

  it("blocks writes outside Base Sepolia or when vault addresses disagree", () => {
    expect(() => assertCspWriteAllowed(vault({ chainId: 8453 }), user(), "deposit", USER))
      .toThrow(/Base Sepolia/);
    expect(() =>
      assertCspWriteAllowed(
        vault(),
        user({ vaultAddress: "0x5555555555555555555555555555555555555555" }),
        "deposit",
        USER,
      ),
    ).toThrow(/address mismatch/i);
  });

  it("requires the vault allowlist configuration", () => {
    vi.stubEnv("NEXT_PUBLIC_CSP_VAULT_ADDRESS", "");

    expect(() => assertCspWriteAllowed(vault(), user(), "deposit", USER))
      .toThrow(/allowlist configuration is missing/i);
  });

  it("validates vault key, assets, and connected smart wallet", () => {
    expect(() =>
      assertCspWriteAllowed(vault({ vaultKey: "wrong" }), user(), "deposit", USER),
    ).toThrow(/vault key/i);
    expect(() =>
      assertCspWriteAllowed(
        vault({ assets: { ...vault().assets, deposit: { ...vault().assets.deposit, address: WETH } } }),
        user(),
        "deposit",
        USER,
      ),
    ).toThrow(/configured USDC/i);
    expect(() =>
      assertCspWriteAllowed(
        vault({ assets: { ...vault().assets, assigned: { ...vault().assets.assigned, address: USDC } } }),
        user(),
        "deposit",
        USER,
      ),
    ).toThrow(/configured WETH/i);
    expect(() =>
      assertCspWriteAllowed(
        vault(),
        user(),
        "deposit",
        "0x5555555555555555555555555555555555555555" as Address,
      ),
    ).toThrow(/connected smart wallet/i);
  });

  it("uses only snapshot values for user balance and vault total", () => {
    const base = VAULTS[0];
    const zeroSnapshot = vault({
      summary: { ...vault().summary, totalManagedAssets: "0" },
      currentCycle: { ...vault().currentCycle, premiumEarned: "99000000" },
    });
    const mapped = mergeCspVaultConfig(base, zeroSnapshot, user({
      position: {
        ...user().position,
        activeAssets: "12000000",
        pendingDepositAssets: "3000000",
      },
    }), 8);

    expect(mapped.balance).toBe(15);
    expect(mapped.totalManagedUsd).toBe(0);
    expect(mapped).not.toHaveProperty("apy");
    expect(mapped).not.toHaveProperty("earningsUsd");
    expect(mergeCspVaultConfig(base, null, null, 8).totalManagedUsd).toBeNull();
  });

  it("accepts only a full EVM transaction hash", () => {
    const hash = `0x${"a".repeat(64)}`;
    expect(transactionHashFromResult(hash)).toBe(hash);
    expect(() => transactionHashFromResult({ hash })).toThrow(/valid transaction hash/i);
    expect(() => transactionHashFromResult("0x1234")).toThrow(/valid transaction hash/i);
  });

  it("encodes deposit(amount, minSharesOut) and approval to the vault", () => {
    const calls = buildCspDepositCalls({
      vault: vault(),
      rawAssets: BigInt(1_000_000),
      currentAllowance: BigInt(0),
    });

    expect(calls).toHaveLength(2);
    expect(calls[0].to).toBe(USDC);
    expect(
      decodeFunctionData({ abi: ERC20_ABI, data: calls[0].data }).functionName,
    ).toBe("approve");

    const decoded = decodeFunctionData({
      abi: ETH_CSP_VAULT_ABI,
      data: calls[1].data,
    });
    expect(decoded.functionName).toBe("deposit");
    expect(decoded.args?.[0]).toBe(BigInt(1_000_000));
    expect(decoded.args?.[1]).toBe(minSharesOutForDeposit(BigInt(1_000_000), vault()));
    expect(decoded.args?.[1]).toBeGreaterThan(BigInt(0));
  });

  it("encodes cancelPendingDeposit to the smart wallet receiver", () => {
    const call = buildCspActionCall({
      vault: vault(),
      user: user(),
      actionKey: "cancelPendingDeposit",
      receiver: USER,
    });
    const decoded = decodeFunctionData({ abi: ETH_CSP_VAULT_ABI, data: call.data });

    expect(call.to).toBe(VAULT);
    expect(decoded.functionName).toBe("cancelPendingDeposit");
    expect(decoded.args?.[0]).toBe(USER);
  });

  it("maps pending, exiting, claimable USDC, and assigned WETH states", () => {
    expect(
      deriveCspPositionState(user({
        position: { ...user().position, pendingDepositAssets: "1" },
      })),
    ).toBe("pending");
    expect(
      deriveCspPositionState(user({
        position: {
          ...user().position,
          withdrawal: { ...user().position.withdrawal, shares: "1" },
        },
      })),
    ).toBe("exiting");
    expect(
      deriveCspPositionState(user({
        actions: { ...user().actions, claimWithdraw: action(true) },
      })),
    ).toBe("claimable-usdc");
    expect(
      deriveCspPositionState(user({
        position: { ...user().position, claimableAssignedWeth: "1" },
      })),
    ).toBe("claimable-weth");
    expect(
      deriveCspPositionState(user({
        position: {
          ...user().position,
          withdrawal: { ...user().position.withdrawal, wethAssets: "1" },
        },
      })),
    ).toBe("claimable-weth");
  });

  it("maps active and withdrawing shares as secondary six-decimal quantities", () => {
    const mapped = mapCspPosition(user({
      position: {
        ...user().position,
        activeShares: "123456789",
        activeAssets: "99000000",
        pendingDepositAssets: "2500000",
        withdrawal: {
          ...user().position.withdrawal,
          shares: "12500000",
          usdcAssets: "750000",
          wethAssets: "1500000000000000000",
        },
        claimableAssignedWeth: "250000000000000000",
      },
    }), 6, 18);

    expect(mapped.activeUsd).toBe(99);
    expect(mapped.activeShares).toBe(123.456789);
    expect(mapped.pendingUsd).toBe(2.5);
    expect(mapped.pendingWithdrawalShares).toBe(12.5);
    expect(mapped.claimableUsdc).toBe(0.75);
    expect(mapped.claimableWeth).toBe(1.75);
  });

  it("detects positions from every supported non-empty balance", () => {
    const empty = user({
      position: {
        activeShares: "0",
        activeAssets: "999999999",
        pendingDepositAssets: "0",
        withdrawal: {
          epochId: null,
          shares: "0",
          claimable: false,
          usdcAssets: "0",
          wethAssets: "0",
        },
        claimableAssignedWeth: "0",
      },
    });
    expect(hasCspPosition(empty)).toBe(false);

    const fields = [
      { activeShares: "1" },
      { pendingDepositAssets: "1" },
      { claimableAssignedWeth: "1" },
    ];
    for (const field of fields) {
      expect(hasCspPosition(user({ position: { ...empty.position, ...field } }))).toBe(true);
    }
    for (const field of ["shares", "usdcAssets", "wethAssets"] as const) {
      expect(hasCspPosition(user({
        position: {
          ...empty.position,
          withdrawal: { ...empty.position.withdrawal, [field]: "1" },
        },
      }))).toBe(true);
    }
  });

  it("selects the existing contextual withdraw flow from backend actions", () => {
    expect(getCspWithdrawPlan(user()).key).toBe("withdrawIdle");
    expect(getCspWithdrawPlan(user()).mode).toBe("withdraw");

    const pending = user({
      actions: {
        ...user().actions,
        withdrawIdle: action(false),
        cancelPendingDeposit: action(true),
      },
    });
    expect(getCspWithdrawPlan(pending).key).toBe("cancelPendingDeposit");

    const mixedClaim = user({
      position: {
        ...user().position,
        withdrawal: {
          ...user().position.withdrawal,
          usdcAssets: "1000000",
          wethAssets: "1000000000000000000",
        },
      },
      actions: { ...user().actions, claimWithdraw: action(true) },
    });
    expect(getCspWithdrawPlan(mixedClaim)).toMatchObject({
      key: "claimWithdraw",
      label: "Claim assets",
      requiresAmount: false,
    });
  });
});
