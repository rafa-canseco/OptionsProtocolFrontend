import { beforeEach, describe, expect, it, vi } from "vitest";
import { decodeFunctionData, type Address } from "viem";
import type {
  FundConfigResponse,
  FundPositionResponse,
  FundSummaryResponse,
} from "@/lib/api";
import { ERC20_ABI } from "@/lib/contracts";
import {
  FUND_VAULT_ABI,
  assertFundWriteAllowed,
  buildFundActionCall,
  buildFundDepositCalls,
  fundTrustError,
  minSharesOutForDeposit,
  sharesForDeposit,
  transactionHashFromResult,
} from "@/lib/fundVault";
import {
  BASE_SEPOLIA_COVERED_CALL_FUND,
  BASE_SEPOLIA_CSP_FUND,
} from "@/lib/fundDeployment";
import { fundValuation } from "@/lib/fundValuation";
import { deriveFundPositionState, fundStrategyState, mapFundPosition } from "@/lib/vaults";

vi.mock("@/lib/contracts", () => ({
  CHAIN: { id: 84532 },
  ADDRESSES: {
    usdc: "0xAB51a471493832C1D70cef8ff937A850cf37c860",
    weth: "0x8A6Aa2304797898d46eC1d342Fedc817D3a973B6",
  },
  ERC20_ABI: [
    {
      type: "function",
      name: "approve",
      inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
      outputs: [{ type: "bool" }],
      stateMutability: "nonpayable",
    },
  ],
}));

const FUND = "0x1000000000000000000000000000000000000001" as Address;
const SHARE = "0x2000000000000000000000000000000000000002" as Address;
const USDC = "0xAB51a471493832C1D70cef8ff937A850cf37c860" as Address;
const USER = "0x4000000000000000000000000000000000000004" as Address;
const IMPLEMENTATION = "0x5000000000000000000000000000000000000005" as Address;
const PROXY_ROLES = new Set([
  "fund_vault", "fund_share", "fund_accounting", "fund_flow_manager",
  "strategy_manager", "csp_adapter", "controller", "batch_settler",
]);
const ROLES = [
  ...PROXY_ROLES, "claim_escrow", "access_manager", "address_book", "csp_valuator",
  "margin_pool", "nav_verifier", "oracle", "otoken_factory", "swap_router", "whitelist",
];

function availability(available = true, reasonCode: string | null = null) {
  return { available, reasonCode };
}

function actions() {
  return {
    deposit: availability(),
    requestRedemption: availability(),
    cancelRedemption: availability(false, "NO_PENDING_REDEMPTION"),
    claimRedemption: availability(false, "NO_CLAIMABLE_REDEMPTION"),
  };
}

function summary(overrides: Partial<FundSummaryResponse> = {}): FundSummaryResponse {
  return {
    fund: {
      fundKey: "base-sepolia:csp",
      chainId: 84532,
      fundAddress: FUND,
      shareToken: { address: SHARE, symbol: "b1CSP", decimals: 18 },
      accountingAsset: { address: USDC, symbol: "USDC", decimals: 6 },
      deploymentStatus: "DEPLOYED",
    },
    netAssets: "100000000",
    shareSupply: "100000000000000000000",
    virtualShares: "1000000000000",
    sharePriceAssets: "1000000",
    composition: {
      idleAssets: "50000000",
      strategyAccountingAssets: "50000000",
      assignedWeth: "0",
      reservedClaimAssets: "0",
    },
    nav: { reportNonce: 2, validAfterBlock: 90, validUntilBlock: 110, stale: false },
    status: {
      reconciled: true,
      depositsPaused: false,
      redemptionsPaused: false,
      executionLocked: false,
      flowProcessing: false,
    },
    actions: actions(),
    asOfBlock: 100,
    asOfBlockHash: `0x${"1".repeat(64)}`,
    indexedAt: "2026-07-23T00:00:00Z",
    stale: false,
    ...overrides,
  };
}

