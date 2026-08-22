import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VaultsPage } from "@/components/vaults/VaultsPage";
import { VaultDialog } from "@/components/vaults/VaultDialog";
import { VaultCard } from "@/components/vaults/VaultCard";
import type {
  FundConfigResponse,
  FundPositionResponse,
  FundSummaryResponse,
} from "@/lib/api";
import { BASE_SEPOLIA_CSP_FUND } from "@/lib/fundDeployment";
import {
  COVERED_CALL_VAULT_CARD,
  EMPTY_VAULT_POSITION,
  META_WHEEL_VAULT_CARD,
  VAULT_STATE_COPY,
} from "@/lib/vaults";

afterEach(() => vi.useRealTimers());

vi.mock("@/components/ConnectButton", () => ({
  ConnectButton: () => <button type="button">Connect</button>,
}));

vi.mock("@/components/AppPreferenceControls", () => ({
  AppPreferenceControls: () => <div data-testid="preference-controls" />,
}));

vi.mock("@/lib/preferences", () => ({
  useAppPreferences: () => ({ locale: "en", theme: "light" }),
}));

const transactionMocks = vi.hoisted(() => ({
  readContract: vi.fn(),
  waitForTransactionReceipt: vi.fn(),
  sendBatchTx: vi.fn(),
}));

vi.mock("@/lib/contracts", () => ({
  CHAIN: { id: 84532 },
  ADDRESSES: {
    usdc: "0xAB51a471493832C1D70cef8ff937A850cf37c860",
    weth: "0x8A6Aa2304797898d46eC1d342Fedc817D3a973B6",
  },
  ERC20_ABI: [],
  publicClient: {
    readContract: transactionMocks.readContract,
    waitForTransactionReceipt: transactionMocks.waitForTransactionReceipt,
  },
}));

