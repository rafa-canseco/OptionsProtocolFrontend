import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AcceptModal } from "@/components/AcceptModal";
import type { PriceQuote } from "@/lib/api";

// --- Hoisted mock state ---------------------------------------------------

const { state } = vi.hoisted(() => ({
  state: {
    baseUsdcRaw: BigInt(7_613_000_000),
    sendBatchTx: vi.fn(),
    readAllowance: vi.fn(),
    balanceOf: vi.fn(),
    getBalance: vi.fn(),
    waitForReceipt: vi.fn(),
    checkDeficit: vi.fn(),
    executeBridgeAndTrade: vi.fn(),
  },
}));

// --- Mocks ---------------------------------------------------------------

vi.mock("@/hooks/useWallet", () => ({
  useWallet: () => ({
    address: "0xSmartWallet",
    solanaAddress: undefined,
    sendBatchTx: state.sendBatchTx,
    sendSolanaTransaction: vi.fn(),
    isConnected: true,
  }),
}));

vi.mock("@/hooks/useBalances", () => ({
  useBalances: () => ({
    usd: 7_613,
    eth: 0,
    weth: 0,
    wbtc: 0,
    usdRaw: state.baseUsdcRaw,
    ethRaw: BigInt(0),
    wethRaw: BigInt(0),
    wbtcRaw: BigInt(0),
    loading: false,
  }),
}));

vi.mock("@/hooks/useSolanaBalance", () => ({
  useSolanaBalance: () => ({
    solanaUsdcRaw: BigInt(0),
    solanaUsdc: 0,
    solanaWsolRaw: BigInt(0),
    solanaSolRaw: BigInt(0),
    solanaTslaxRaw: BigInt(0),
    solanaTslax: 0,
    loading: false,
  }),
}));

vi.mock("@/hooks/useBridgeAndTrade", () => ({
  useBridgeAndTrade: () => ({
    checkDeficit: state.checkDeficit,
    executeBridgeAndTrade: state.executeBridgeAndTrade,
  }),
}));

vi.mock("@/lib/contracts", () => ({
  publicClient: {
    readContract: (args: { functionName: string }) =>
      args.functionName === "allowance"
        ? state.readAllowance()
        : state.balanceOf(),
    getBalance: () => state.getBalance(),
    waitForTransactionReceipt: () => state.waitForReceipt(),
  },
  ADDRESSES: {
    usdc: "0x0000000000000000000000000000000000000001",
    weth: "0x0000000000000000000000000000000000000002",
    wbtc: "0x0000000000000000000000000000000000000003",
    marginPool: "0x0000000000000000000000000000000000000004",
    batchSettler: "0x0000000000000000000000000000000000000005",
  },
  CHAIN: { id: 8453, blockExplorers: { default: { url: "https://basescan.org" } } },
  ERC20_ABI: [
    {
      name: "approve",
      type: "function",
      inputs: [
        { name: "spender", type: "address" },
        { name: "amount", type: "uint256" },
      ],
      outputs: [{ type: "bool" }],
    },
    {
      name: "allowance",
      type: "function",
      inputs: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
      ],
      outputs: [{ type: "uint256" }],
    },
    {
      name: "balanceOf",
      type: "function",
      inputs: [{ name: "account", type: "address" }],
      outputs: [{ type: "uint256" }],
    },
  ],
  WETH_ABI: [
    {
      name: "deposit",
      type: "function",
      inputs: [],
      outputs: [],
      stateMutability: "payable",
    },
  ],
  BATCH_SETTLER_ABI: [],
}));

vi.mock("@/lib/solana", () => ({
  SOLANA_NATIVE_RESERVE_LAMPORTS: BigInt(5_000_000),
  solanaTxUrl: (h: string) => `https://solscan.io/tx/${h}`,
  toPublicKey: vi.fn(),
}));

vi.mock("@/lib/bridgeTx", () => ({
  buildSolanaTradeSetupTransaction: vi.fn(),
  buildSolanaTradeTransaction: vi.fn(),
}));