function position(overrides: Partial<FundPositionResponse> = {}): FundPositionResponse {
  return {
    fundKey: "base-sepolia:csp",
    address: USER,
    shares: "10000000000000000000",
    accountingValue: "10000000",
    redemption: {
      pendingShares: "0",
      claimableShares: "0",
      claimableAssets: "0",
      status: "none",
      nextAction: "none",
      latestBatchId: 0,
      latestBatchProcessing: false,
      latestBatchUnwindCommitted: false,
    },
    actions: actions(),
    asOfBlock: 100,
    indexedAt: "2026-07-23T00:00:00Z",
    stale: false,
    ...overrides,
  };
}

function config(overrides: Partial<FundConfigResponse> = {}): FundConfigResponse {
  return {
    fundKey: "base-sepolia:csp",
    deploymentStatus: "DEPLOYED",
    contracts: ROLES.map((role) => ({
      role,
      address: role === "fund_share" ? SHARE : FUND,
      implementationAddress: PROXY_ROLES.has(role) ? IMPLEMENTATION : null,
      interfaceVersion: 1,
    })),
    capabilities: actions(),
    writesEnabled: true,
    blockedReasonCode: null,
    ...overrides,
  };
}

describe("tokenized CSP fund", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("NEXT_PUBLIC_CSP_FUND_KEY", "base-sepolia:csp");
    vi.stubEnv("NEXT_PUBLIC_CSP_FUND_ADDRESS", FUND);
    vi.stubEnv("NEXT_PUBLIC_CSP_FUND_SHARE_ADDRESS", SHARE);
    vi.stubEnv("NEXT_PUBLIC_CSP_FUND_ASSET_ADDRESS", USDC);
    vi.stubEnv("NEXT_PUBLIC_CSP_FUND_CONTRACT_ALLOWLIST", ROLES.map((role) => {
      const address = role === "fund_share" ? SHARE : FUND;
      return `${role}=${address}${PROXY_ROLES.has(role) ? `@${IMPLEMENTATION}` : ""}`;
    }).join(","));
  });

  it("pins the final B1N-352 v2 Base Sepolia trust anchor", () => {
    expect(BASE_SEPOLIA_CSP_FUND.chainId).toBe(84532);
    expect(BASE_SEPOLIA_CSP_FUND.fundAddress).toBe(
      "0x53e38Baf2fC55259729085b7542BFF066F6a509e",
    );
    expect(BASE_SEPOLIA_CSP_FUND.shareAddress).toBe(
      "0x07Db1F574ecCFD15c4A8bd4582e5d25baA84De7d",
    );
    expect(BASE_SEPOLIA_CSP_FUND.contracts.csp_adapter.implementation).toBe(
      "0x0d8AcE03650C5212658d544A4aDe7987f7F3d475",
    );
    expect(BASE_SEPOLIA_CSP_FUND.contracts.csp_valuator.address).toBe(
      "0x63aB18b546d2b7a6e9e68eF7C784Ecfa41B76798",
    );
    expect(Object.keys(BASE_SEPOLIA_CSP_FUND.contracts)).toHaveLength(18);
  });

  it("accepts the current backend contract bindings without a trust mismatch", () => {
    vi.stubEnv("NEXT_PUBLIC_CSP_FUND_ADDRESS", BASE_SEPOLIA_CSP_FUND.fundAddress);
    vi.stubEnv("NEXT_PUBLIC_CSP_FUND_SHARE_ADDRESS", BASE_SEPOLIA_CSP_FUND.shareAddress);
    vi.stubEnv(
      "NEXT_PUBLIC_CSP_FUND_ASSET_ADDRESS",
      BASE_SEPOLIA_CSP_FUND.accountingAssetAddress,
    );
    vi.stubEnv("NEXT_PUBLIC_CSP_FUND_CONTRACT_ALLOWLIST", "");

    const trustedSummary = summary({
      fund: {
        ...summary().fund,
        strategyKind: "csp",
        fundAddress: BASE_SEPOLIA_CSP_FUND.fundAddress,
        shareToken: {
          ...summary().fund.shareToken,
          address: BASE_SEPOLIA_CSP_FUND.shareAddress,
        },
        accountingAsset: {
          ...summary().fund.accountingAsset,
          address: BASE_SEPOLIA_CSP_FUND.accountingAssetAddress,
        },
      },
      strategy: {
        strategyKind: "csp",
        latestPosition: null,
        totalPremiumCollectedAssets: "0",
        nextOpenAfter: null,
        nextOpenCondition: "when_funded_and_pricing_is_ready",
      },
    });
    const trustedConfig = config({
      contracts: Object.entries(BASE_SEPOLIA_CSP_FUND.contracts).map(
        ([role, binding]) => ({
          role,
          address: binding.address,
          implementationAddress: binding.implementation,
          interfaceVersion: 1,
        }),
      ),
    });

    expect(fundTrustError(trustedSummary, trustedConfig)).toBeNull();
  });

  it("pins and accepts the deployed B1N-360 covered-call trust anchor", () => {
    expect(BASE_SEPOLIA_COVERED_CALL_FUND.fundAddress).toBe(
      "0x9060946E6ACC4E430A823E90120743c7305EE2CA",
    );
    expect(BASE_SEPOLIA_COVERED_CALL_FUND.shareAddress).toBe(
      "0xaA1070adb74C5455320285618BF1ED804d3745C3",
    );
    expect(
      BASE_SEPOLIA_COVERED_CALL_FUND.contracts.fund_vault.implementation,
    ).toBe("0xCae10a81aE1aA0183A4b4283A3ACbE9A2642613A");
    expect(
      BASE_SEPOLIA_COVERED_CALL_FUND.contracts.covered_call_adapter
        .implementation,
    ).toBe("0x42e603131671Aba8C9e2b0B21b0f7B376C9151Be");
    expect(
      BASE_SEPOLIA_COVERED_CALL_FUND.contracts.covered_call_valuator.address,
    ).toBe("0xA1BFC1bE3C7fCA77CA0b32d25de1Ce58A50333A0");
    expect(Object.keys(BASE_SEPOLIA_COVERED_CALL_FUND.contracts)).toHaveLength(
      18,
    );

    vi.stubEnv("NEXT_PUBLIC_COVERED_CALL_FUND_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_COVERED_CALL_FUND_ADDRESS", "");
    vi.stubEnv("NEXT_PUBLIC_COVERED_CALL_FUND_SHARE_ADDRESS", "");
    vi.stubEnv("NEXT_PUBLIC_COVERED_CALL_FUND_ASSET_ADDRESS", "");
    vi.stubEnv("NEXT_PUBLIC_COVERED_CALL_FUND_CONTRACT_ALLOWLIST", "");

    const coveredCallSummary = summary({
      fund: {
        ...summary().fund,
        fundKey: BASE_SEPOLIA_COVERED_CALL_FUND.fundKey,
        fundAddress: BASE_SEPOLIA_COVERED_CALL_FUND.fundAddress,
        shareToken: {
          address: BASE_SEPOLIA_COVERED_CALL_FUND.shareAddress,
          symbol: "b1CALL",
          decimals: 18,
        },
        accountingAsset: {
          address: BASE_SEPOLIA_COVERED_CALL_FUND.accountingAssetAddress,
          symbol: "WETH",
          decimals: 18,
        },
        strategyKind: "covered_call",
        quoteAsset: {
          address: USDC,
          symbol: "USDC",
          decimals: 6,
        },
      },
      strategy: {
        strategyKind: "covered_call",
        latestPosition: null,
        totalPremiumCollectedAssets: "0",
        nextOpenAfter: null,
        nextOpenCondition: "when_funded_and_pricing_is_ready",
      },
    });
    const coveredCallConfig = config({
      fundKey: BASE_SEPOLIA_COVERED_CALL_FUND.fundKey,
      contracts: Object.entries(
        BASE_SEPOLIA_COVERED_CALL_FUND.contracts,
      ).map(([role, binding]) => ({
        role,
        address: binding.address,
        implementationAddress: binding.implementation,
        interfaceVersion: 1,
      })),
    });

    expect(
      fundTrustError(
        coveredCallSummary,
        coveredCallConfig,
        null,
        undefined,
        BASE_SEPOLIA_COVERED_CALL_FUND,
      ),
    ).toBeNull();

    const previousImplementationConfig = {
      ...coveredCallConfig,
      contracts: coveredCallConfig.contracts.map((contract) =>
        contract.role === "fund_vault"
          ? {
              ...contract,
              implementationAddress:
                "0xAf51984EcC261a4B3052eA90c9a85768F81DE764",
            }
          : contract,
      ),
    };
    expect(
      fundTrustError(
        coveredCallSummary,
        previousImplementationConfig,
        null,
        undefined,
        BASE_SEPOLIA_COVERED_CALL_FUND,
      ),
    ).toBe("Trusted fund_vault implementation mismatch.");
  });

  it("uses the deployed FundVault entry, request, cancel, claim, and operator ABI", () => {
    const functions = new Set(
      FUND_VAULT_ABI.filter((item) => item.type === "function").map((item) => item.name),
    );
    expect(functions).toEqual(
      new Set([
        "depositWithMinShares",
        "requestRedeem",
        "requestRedeemWithMinAssets",
        "cancelRedeemRequest",
        "redeem",
        "withdraw",
        "setOperator",
      ]),
    );
  });

  it("fails closed on stale data, backend write gates, and config mismatch", () => {
    expect(() => assertFundWriteAllowed(summary({ stale: true }), config(), position(), "deposit", USER)).toThrow(/stale/i);
    expect(() => assertFundWriteAllowed(summary(), config({ writesEnabled: false, blockedReasonCode: "NAV_NOT_ACTIVE" }), position(), "deposit", USER)).toThrow(/NAV_NOT_ACTIVE/);
    expect(fundTrustError(summary(), config(), position({ address: FUND }), USER)).toMatch(/smart wallet/i);
    vi.stubEnv("NEXT_PUBLIC_CSP_FUND_CONTRACT_ALLOWLIST", "invalid");
    expect(fundTrustError(summary(), config(), position(), USER)).toMatch(/allowlist is missing/i);
  });

  it("fails closed when strategy metadata does not match the trusted fund", () => {
    const mismatched = summary({
      strategy: {
        strategyKind: "covered_call",
        latestPosition: null,
        totalPremiumCollectedAssets: "0",
        nextOpenAfter: null,
        nextOpenCondition: "when_funded_and_pricing_is_ready",
      },
    });
    expect(fundTrustError(mismatched, config())).toMatch(/strategy kind/i);
  });

  it("encodes approval and depositWithMinShares for the smart-wallet receiver", () => {
    const rawAssets = BigInt(1_000_000);
    const calls = buildFundDepositCalls({
      summary: summary(), receiver: USER, rawAssets, currentAllowance: BigInt(0),
    });
    expect(calls).toHaveLength(2);
    expect(decodeFunctionData({ abi: ERC20_ABI, data: calls[0].data }).functionName).toBe("approve");
    const decoded = decodeFunctionData({ abi: FUND_VAULT_ABI, data: calls[1].data });
    expect(decoded.functionName).toBe("depositWithMinShares");
    expect(decoded.args).toEqual([rawAssets, USER, minSharesOutForDeposit(rawAssets, summary())]);
    expect(decoded.args?.[2]).toBeGreaterThan(BigInt(0));
  });

  it("keeps locked collateral in gross assets and quotes deposits from fair NAV, never stress", () => {
    const fairSummary = summary({
      netAssets: "970000000",
      shareSupply: "1000000000000000000000",
      virtualShares: "0",
      sharePriceAssets: "970000",
      marketPriceAssets: "975000",
      stressPriceAssets: "200000",
      composition: {
        idleAssets: "200000000",
        strategyAccountingAssets: "800000000",
        assignedWeth: "0",
        reservedClaimAssets: "0",
        grossAssets: "1000000000",
        lockedCollateralAssets: "800000000",
        fairOptionLiabilityAssets: "30000000",
        assignedWethValueAssets: "0",
        settlementCostAssets: "0",
      },
      nav: {
        ...summary().nav,
        methodology: "European put fair value",
        modelVersion: 1,
        sourceQuality: "quorum",
        stress: {
          netAssets: "200000000",
          sharePriceAssets: "200000",
          liabilities: "800000000",
          methodology: "max-payout stress",
        },
      },
    });
    const valuation = fundValuation(fairSummary);
    expect(valuation.grossAssets).toBe("1000000000");
    expect(valuation.lockedCollateralAssets).toBe("800000000");
    expect(valuation.fairOptionLiabilityAssets).toBe("30000000");
    expect(valuation.navPriceAssets).toBe("970000");
    expect(valuation.stressPriceAssets).toBe("200000");
    expect(valuation.modelVersion).toBe("1");

    const deposit = BigInt(200_000000);
    const fairQuote = sharesForDeposit(deposit, fairSummary);
    const withoutStress = sharesForDeposit(deposit, {
      ...fairSummary,
      stressPriceAssets: null,
      nav: { ...fairSummary.nav, stress: null },
    });
    expect(fairQuote).toBe(withoutStress);
    expect(Number(fairQuote) / 1e18).toBeCloseTo(206.185567, 6);
    expect(Number(fairSummary.sharePriceAssets) / 1e6).toBe(0.97);
    expect(Number(fairSummary.sharePriceAssets) / 1e6).not.toBe(0.2);
  });

  it("encodes request, full pending cancellation, and claim", () => {
    const pending = position({
      redemption: { ...position().redemption, pendingShares: "300", claimableShares: "200" },
    });
    const request = buildFundActionCall({ summary: summary(), position: pending, actionKey: "requestRedemption", controller: USER, shares: BigInt(100) });
    const cancel = buildFundActionCall({ summary: summary(), position: pending, actionKey: "cancelRedemption", controller: USER });
    const claim = buildFundActionCall({ summary: summary(), position: pending, actionKey: "claimRedemption", controller: USER });
    expect(decodeFunctionData({ abi: FUND_VAULT_ABI, data: request.data })).toMatchObject({ functionName: "requestRedeem", args: [BigInt(100), USER, USER] });
    expect(decodeFunctionData({ abi: FUND_VAULT_ABI, data: cancel.data })).toMatchObject({ functionName: "cancelRedeemRequest", args: [USER, BigInt(300)] });
    expect(decodeFunctionData({ abi: FUND_VAULT_ABI, data: claim.data })).toMatchObject({ functionName: "redeem", args: [BigInt(200), USER, USER] });
  });

  it("maps empty, invested, pending, partial, and claimable positions", () => {
    expect(deriveFundPositionState(position({ shares: "0" }))).toBe("empty");
    expect(deriveFundPositionState(position())).toBe("invested");
    const pending = {
      ...position().redemption,
      pendingShares: "1000000000000000000",
    };
    expect(deriveFundPositionState(position({ redemption: pending }))).toBe("pending");
    expect(deriveFundPositionState(position({ redemption: { ...pending, claimableAssets: "10" } }))).toBe("partial");
    expect(deriveFundPositionState(position({ redemption: { ...position().redemption, claimableAssets: "10" } }))).toBe("claimable");
    expect(mapFundPosition(position({ redemption: pending }), summary()).pendingValue).toBeGreaterThan(0);
  });

  it("shows CSP and assigned-inventory fund states without a user WETH claim", () => {
    expect(fundStrategyState(summary())).toBe("CSP active");
    const assigned = summary({ composition: { ...summary().composition, assignedWeth: "1000000000000000000" } });
    expect(fundStrategyState(assigned)).toBe("Assigned inventory");
    expect(JSON.stringify(position()).toLowerCase()).not.toContain("weth");
  });

  it("accepts only complete EVM transaction hashes", () => {
    const hash = `0x${"a".repeat(64)}`;
    expect(transactionHashFromResult(hash)).toBe(hash);
    expect(() => transactionHashFromResult({ hash })).toThrow(/valid transaction hash/i);
  });
});