vi.mock("@/hooks/useWallet", () => ({
  useWallet: () => ({
    address: "0x4000000000000000000000000000000000000004",
    sendBatchTx: transactionMocks.sendBatchTx,
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

const FEE_CONFIG = {
  fundKey: "base-sepolia:csp",
  deploymentStatus: "DEPLOYED",
  contracts: [],
  fees: {
    managementFeeWad: "20000000000000000",
    managementFeeBps: 200,
    performanceFeeBps: 1_000,
    premiumFeeBps: 1_000,
    highWaterMarkSharePriceAssets: "1000000",
    feeRecipient: "0x4000000000000000000000000000000000000004",
    performanceFeeBasis: "high_water_mark",
    premiumFeeBasis: "gross_premium",
    reportedPremiumBasis: "net_of_premium_fee",
  },
  capabilities: {
    deposit: { available: true, reasonCode: null },
    requestRedemption: { available: true, reasonCode: null },
    cancelRedemption: { available: false, reasonCode: "NO_PENDING_REDEMPTION" },
    claimRedemption: { available: false, reasonCode: "NO_CLAIMABLE_REDEMPTION" },
  },
  writesEnabled: true,
  blockedReasonCode: null,
} satisfies FundConfigResponse;

function trustedFeeConfig(): FundConfigResponse {
  return {
    ...FEE_CONFIG,
    contracts: Object.entries(BASE_SEPOLIA_CSP_FUND.contracts).map(
      ([role, binding]) => ({
        role,
        address: binding.address,
        implementationAddress: binding.implementation,
        interfaceVersion: 1,
      }),
    ),
  };
}

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
    expect(screen.getAllByText("NAV price")).toHaveLength(3);
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
    const wheelCard = screen
      .getByRole("heading", { name: "ETH Meta Wheel" })
      .closest("article");
    expect(wheelCard).not.toBeNull();
    expect(within(wheelCard!).getByText("ETH wheel")).toBeInTheDocument();
    expect(
      within(wheelCard!).getByText(/protecting every assignment price/i),
    ).toBeInTheDocument();
    expect(
      within(wheelCard!).getByRole("button", { name: "Deposit USDC" }),
    ).toBeEnabled();
    expect(screen.queryByText(/apy/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/earnings/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Refresh fund data" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Fund snapshot is stale/i)).not.toBeInTheDocument();
    expect(screen.queryByText("How this vault works")).not.toBeInTheDocument();
    const classicLink = screen.getByRole("link", { name: "v1 manual" });
    expect(classicLink).toHaveAttribute("href", "/earn/eth");
    expect(classicLink.closest("nav")).toHaveAttribute("aria-label", "Vault navigation");
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
    expect(
      screen.queryByRole("heading", { name: "ETH Meta Wheel" }),
    ).not.toBeInTheDocument();
    const classicLink = screen.getByRole("link", { name: "v1 manual" });
    expect(classicLink).toHaveAttribute("href", "/earn/btc");
    expect(classicLink.closest("nav")).toHaveAttribute("aria-label", "Vault navigation");
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
    expect(screen.getAllByText("Fund shares")).toHaveLength(3);
    expect(screen.getByText("b1CSP-V2")).toBeInTheDocument();
    expect(screen.getByText("b1CALL-V2")).toBeInTheDocument();
    expect(screen.getByText("b1WHEEL-V2")).toBeInTheDocument();
    expect(screen.getAllByText("≈ 0.00 USDC")).toHaveLength(2);
    expect(screen.getByText("≈ 0.00 WETH")).toBeInTheDocument();
  });

  it("opens accounting-asset entry and exit controls", async () => {
    const user = userEvent.setup();
    render(<VaultsPage />);
    const cspCard = screen
      .getByRole("heading", { name: "ETH Cash-Secured Put" })
      .closest("article");
    expect(cspCard).not.toBeNull();
    await user.click(
      within(cspCard!).getByRole("button", { name: "Deposit USDC" }),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    const strategyDetails = screen.getByText("How this vault works").closest("details");
    expect(strategyDetails).not.toHaveAttribute("open");
    await user.click(screen.getByText("How this vault works"));
    expect(strategyDetails).toHaveAttribute("open");
    expect(screen.getByText("Target put delta 0.09")).toBeInTheDocument();
    expect(screen.queryByText(/15% below spot/i)).not.toBeInTheDocument();
    expect(screen.getByText("≈48 hours")).toBeInTheDocument();
    expect(screen.getByText("Up to 80%")).toBeInTheDocument();
    expect(screen.getByText("One at a time")).toBeInTheDocument();
    expect(
      screen.getByText(/exact strike distance below spot varies with volatility/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /net premium floor of 20 bps against collateral after protocol fees/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/neither a position nor yield is guaranteed/i),
    ).toBeInTheDocument();
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
        config={FEE_CONFIG}
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
    expect(screen.getByText("Net premium")).toBeInTheDocument();
    expect(screen.getByText("0.000061 USDC")).toBeInTheDocument();
    expect(screen.getByText("Next position")).toBeInTheDocument();
    expect(screen.getByText(/After Jul 29.*settlement/)).toBeInTheDocument();
    const feePolicy = screen.getByRole("region", { name: "Vault fees" });
    expect(within(feePolicy).getByText("2% annually")).toBeInTheDocument();
    expect(within(feePolicy).getAllByText("10%")).toHaveLength(2);
    expect(feePolicy).toHaveTextContent("high-water mark");
    expect(feePolicy).toHaveTextContent("net of the fee");

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

  it("preserves the submitting lock across close and reopen", async () => {
    const user = userEvent.setup();
    let rejectRefresh!: (reason: Error) => void;
    const preSubmitRefresh = new Promise<void>((_resolve, reject) => {
      rejectRefresh = reject;
    });
    transactionMocks.readContract.mockReset();
    transactionMocks.sendBatchTx.mockReset();
    transactionMocks.waitForTransactionReceipt.mockReset();
    const summary = fairSummary();
    summary.fund.fundAddress = BASE_SEPOLIA_CSP_FUND.fundAddress;
    summary.fund.shareToken.address = BASE_SEPOLIA_CSP_FUND.shareAddress;
    summary.publishedAt = new Date().toISOString();
    const position = emptyPosition({ publishedAt: summary.publishedAt });
    const dialog = (open: boolean) => (
      <VaultDialog
        summary={summary}
        position={position}
        config={trustedFeeConfig()}
        loadError={null}
        smartUsdcRaw={BigInt(500_000000)}
        onRefetch={vi.fn(() => preSubmitRefresh)}
        open={open}
        onOpenChange={vi.fn()}
      />
    );
    const { rerender } = render(dialog(true));

    await user.type(screen.getByRole("textbox", { name: "USDC amount" }), "1");
    await user.click(screen.getByRole("button", { name: "Deposit USDC" }));
    await screen.findByRole("button", { name: "Confirming..." });
    rerender(dialog(false));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    rerender(dialog(true));
    expect(await screen.findByRole("button", { name: "Confirming..." })).toBeDisabled();
    expect(screen.getByRole("tab", { name: "Deposit" })).toBeDisabled();
    expect(transactionMocks.sendBatchTx).not.toHaveBeenCalled();

    await act(async () => rejectRefresh(new Error("Backend unavailable")));
    await screen.findByText(/backend unavailable/i);
  });

  it("uses a bounded refreshed generation and keeps tabs locked while syncing or stale", async () => {
    const user = userEvent.setup();
    const hash = `0x${"a".repeat(64)}`;
    const blockHash = `0x${"b".repeat(64)}`;
    let rejectRefetch!: (reason: Error) => void;
    const postRefetch = new Promise<void>((_resolve, reject) => {
      rejectRefetch = reject;
    });
    transactionMocks.readContract.mockReset().mockResolvedValue(BigInt(500_000000));
    transactionMocks.sendBatchTx.mockReset().mockResolvedValue(hash);
    transactionMocks.waitForTransactionReceipt.mockReset().mockResolvedValue({
      status: "success",
      blockNumber: BigInt(111),
      blockHash,
    });
    const summary = fairSummary();
    summary.fund.fundAddress = BASE_SEPOLIA_CSP_FUND.fundAddress;
    summary.fund.shareToken.address = BASE_SEPOLIA_CSP_FUND.shareAddress;
    summary.publishedAt = new Date().toISOString();
    const position = emptyPosition({ publishedAt: summary.publishedAt });
    const config = trustedFeeConfig();
    const onRefetch = vi.fn()
      .mockResolvedValueOnce({
        summary: { ...summary, generation: 5 },
        position: { ...position, generation: 5 },
        config,
      })
      .mockImplementationOnce(() => postRefetch)
      .mockResolvedValueOnce({
        summary: {
          ...summary,
          generation: 6,
          asOfBlock: 111,
          asOfBlockHash: blockHash,
        },
        position: {
          ...position,
          generation: 6,
          asOfBlock: 111,
          asOfBlockHash: blockHash,
        },
        config,
      });

    const dialog = (open: boolean) => (
      <VaultDialog
        summary={summary}
        position={position}
        config={config}
        loadError={null}
        smartUsdcRaw={BigInt(500_000000)}
        onRefetch={onRefetch}
        open={open}
        onOpenChange={vi.fn()}
      />
    );
    const { rerender } = render(dialog(true));

    await user.type(screen.getByRole("textbox", { name: "USDC amount" }), "1");
    await user.click(screen.getByRole("button", { name: "Deposit USDC" }));
    await waitFor(() => expect(transactionMocks.sendBatchTx).toHaveBeenCalledTimes(1));
    expect(onRefetch).toHaveBeenNthCalledWith(1, {
      minGeneration: 4,
      minBlock: 110,
      minBlockHash: `0x${"1".repeat(64)}`,
    });
    expect(onRefetch).toHaveBeenNthCalledWith(2, {
      minGeneration: 6,
      minBlock: 111,
      minBlockHash: blockHash,
    });
    await screen.findByRole("button", { name: "Updating fund..." });
    rerender(dialog(false));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    rerender(dialog(true));
    await screen.findByRole("button", { name: "Updating fund..." });
    let depositTab = screen.getByRole("tab", { name: "Deposit" });
    let exitTab = screen.getByRole("tab", { name: "Exit" });
    expect(depositTab).toBeDisabled();
    expect(exitTab).toBeDisabled();
    await user.click(exitTab);
    expect(depositTab).toHaveAttribute("aria-selected", "true");

    await act(async () => rejectRefetch(new Error("Transaction confirmed. Fund update is still pending.")));
    await waitFor(() => expect(screen.getByText(/still pending/i)).toBeInTheDocument());
    rerender(dialog(false));
    rerender(dialog(true));
    await screen.findByText(/still pending/i);
    depositTab = screen.getByRole("tab", { name: "Deposit" });
    exitTab = screen.getByRole("tab", { name: "Exit" });
    expect(depositTab).toBeDisabled();
    expect(exitTab).toBeDisabled();
    expect(depositTab).toHaveAttribute("aria-selected", "true");
    expect(transactionMocks.sendBatchTx).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Check status again" }));
    await screen.findByText(new RegExp(`Confirmed: ${hash}`, "i"));
    expect(onRefetch).toHaveBeenNthCalledWith(3, {
      minGeneration: 6,
      minBlock: 111,
      minBlockHash: blockHash,
    });
    expect(transactionMocks.sendBatchTx).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("tab", { name: "Deposit" })).toBeEnabled();
    expect(screen.getByRole("tab", { name: "Exit" })).toBeEnabled();
  });

  it("keeps stale state after a repeated manual reconciliation timeout", async () => {
    const user = userEvent.setup();
    const hash = `0x${"c".repeat(64)}`;
    const blockHash = `0x${"d".repeat(64)}`;
    transactionMocks.readContract.mockReset().mockResolvedValue(BigInt(500_000000));
    transactionMocks.sendBatchTx.mockReset().mockResolvedValue(hash);
    transactionMocks.waitForTransactionReceipt.mockReset().mockResolvedValue({
      status: "success",
      blockNumber: BigInt(112),
      blockHash,
    });
    const summary = fairSummary();
    summary.fund.fundAddress = BASE_SEPOLIA_CSP_FUND.fundAddress;
    summary.fund.shareToken.address = BASE_SEPOLIA_CSP_FUND.shareAddress;
    summary.publishedAt = new Date().toISOString();
    const position = emptyPosition({ publishedAt: summary.publishedAt });
    const config = trustedFeeConfig();
    const timeout = new Error("Transaction confirmed. Fund update is still pending.");
    const onRefetch = vi.fn()
      .mockResolvedValueOnce({
        summary: { ...summary, generation: 5 },
        position: { ...position, generation: 5 },
        config,
      })
      .mockRejectedValueOnce(timeout)
      .mockRejectedValueOnce(timeout);

    render(
      <VaultDialog
        summary={summary}
        position={position}
        config={config}
        loadError={null}
        smartUsdcRaw={BigInt(500_000000)}
        onRefetch={onRefetch}
        open
        onOpenChange={vi.fn()}
      />,
    );
    await user.type(screen.getByRole("textbox", { name: "USDC amount" }), "1");
    await user.click(screen.getByRole("button", { name: "Deposit USDC" }));
    await screen.findByRole("button", { name: "Check status again" });
    await user.click(screen.getByRole("button", { name: "Check status again" }));
    await screen.findByRole("button", { name: "Check status again" });
    expect(onRefetch).toHaveBeenNthCalledWith(2, {
      minGeneration: 6,
      minBlock: 112,
      minBlockHash: blockHash,
    });
    expect(onRefetch).toHaveBeenNthCalledWith(3, {
      minGeneration: 6,
      minBlock: 112,
      minBlockHash: blockHash,
    });
    expect(transactionMocks.sendBatchTx).toHaveBeenCalledTimes(1);
    await act(async () => { await Promise.resolve(); });
    expect(onRefetch).toHaveBeenCalledTimes(3);
    expect(transactionMocks.sendBatchTx).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("tab", { name: "Deposit" })).toBeDisabled();
  });

  it("fails closed when the bounded pre-submit Backend refresh fails", async () => {
    const user = userEvent.setup();
    transactionMocks.readContract.mockReset();
    transactionMocks.sendBatchTx.mockReset();
    transactionMocks.waitForTransactionReceipt.mockReset();
    const summary = fairSummary();
    summary.fund.fundAddress = BASE_SEPOLIA_CSP_FUND.fundAddress;
    summary.fund.shareToken.address = BASE_SEPOLIA_CSP_FUND.shareAddress;
    summary.publishedAt = new Date().toISOString();
    const position = emptyPosition({ publishedAt: summary.publishedAt });
    const onRefetch = vi.fn().mockRejectedValue(new Error("Backend unavailable"));

    render(
      <VaultDialog
        summary={summary}
        position={position}
        config={trustedFeeConfig()}
        loadError={null}
        smartUsdcRaw={BigInt(500_000000)}
        onRefetch={onRefetch}
        open
        onOpenChange={vi.fn()}
      />,
    );

    await user.type(screen.getByRole("textbox", { name: "USDC amount" }), "1");
    await user.click(screen.getByRole("button", { name: "Deposit USDC" }));
    await screen.findByText(/backend unavailable/i);
    expect(onRefetch).toHaveBeenCalledWith({
      minGeneration: 4,
      minBlock: 110,
      minBlockHash: `0x${"1".repeat(64)}`,
    });
    expect(transactionMocks.readContract).not.toHaveBeenCalled();
    expect(transactionMocks.sendBatchTx).not.toHaveBeenCalled();
  });

  it("rechecks the 45-second gate after asynchronous allowance preparation", async () => {
    const now = new Date("2026-08-22T00:00:00Z");
    vi.useFakeTimers({ now });
    const hash = `0x${"a".repeat(64)}`;
    transactionMocks.sendBatchTx.mockReset().mockResolvedValue(hash);
    transactionMocks.waitForTransactionReceipt.mockReset();
    transactionMocks.readContract.mockReset().mockImplementation(async () => {
      vi.setSystemTime(now.getTime() + 45_001);
      return BigInt(500_000000);
    });
    const summary = fairSummary();
    summary.fund.fundAddress = BASE_SEPOLIA_CSP_FUND.fundAddress;
    summary.fund.shareToken.address = BASE_SEPOLIA_CSP_FUND.shareAddress;
    summary.publishedAt = now.toISOString();
    const position = emptyPosition({ publishedAt: summary.publishedAt });
    const config = trustedFeeConfig();
    const onRefetch = vi.fn().mockResolvedValue({
      summary: { ...summary, generation: 5 },
      position: { ...position, generation: 5 },
      config,
    });

    render(
      <VaultDialog
        summary={summary}
        position={position}
        config={config}
        loadError={null}
        smartUsdcRaw={BigInt(500_000000)}
        onRefetch={onRefetch}
        open
        onOpenChange={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByRole("textbox", { name: "USDC amount" }), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Deposit USDC" }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(transactionMocks.readContract).toHaveBeenCalledTimes(1);
    expect(transactionMocks.sendBatchTx).not.toHaveBeenCalled();
    expect(screen.getByText(/locally expired/i)).toBeInTheDocument();
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

  it("shows parallel wheel allocations and the protected assignment floor", async () => {
    const user = userEvent.setup();
    render(
      <VaultDialog
        vault={META_WHEEL_VAULT_CARD}
        summary={metaWheelSummary()}
        position={emptyPosition({
          fundKey: "base-sepolia:meta-wheel",
          accountingValue: "0",
        })}
        config={null}
        loadError={null}
        smartAssetRaw={BigInt(500_000000)}
        onRefetch={vi.fn()}
        open
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByText("ETH WHEEL · USDC")).toBeInTheDocument();
    expect(screen.getByText("Current wheel state")).toBeInTheDocument();
    expect(screen.getByText("CSP and covered-call lanes active")).toBeInTheDocument();
    expect(screen.getByText("2 tranches")).toBeInTheDocument();
    expect(screen.getByText("Literal assignment floor")).toBeInTheDocument();
    expect(screen.getAllByText("$1,640")).toHaveLength(2);
    expect(screen.getByText("Protected call floor")).toBeInTheDocument();
    expect(screen.getAllByText("$1,650")).toHaveLength(2);
    expect(screen.getByText("Redemption reserve")).toBeInTheDocument();
    expect(screen.getByText("$40.00")).toBeInTheDocument();
    expect(screen.getByText("$35.00 principal tracked")).toBeInTheDocument();
    expect(screen.getByText("Net option premium")).toBeInTheDocument();
    expect(screen.getByText("$11.00")).toBeInTheDocument();
    expect(screen.getByText("Fair option liabilities")).toBeInTheDocument();
    expect(screen.getByText(/Physical delivery is pending/i)).toBeInTheDocument();

    await user.click(screen.getByText(/Tracked capital · 2 active tranches/i));
    expect(screen.getByText("CSP position open")).toBeInTheDocument();
    expect(screen.getByText("Awaiting physical delivery")).toBeInTheDocument();
    expect(screen.getByText("Wait for physical delivery")).toBeInTheDocument();
    expect(screen.getAllByText("Literal assignment")).toHaveLength(2);
    expect(screen.getByText(/Execution hash 0x111111…111111/i)).toBeInTheDocument();
    expect(screen.getByText(/NAV reconciliation: coherent at block 123/i)).toBeInTheDocument();
    expect(screen.queryByText(/child shares/i)).not.toBeInTheDocument();

    await user.click(screen.getByText("How this vault works"));
    expect(screen.getByText("Calls never below assignment")).toBeInTheDocument();
    expect(
      screen.getByText(/one assignment lot.*literal CSP assignment strike/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/remains idle rather than realizing a below-assignment sale/i),
    ).toBeInTheDocument();
  });
});

function metaWheelSummary(): FundSummaryResponse {
  const summary = fairSummary();
  summary.fund.fundKey = "base-sepolia:meta-wheel";
  summary.fund.strategyKind = "meta_wheel";
  summary.fund.shareToken.symbol = "b1WHEEL";
  summary.strategy = undefined;
  summary.wheel = {
    pendingCspAssets: "180000000",
    cspValueAssets: "420000000",
    transitionWeth: "100000000000000000",
    transitionWethValueAssets: "170000000",
    coveredCallValueAssets: "200000000",
    returnedUsdcAssets: "0",
    reservedRedemptionAssets: "40000000",
    redemption: {
      reservedAssets: "40000000",
      reservedPrincipalAssets: "35000000",
    },
    activeTrancheCount: 2,
    protectedAssignmentFloorUsd8: "165000000000",
    currentPhase: "mixed",
    nextAction: "Open an eligible covered call above the protected floor",
    cumulativeGrossPremiumAssets: "13000000",
    cumulativeProtocolFeeAssets: "2000000",
    cumulativeNetPremiumAssets: "11000000",
    policyVersion: 1,
    policyHash: "0xdb47fcd1",
    navCoherent: true,
    navSnapshotBlock: 123,
    navSnapshotBlockHash: "0xabc",
    paused: false,
    tranches: [
      {
        trancheId: "17",
        childVault: "0x5000000000000000000000000000000000000005",
        state: "call_settling",
        principalAssets: "250000000",
        pendingAssets: "0",
        childShares: "250000000000000000000",
        childPositionId: "4",
        childExecutionStateHash: `0x${"1".repeat(64)}`,
        settlementKind: "pending_delivery",
        assignmentLotIds: ["9"],
        literalAssignmentFloorUsd8: "164000000000",
        protectedAssignmentFloorUsd8: "165000000000",
        callStrikeUsd8: "170000000000",
        transitionNonce: 6,
        nextAction: "wait_for_physical_delivery",
      },
      {
        trancheId: "18",
        childVault: "0x6000000000000000000000000000000000000006",
        state: "csp_open",
        principalAssets: "420000000",
        pendingAssets: "0",
        childShares: "420000000000000000000",
        childPositionId: "5",
        childExecutionStateHash: `0x${"2".repeat(64)}`,
        settlementKind: null,
        assignmentLotIds: [],
        literalAssignmentFloorUsd8: "0",
        protectedAssignmentFloorUsd8: "0",
        callStrikeUsd8: null,
        transitionNonce: 2,
        nextAction: "wait_for_csp_expiry",
      },
    ],
  };
  return summary;
}

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
    generation: 4,
    asOfBlock: 110,
    asOfBlockHash: `0x${"1".repeat(64)}`,
    publishedAt: "2026-07-26T15:00:00Z",
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
    generation: 4,
    asOfBlock: 110,
    asOfBlockHash: `0x${"1".repeat(64)}`,
    publishedAt: "2026-07-26T15:00:00Z",
    indexedAt: "2026-07-26T15:00:00Z",
    stale: false,
    ...overrides,
  };
}
