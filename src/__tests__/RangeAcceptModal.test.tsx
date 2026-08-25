import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RangeAcceptModal } from "@/components/v2/RangeAcceptModal";
import type { PriceQuote } from "@/lib/api";

const state = vi.hoisted(() => ({
  sendBatchTx: vi.fn(),
  groupPositions: vi.fn(),
  readTokenBalance: vi.fn(),
  fireAndPoll: vi.fn(),
}));

vi.mock("@/hooks/useWallet", () => ({
  useWallet: () => ({
    address: "0x0000000000000000000000000000000000000001",
    isConnected: true,
    sendBatchTx: state.sendBatchTx,
  }),
}));
vi.mock("@/lib/contracts", () => ({
  publicClient: {
    getBalance: vi.fn().mockResolvedValue(BigInt(10) ** BigInt(20)),
    readContract: vi.fn().mockResolvedValue(BigInt(2) ** BigInt(255)),
    waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: "success" }),
  },
  ADDRESSES: {
    usdc: "0x0000000000000000000000000000000000000002",
    weth: "0x0000000000000000000000000000000000000003",
    wbtc: "0x0000000000000000000000000000000000000004",
    marginPool: "0x0000000000000000000000000000000000000005",
    batchSettler: "0x0000000000000000000000000000000000000006",
    swapRouter: null,
  },
  CHAIN: { blockExplorers: { default: { url: "https://basescan.org" } } },
  ERC20_ABI: [],
  WETH_ABI: [],
}));
vi.mock("@/lib/execution", () => ({
  computeCollateral: (isBuy: boolean) => ({
    oTokenAmount: BigInt(1),
    collateral: BigInt(1),
    collateralAsset: isBuy
      ? "0x0000000000000000000000000000000000000002"
      : "0x0000000000000000000000000000000000000003",
  }),
  encodeExecuteOrder: vi.fn(() => "0xexecute"),
  readTokenBalance: state.readTokenBalance,
  fireAndPoll: state.fireAndPoll,
  buildOptimisticPosition: vi.fn(() => ({})),
}));
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { ...actual.api, groupPositions: state.groupPositions } };
});
vi.mock("@/lib/optimisticPositions", () => ({ saveOptimistic: vi.fn() }));
vi.mock("@/lib/marketState", () => ({ isProductionReadOnlyAsset: () => false }));
vi.mock("@/lib/assets", () => ({ getAssetConfig: () => ({ slug: "eth", chain: "base", swapFeeTier: 3000 }) }));
vi.mock("@/lib/swap", () => ({ encodeSwapExactOutput: vi.fn() }));
vi.mock("@/lib/solana", () => ({ solanaTxUrl: (hash: string) => `https://solscan.io/tx/${hash}` }));
vi.mock("@/lib/dataInvalidation", () => ({ invalidateData: vi.fn() }));
vi.mock("@/components/DepositModal", () => ({ DepositModal: () => <div data-testid="deposit-modal" /> }));

function quote(optionType: "put" | "call", strike: number): PriceQuote {
  return {
    option_type: optionType,
    strike,
    expiry_days: 7,
    expiry_date: "2030-01-01",
    premium: 10,
    delta: optionType === "put" ? -0.2 : 0.2,
    iv: 0.5,
    spot: 2_000,
    ttl: 60,
    expires_at: 1_900_000_000,
    available_amount: 10,
    otoken_address: "0xoption",
    signature: "0xsig",
    mm_address: "0xmaker",
    bid_price_raw: 1,
    deadline: Math.floor(Date.now() / 1000) + 600,
    quote_id: `${optionType}-quote`,
    max_amount_raw: 1,
    maker_nonce: 1,
    position_count: 0,
    chain: "base",
  };
}

function renderRange(overrides: Partial<React.ComponentProps<typeof RangeAcceptModal>> = {}) {
  const props: React.ComponentProps<typeof RangeAcceptModal> = {
    putQuote: quote("put", 1_900),
    callQuote: quote("call", 2_100),
    putAmountUsd: 100,
    callAmountEth: 0.05,
    totalPremium: 2,
    assetSymbol: "ETH",
    assetSlug: "eth",
    onClose: vi.fn(),
    onAccepted: vi.fn(),
    ...overrides,
  };
  render(<RangeAcceptModal {...props} />);
  return props;
}

