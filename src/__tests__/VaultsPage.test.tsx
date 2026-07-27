import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { VaultsPage } from "@/components/vaults/VaultsPage";
import { VaultDialog } from "@/components/vaults/VaultDialog";
import { VaultCard } from "@/components/vaults/VaultCard";
import type {
  FundPositionResponse,
  FundSummaryResponse,
} from "@/lib/api";
import { EMPTY_VAULT_POSITION, VAULT_STATE_COPY } from "@/lib/vaults";

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
    expect(screen.getByRole("heading", { name: "ETH Cash-Secured Put" })).toBeInTheDocument();
    expect(screen.getAllByText("NAV price")).toHaveLength(1);
    expect(screen.getByText("ETH puts")).toBeInTheDocument();
    expect(screen.queryByText(/apy/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/earnings/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Fund snapshot is stale/i)).not.toBeInTheDocument();
    expect(screen.queryByText("How this vault works")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /manual trading/i })).toHaveAttribute("href", "/earn/eth");
    expect(screen.getByRole("link", { name: "My Vaults" })).toHaveAttribute("href", "/vaults/my");
    expect(screen.getByRole("button", { name: "Smart wallet balances" })).toHaveTextContent("125.00 USDC");
  });

  it("shows the vault wallet USDC and gas balances from the configured Base contracts", async () => {
    const user = userEvent.setup();
    render(<VaultsPage />);
    await user.click(screen.getByRole("button", { name: "Smart wallet balances" }));
    expect(screen.getByText("Vault wallet")).toBeInTheDocument();
    expect(screen.getByText("0x4000…0004")).toBeInTheDocument();
    expect(screen.getByText("ETH gas")).toBeInTheDocument();
    expect(screen.getByText("0.01234")).toBeInTheDocument();
    expect(screen.getByText("Fund shares")).toBeInTheDocument();
    expect(screen.getByText("b1CSP-V2")).toBeInTheDocument();
    expect(screen.getByText("≈ 0.00 USDC")).toBeInTheDocument();
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

  it("reveals assigned inventory and settlement costs only when present", () => {
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
    expect(screen.getByText("Settlement costs")).toBeInTheDocument();
    expect(screen.getByText("$0.25")).toBeInTheDocument();
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

function emptyPosition(): FundPositionResponse {
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
  };
}
