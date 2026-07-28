import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { VaultsPage } from "@/components/vaults/VaultsPage";
import { VaultDialog } from "@/components/vaults/VaultDialog";
import { VaultCard } from "@/components/vaults/VaultCard";
import type {
  FundPositionResponse,
  FundSummaryResponse,
} from "@/lib/api";
import {
  COVERED_CALL_VAULT_CARD,
  EMPTY_VAULT_POSITION,
  VAULT_STATE_COPY,
} from "@/lib/vaults";

vi.mock("@/components/ConnectButton", () => ({
  ConnectButton: () => <button type="button">Connect</button>,
}));

vi.mock("@/lib/contracts", () => ({
  CHAIN: { id: 84532 },
  ERC20_ABI: [],
  publicClient: { readContract: vi.fn(), waitForTransactionReceipt: vi.fn() },
}));

vi.mock("@/hooks/useWallet", () => ({
  useWallet: () => ({
    address: "0x4000000000000000000000000000000000000004",
    sendBatchTx: vi.fn(),
  }),
}));

vi.mock("@/hooks/useBalances", () => ({
  useBalances: () => ({
    usd: 125,
    usdRaw: BigInt(125_000000),
    eth: 0.01234,
    weth: 0.75,
    wethRaw: BigInt(750_000_000_000_000_000),
    loading: false,
  }),
}));

vi.mock("@/hooks/useFundVault", () => ({
  useFundVault: () => ({
    summary: null,
    position: null,
    config: null,
    loading: false,
    error: null,
    trustError: null,
    refetch: vi.fn(),
  }),
}));