const runAndReturnHash = async (run: () => Promise<unknown>) => {
  const result = await run();
  return typeof result === "string" ? result : null;
};

describe("RangeAcceptModal confirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.sendBatchTx
      .mockResolvedValueOnce("0xput")
      .mockResolvedValueOnce("0xcall");
    state.readTokenBalance.mockResolvedValue(BigInt(10) ** BigInt(20));
    state.fireAndPoll.mockImplementation(runAndReturnHash);
    state.groupPositions.mockResolvedValue(undefined);
  });

  it("keeps the completed range visible and announced until explicit close", async () => {
    const onAccepted = vi.fn();
    renderRange({ onAccepted });

    await userEvent.click(screen.getByRole("button", { name: "Accept range" }));
    await waitFor(() => expect(state.sendBatchTx).toHaveBeenCalledTimes(2));
    expect(onAccepted).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("Lower side done");
    expect(screen.getByRole("status")).toHaveTextContent("Upper side done");
    expect(screen.getByRole("link", { name: "Lower tx" })).toHaveAttribute("href", "https://basescan.org/tx/0xput");
    expect(screen.getByRole("link", { name: "Upper tx" })).toHaveAttribute("href", "https://basescan.org/tx/0xcall");

    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(onAccepted).toHaveBeenCalledWith({ putTxHash: "0xput", callTxHash: "0xcall" });
  });

  it("uses a synchronous single-flight guard for rapid clicks", async () => {
    renderRange();
    const accept = screen.getByRole("button", { name: "Accept range" });

    fireEvent.click(accept);
    fireEvent.click(accept);

    expect(state.readTokenBalance).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("button", { name: "Continue" })).toBeInTheDocument();
    expect(state.sendBatchTx).toHaveBeenCalledTimes(2);
    expect(state.fireAndPoll).toHaveBeenCalledTimes(2);
  });

  it("retries only the upper leg after a persisted partial success", async () => {
    state.sendBatchTx.mockReset()
      .mockResolvedValueOnce("0xput")
      .mockResolvedValueOnce("0xfailed-call")
      .mockResolvedValueOnce("0xcall-retry");
    state.fireAndPoll.mockReset()
      .mockImplementationOnce(runAndReturnHash)
      .mockImplementationOnce(async (run: () => Promise<unknown>) => {
        await run();
        throw new Error("upper failed");
      })
      .mockImplementationOnce(runAndReturnHash);

    renderRange();
    await userEvent.click(screen.getByRole("button", { name: "Accept range" }));

    expect(await screen.findByRole("button", { name: "Retry upper side" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close partial range" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Lower side completed");
    expect(screen.getByRole("link", { name: "Lower tx" })).toHaveAttribute("href", "https://basescan.org/tx/0xput");
    expect(screen.queryByRole("link", { name: "Upper tx" })).not.toBeInTheDocument();
    expect(state.sendBatchTx).toHaveBeenCalledTimes(2);

    await userEvent.click(screen.getByRole("button", { name: "Retry upper side" }));

    await waitFor(() => expect(state.sendBatchTx).toHaveBeenCalledTimes(3));
    expect(state.fireAndPoll).toHaveBeenCalledTimes(3);
    expect(screen.getByRole("link", { name: "Lower tx" })).toHaveAttribute("href", "https://basescan.org/tx/0xput");
    expect(await screen.findByRole("link", { name: "Upper tx" })).toHaveAttribute("href", "https://basescan.org/tx/0xcall-retry");
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
  });

  it("rejects non-Base active quotes before balance reads or transactions", async () => {
    renderRange({ putQuote: { ...quote("put", 1_900), chain: "solana" } });

    await userEvent.click(screen.getByRole("button", { name: "Accept range" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("must be available on Base");
    expect(state.readTokenBalance).not.toHaveBeenCalled();
    expect(state.sendBatchTx).not.toHaveBeenCalled();
  });

  it("uses cbBTC in range confirmation copy", async () => {
    renderRange({ assetSymbol: "cbBTC", assetSlug: "btc", callAmountEth: 0.001 });

    await userEvent.click(screen.getByRole("button", { name: "Accept range" }));

    expect(await screen.findByText("cbBTC range confirmed.")).toBeInTheDocument();
    expect(screen.getByText(/0.0010 cbBTC/)).toBeInTheDocument();
    expect(screen.queryByText("ETH range confirmed.")).not.toBeInTheDocument();
  });
});
