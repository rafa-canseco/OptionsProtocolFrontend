import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { VaultsPage } from "@/components/vaults/VaultsPage";
import { VaultDialog } from "@/components/vaults/VaultDialog";
import type {
  FundPositionResponse,
  FundSummaryResponse,
} from "@/lib/api";
import { VAULT_STATE_COPY } from "@/lib/vaults";

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
    expect(screen.getByText(/assigned WETH are reflected in the share price/i)).toBeInTheDocument();
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

  it("presents fair NAV separately from locked collateral and stress value", async () => {
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
    expect(screen.getByText("Fund asset · not a loss")).toBeInTheDocument();
    expect(screen.getByText("Fair put liability")).toBeInTheDocument();
    expect(screen.getByText("−$30.00")).toBeInTheDocument();
    expect(screen.getByText(/Fresh · European put fair value/)).toBeInTheDocument();
    expect(screen.getByText("Stress").parentElement).toHaveTextContent("$0.20");

    await user.type(screen.getByRole("textbox", { name: "USDC amount" }), "200");
    const preview = screen.getByLabelText("Deposit share preview");
    expect(preview).toHaveTextContent("206.185");
    expect(preview).toHaveTextContent("current NAV price of $0.97");
    expect(preview).not.toHaveTextContent("$0.20");
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