describe("VaultsPage", () => {
  it("renders a minimal vault-first catalog and preserves manual trading", () => {
    render(<VaultsPage />);
    expect(
      screen.getByRole("heading", { name: "ETH Cash-Secured Put" }),
    ).toBeInTheDocument();
    const coveredCallCard = screen
      .getByRole("heading", { name: "ETH Covered Call" })
      .closest("article");
    expect(coveredCallCard).not.toBeNull();
    expect(screen.getAllByText("NAV price")).toHaveLength(2);
    expect(screen.getByText("ETH puts")).toBeInTheDocument();
    expect(within(coveredCallCard!).getByText("ETH Covered Call")).toBeInTheDocument();
    expect(within(coveredCallCard!).queryByText("WETH vault")).not.toBeInTheDocument();
    expect(within(coveredCallCard!).getByText("ETH calls")).toBeInTheDocument();
    expect(within(coveredCallCard!).getByText("No position")).toBeInTheDocument();
    expect(
      within(coveredCallCard!).getByRole("button", { name: "Deposit WETH" }),
    ).toBeEnabled();
    expect(
      within(coveredCallCard!).getByText(
        "Earn income on ETH you already own.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Earn income while waiting to buy ETH at a lower price.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/apy/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/earnings/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Refresh fund data" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Fund snapshot is stale/i)).not.toBeInTheDocument();
    expect(screen.queryByText("How this vault works")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /manual trading/i })).toHaveAttribute("href", "/earn/eth");
    expect(screen.getByRole("link", { name: "My Vaults" })).toHaveAttribute("href", "/vaults/my");
    expect(screen.getByRole("button", { name: "Smart wallet balances" })).toHaveTextContent("125.00 USDC");
  });

  it("switches the catalog to another Base asset without inventing live funds", async () => {
    const user = userEvent.setup();
    render(<VaultsPage />);

    await user.click(
      screen.getByRole("button", {
        name: "Select vault asset. Current asset ETH",
      }),
    );
    expect(
      screen.queryByRole("button", { name: "Select SOL" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Select TSLAx" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Select cbBTC" }));

    const cspCard = screen
      .getByRole("heading", { name: "cbBTC Cash-Secured Put" })
      .closest("article");
    const coveredCallCard = screen
      .getByRole("heading", { name: "cbBTC Covered Call" })
      .closest("article");
    expect(cspCard).not.toBeNull();
    expect(coveredCallCard).not.toBeNull();
    expect(within(cspCard!).getByText(
      "Earn income while waiting to buy cbBTC at a lower price.",
    )).toBeInTheDocument();
    expect(within(coveredCallCard!).getByText(
      "Earn income on cbBTC you already own.",
    )).toBeInTheDocument();
    expect(within(cspCard!).getByText("cbBTC puts")).toBeInTheDocument();
    expect(within(cspCard!).getByText("cbBTC Cash-Secured Put")).toBeInTheDocument();
    expect(within(coveredCallCard!).getByText("cbBTC calls")).toBeInTheDocument();
    expect(within(coveredCallCard!).getByText("cbBTC Covered Call")).toBeInTheDocument();
    expect(
      within(cspCard!).getByRole("button", { name: "Coming soon" }),
    ).toBeDisabled();
    expect(
      within(coveredCallCard!).getByRole("button", { name: "Coming soon" }),
    ).toBeDisabled();
    expect(screen.getByRole("link", { name: /manual trading/i })).toHaveAttribute(
      "href",
      "/earn/btc",
    );
  });

  it("does not invent a covered-call position in My Vaults", () => {
    render(<VaultsPage view="my" />);

    expect(
      screen.getByRole("heading", { name: "ETH Cash-Secured Put" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("ETH Covered Call"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /select vault asset/i }),
    ).not.toBeInTheDocument();
  });

  it("shows the vault wallet USDC and gas balances from the configured Base contracts", async () => {
    const user = userEvent.setup();
    render(<VaultsPage />);
    await user.click(screen.getByRole("button", { name: "Smart wallet balances" }));
    expect(screen.getByText("Vault wallet")).toBeInTheDocument();
    expect(screen.getByText("0x4000…0004")).toBeInTheDocument();
    expect(screen.getByText("ETH gas")).toBeInTheDocument();
    expect(screen.getByText("0.01234")).toBeInTheDocument();
    expect(screen.getByText("WETH")).toBeInTheDocument();
    expect(screen.getByText("0.75")).toBeInTheDocument();
    expect(screen.getAllByText("Fund shares")).toHaveLength(2);
    expect(screen.getByText("b1CSP-V2")).toBeInTheDocument();
    expect(screen.getByText("b1CALL-V2")).toBeInTheDocument();
    expect(screen.getByText("≈ 0.00 USDC")).toBeInTheDocument();
    expect(screen.getByText("≈ 0.00 WETH")).toBeInTheDocument();
  });

  it("opens accounting-asset entry and exit controls", async () => {
    const user = userEvent.setup();
    render(<VaultsPage />);
    await user.click(screen.getByRole("button", { name: "Deposit USDC" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    const strategyDetails = screen.getByText("How this vault works").closest("details");
    expect(strategyDetails).not.toHaveAttribute("open");
    await user.click(screen.getByText("How this vault works"));
    expect(strategyDetails).toHaveAttribute("open");
    expect(screen.getByText("≈15% below spot")).toBeInTheDocument();
    expect(screen.getByText("≈48 hours")).toBeInTheDocument();
    expect(screen.getByText("Up to 80%")).toBeInTheDocument();
    expect(screen.getByText("One at a time")).toBeInTheDocument();
    expect(
      screen.getByText(/Assignment alone does not stop the loop/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/no eligible quote is available/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Deposit" })).toHaveAttribute("aria-selected", "true");
    await user.click(screen.getByRole("tab", { name: "Exit" }));
    expect(screen.getByRole("button", { name: "Request redemption" })).toBeDisabled();
  });

  it("opens the live covered-call WETH flow and policy", async () => {
    const user = userEvent.setup();
    render(<VaultsPage />);

    await user.click(screen.getByRole("button", { name: "Deposit WETH" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "WETH amount" })).toBeInTheDocument();
    await user.click(screen.getByText("How this vault works"));
    expect(screen.getByText("Far above spot · Δ 0.05 ±0.015")).toBeInTheDocument();
    expect(screen.getByText("Up to 80%")).toBeInTheDocument();
    expect(
      screen.getByText(/keeps opening calls while enough WETH/i),
    ).toBeInTheDocument();
  });

  it("defines one action for each supported position state", () => {
    expect(Object.keys(VAULT_STATE_COPY)).toEqual([
      "empty", "invested", "pending", "partial", "claimable",
    ]);
    expect(VAULT_STATE_COPY.partial.action).toBe("Claim available USDC");
    expect(VAULT_STATE_COPY.claimable.action).toBe("Claim USDC");
  });

  it("keeps the fair NAV breakdown useful and moves explanations into tooltips", async () => {
    const user = userEvent.setup();
    render(
      <VaultDialog
        summary={fairSummary()}
        position={emptyPosition()}
        config={null}
        loadError={null}
        smartUsdcRaw={BigInt(500_000000)}
        onRefetch={vi.fn()}
        open
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Gross assets")).toBeInTheDocument();
    expect(screen.getByText("$1,000.00")).toBeInTheDocument();
    expect(screen.getByText("Locked collateral")).toBeInTheDocument();
    expect(screen.getByText("$800.00")).toBeInTheDocument();
    expect(screen.getByText("Fair put liability")).toBeInTheDocument();
    expect(screen.getByText("−$30.00")).toBeInTheDocument();
    expect(screen.getByText("Price current")).toBeInTheDocument();
    expect(screen.queryByText("Assigned WETH")).not.toBeInTheDocument();
    expect(screen.queryByText("Settlement costs")).not.toBeInTheDocument();
    expect(screen.queryByText("Stress")).not.toBeInTheDocument();
    expect(screen.queryByText(/European put fair value/)).not.toBeInTheDocument();
    expect(screen.queryByText(/csp-fair-v1/)).not.toBeInTheDocument();
    expect(screen.queryByText(/quorum/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Report 3/)).not.toBeInTheDocument();
    expect(screen.queryByText(/block 110/)).not.toBeInTheDocument();
    expect(screen.getByText("Current CSP cycle")).toBeInTheDocument();
    expect(screen.getByText("$1,625 put")).toBeInTheDocument();
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(screen.getByText(/0.49230769 ETH/)).toHaveTextContent(
      "$800.00 secured",
    );
    expect(screen.getByText("Total premium")).toBeInTheDocument();
    expect(screen.getByText("0.000061 USDC")).toBeInTheDocument();
    expect(screen.getByText("Next position")).toBeInTheDocument();
    expect(screen.getByText(/After Jul 29.*settlement/)).toBeInTheDocument();

    await user.hover(
      screen.getByRole("button", { name: "Info: Locked collateral" }),
    );
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "It still belongs to the fund and is not a loss.",
    );

    await user.type(screen.getByRole("textbox", { name: "USDC amount" }), "200");
    const preview = screen.getByLabelText("Deposit share preview");
    expect(preview).toHaveTextContent("206.185");
    expect(preview).toHaveTextContent("current NAV price of $0.97");
    expect(preview).not.toHaveTextContent("$0.20");
    expect(preview).not.toHaveTextContent(/stress/i);
  });

  it("uses plain language while a NAV price is updating", () => {
    const summary = fairSummary();
    summary.stale = true;
    summary.nav.stale = true;
    summary.actions.deposit = {
      available: false,
      reasonCode: "NAV_NOT_ACTIVE",
    };

    render(
      <VaultDialog
        summary={summary}
        position={emptyPosition()}
        config={null}
        loadError={null}
        smartUsdcRaw={BigInt(500_000000)}
        onRefetch={vi.fn()}
        open
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Price updating")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Price is updating. Deposits and exits will reopen automatically.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/nav not active/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Deposit USDC" })).toBeDisabled();
  });

  it("labels a stale catalog price without exposing internal availability copy", () => {
    const summary = fairSummary();
    summary.stale = true;
    summary.nav.stale = true;
    summary.actions.deposit = {
      available: false,
      reasonCode: "NAV_NOT_ACTIVE",
    };

    render(
      <VaultCard
        summary={summary}
        position={EMPTY_VAULT_POSITION}
        onOpen={vi.fn()}
      />,
    );

    expect(screen.getByText("Price updating")).toBeInTheDocument();
    expect(screen.queryByText("Entry unavailable")).not.toBeInTheDocument();
    expect(screen.queryByText(/nav not active/i)).not.toBeInTheDocument();
  });

  it("shows tiny non-zero liabilities without rendering negative zero", () => {
    const summary = fairSummary();
    summary.composition.fairOptionLiabilityAssets = "1";

    render(
      <VaultDialog
        summary={summary}
        position={emptyPosition()}
        config={null}
        loadError={null}
        smartUsdcRaw={BigInt(500_000000)}
        onRefetch={vi.fn()}
        open
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByText("−<$0.01")).toBeInTheDocument();
    expect(screen.queryByText("−$0.00")).not.toBeInTheDocument();
  });

  it("keeps assigned inventory visible while lifecycle costs stay inside NAV", () => {
    const summary = fairSummary();
    summary.composition.assignedWeth = "1000000000000000000";
    summary.composition.assignedWethValueAssets = "1900000000";
    summary.composition.settlementCostAssets = "250000";

    render(
      <VaultDialog
        summary={summary}
        position={emptyPosition()}
        config={null}
        loadError={null}
        smartUsdcRaw={BigInt(500_000000)}
        onRefetch={vi.fn()}
        open
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Assigned WETH")).toBeInTheDocument();
    expect(screen.getByText("1 WETH")).toBeInTheDocument();
    expect(screen.getByText("$1,900.00")).toBeInTheDocument();
    expect(screen.queryByText("Settlement costs")).not.toBeInTheDocument();
    expect(screen.queryByText("$0.25")).not.toBeInTheDocument();
  });

  it("renders the live covered-call lifecycle in WETH without treating it as dollars", async () => {
    const user = userEvent.setup();
    render(
      <VaultDialog
        vault={COVERED_CALL_VAULT_CARD}
        summary={coveredCallSummary()}
        position={emptyPosition({
          fundKey: "base-sepolia:covered-call",
          accountingValue: "0",
        })}
        config={null}
        loadError={null}
        smartAssetRaw={BigInt("750000000000000000")}
        onRefetch={vi.fn()}
        open
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByText("ETH CALL · WETH")).toBeInTheDocument();
    expect(screen.getByText("Fair call liability")).toBeInTheDocument();
    expect(screen.getByText("Premium awaiting conversion")).toBeInTheDocument();
    expect(screen.getAllByText("5 USDC")).toHaveLength(2);
    expect(screen.getByText("0.0025 WETH")).toBeInTheDocument();
    expect(screen.getByText("≈ 0.0025 WETH in NAV")).toBeInTheDocument();
    expect(screen.getByText("After USDC returns to WETH")).toBeInTheDocument();
    expect(screen.queryByText("Settlement costs")).not.toBeInTheDocument();
    expect(screen.queryByText("Normalization costs")).not.toBeInTheDocument();
    expect(screen.queryByText("Option lifecycle costs")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Deposit WETH" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "WETH amount" })).toBeInTheDocument();

    await user.hover(
      screen.getByRole("button", { name: "Info: Idle WETH" }),
    );
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "secure up to 80% of the available WETH",
    );
    expect(
      screen.getByRole("button", {
        name: "Info: Premium awaiting conversion",
      }),
    ).toBeInTheDocument();

    await user.click(screen.getByText("How this vault works"));
    expect(screen.getByText("Far above spot · Δ 0.05 ±0.015")).toBeInTheDocument();
    expect(screen.getByText("Up to 80%")).toBeInTheDocument();
    expect(
      screen.getByText(/keeps opening calls while enough WETH/i),
    ).toBeInTheDocument();
    expect(screen.queryByText("$0.01")).not.toBeInTheDocument();
  });

  it("shows premium and next-open readiness before the first covered call", () => {
    const summary = coveredCallSummary();
    summary.strategy!.latestPosition = null;
    summary.strategy!.totalPremiumCollectedAssets = "0";
    summary.strategy!.nextOpenAfter = null;
    summary.strategy!.nextOpenCondition = "when_funded_and_pricing_is_ready";

    render(
      <VaultDialog
        vault={COVERED_CALL_VAULT_CARD}
        summary={summary}
        position={emptyPosition({
          fundKey: "base-sepolia:covered-call",
          accountingValue: "0",
        })}
        config={null}
        loadError={null}
        smartAssetRaw={BigInt("750000000000000000")}
        onRefetch={vi.fn()}
        open
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByText("No call opened yet")).toBeInTheDocument();
    expect(screen.getByText("Waiting")).toBeInTheDocument();
    expect(screen.getByText("0 USDC")).toBeInTheDocument();
    expect(screen.getByText("When WETH and pricing are ready")).toBeInTheDocument();
  });
});

function fairSummary(): FundSummaryResponse {
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
        address: "0xAB51a471493832C1D70cef8ff937A850cf37c860",
        symbol: "USDC",
        decimals: 6,
      },
      deploymentStatus: "DEPLOYED",
    },
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
      reportNonce: 3,
      validAfterBlock: 100,
      validUntilBlock: 120,
      stale: false,
      methodology: "European put fair value",
      modelVersion: "csp-fair-v1",
      observedAt: "2026-07-26T15:00:00Z",
      sourceQuality: "quorum",
      stress: {
        netAssets: "200000000",
        sharePriceAssets: "200000",
        liabilities: "800000000",
        methodology: "max-payout stress",
      },
    },
    strategy: {
      latestPosition: {
        positionId: 2,
        lifecycle: "open",
        strikePriceUsd8: "162500000000",
        expiryTimestamp: 1785312000,
        optionAmount8: "49230769",
        collateralAssets: "800000000",
        premiumEarnedAssets: "2",
      },
      totalPremiumCollectedAssets: "61",
      nextOpenAfter: 1785312000,
      nextOpenCondition: "after_current_settlement",
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
      cancelRedemption: {
        available: false,
        reasonCode: "NO_PENDING_REDEMPTION",
      },
      claimRedemption: {
        available: false,
        reasonCode: "NO_CLAIMABLE_REDEMPTION",
      },
    },
    asOfBlock: 110,
    asOfBlockHash: `0x${"1".repeat(64)}`,
    indexedAt: "2026-07-26T15:00:00Z",
    stale: false,
  };
}