vi.mock("@/lib/optimisticPositions", () => ({
  saveOptimistic: vi.fn(),
}));

vi.mock("@/components/ui/InfoTooltip", () => ({
  InfoTooltip: () => null,
}));

vi.mock("@/components/DepositModal", () => ({
  DepositModal: () => <div data-testid="deposit-modal">Manage funds</div>,
}));

vi.mock("@/lib/execution", async () => {
  const actual = await vi.importActual<typeof import("@/lib/execution")>(
    "@/lib/execution",
  );
  return {
    ...actual,
    readTokenBalance: () => state.balanceOf(),
    fireAndPoll: async (run: () => Promise<unknown>) => {
      const result = await run();
      return typeof result === "string" ? (result as `0x${string}`) : null;
    },
    buildOptimisticPosition: vi.fn(() => ({})),
    encodeExecuteOrder: () => "0xexecuteorder" as `0x${string}`,
  };
});

// --- Helpers -------------------------------------------------------------

function buildBaseQuote(overrides: Partial<PriceQuote> = {}): PriceQuote {
  return {
    option_type: "put",
    strike: 2300,
    expiry_days: 8,
    expiry_date: "2026-05-01",
    premium: 0.28,
    delta: -0.1,
    iv: 0.6,
    spot: 2326,
    ttl: 60,
    expires_at: 1_900_000_000,
    available_amount: 5,
    otoken_address: "0xOtoken",
    signature: "0xsig",
    mm_address: "0xMaker",
    bid_price_raw: 280_000,
    deadline: 1_900_000_030,
    quote_id: "quote-1",
    max_amount_raw: 200_000_000,
    maker_nonce: 7,
    position_count: 0,
    chain: "base",
    ...overrides,
  };
}

// --- Tests ---------------------------------------------------------------

describe("AcceptModal Base buy with sufficient USDC", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.baseUsdcRaw = BigInt(7_613_000_000);
    state.checkDeficit.mockReturnValue({
      needsBridge: false,
      needsDeposit: false,
      sourceChain: null,
      deficit: BigInt(0),
    });
    state.readAllowance.mockResolvedValue(BigInt(0));
    state.balanceOf.mockResolvedValue(BigInt(0));
    state.getBalance.mockResolvedValue(BigInt(0));
    state.waitForReceipt.mockResolvedValue({});
    state.sendBatchTx.mockResolvedValue("0xsuccess");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("executes the trade instead of opening the deposit modal", async () => {
    render(
      <AcceptModal
        quote={buildBaseQuote()}
        side="buy"
        onClose={vi.fn()}
        onAccepted={vi.fn()}
        initialAmount="11"
        assetSymbol="ETH"
        assetSlug="eth"
      />,
    );

    const acceptBtn = await screen.findByRole("button", { name: /Accept/i });
    await userEvent.click(acceptBtn);

    await waitFor(() => {
      expect(state.sendBatchTx).toHaveBeenCalled();
    });

    // Deposit modal must NOT have been rendered (regression for B1N-309).
    expect(
      screen.queryByText(/Manage funds/i),
    ).not.toBeInTheDocument();
  });

  it("still routes to deposit modal when USDC is actually insufficient", async () => {
    state.checkDeficit.mockReturnValue({
      needsBridge: false,
      needsDeposit: true,
      sourceChain: null,
      deficit: BigInt(10_000_000),
    });

    render(
      <AcceptModal
        quote={buildBaseQuote()}
        side="buy"
        onClose={vi.fn()}
        onAccepted={vi.fn()}
        initialAmount="11"
        assetSymbol="ETH"
        assetSlug="eth"
      />,
    );

    const acceptBtn = await screen.findByRole("button", { name: /Accept/i });
    await userEvent.click(acceptBtn);

    await waitFor(() => {
      expect(screen.getByText(/Manage funds/i)).toBeInTheDocument();
    });

    expect(state.sendBatchTx).not.toHaveBeenCalled();
  });
});