function coveredCallSummary(): FundSummaryResponse {
  return {
    ...fairSummary(),
    fund: {
      ...fairSummary().fund,
      fundKey: "base-sepolia:covered-call",
      shareToken: {
        ...fairSummary().fund.shareToken,
        symbol: "b1CC",
      },
      accountingAsset: {
        address: "0x8A6Aa2304797898d46eC1d342Fedc817D3a973B6",
        symbol: "WETH",
        decimals: 18,
      },
      strategyKind: "covered_call",
      quoteAsset: {
        address: "0xAB51a471493832C1D70cef8ff937A850cf37c860",
        symbol: "USDC",
        decimals: 6,
      },
    },
    netAssets: "8500000000000000",
    sharePriceAssets: "1000000000000000",
    composition: {
      idleAssets: "6500000000000000",
      strategyAccountingAssets: "2500000000000000",
      assignedWeth: "0",
      reservedClaimAssets: "0",
      grossAssets: "9000000000000000",
      lockedCollateralAssets: "2500000000000000",
      fairOptionLiabilityAssets: "250000000000000",
      transientUsdc: "5000000",
      transientUsdcValueAssets: "2500000000000000",
      normalizationCostAssets: "5000000000000",
      optionExitCostAssets: "10000000000000",
    },
    strategy: {
      strategyKind: "covered_call",
      latestPosition: {
        positionId: 1,
        lifecycle: "normalizing_usdc",
        strikePriceUsd8: "250000000000",
        expiryTimestamp: 1785312000,
        optionAmount8: "125000",
        collateralAssets: "2500000000000000",
        premiumEarnedAssets: "10000000000000",
      },
      totalPremiumCollectedAssets: "5000000",
      nextOpenAfter: 1785312000,
      nextOpenCondition: "after_usdc_normalization",
    },
  };
}

function emptyPosition(
  overrides: Partial<FundPositionResponse> = {},
): FundPositionResponse {
  return {
    fundKey: "base-sepolia:csp",
    address: "0x4000000000000000000000000000000000000004",
    shares: "0",
    accountingValue: "0",
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
    actions: fairSummary().actions,
    asOfBlock: 110,
    indexedAt: "2026-07-26T15:00:00Z",
    stale: false,
    ...overrides,
  };
}
