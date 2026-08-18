import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AcceptModal } from "@/components/AcceptModal";
import { ApiError, type PriceQuote } from "@/lib/api";

const ORIGINAL_LAZY_OTOKEN_ENABLED =
  process.env.NEXT_PUBLIC_LAZY_OTOKEN_ENABLED;

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
    ensureSeries: vi.fn(),
    getAccessToken: vi.fn(),
    encodeExecuteOrder: vi.fn(),
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

vi.mock("@privy-io/react-auth", () => ({
  usePrivy: () => ({
    getAccessToken: state.getAccessToken,
  }),
}));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: {
      ...actual.api,
      ensureSeries: state.ensureSeries,
    },
  };
});

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
    encodeExecuteOrder: state.encodeExecuteOrder,
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
    process.env.NEXT_PUBLIC_LAZY_OTOKEN_ENABLED = "true";
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
    state.getAccessToken.mockResolvedValue("privy-token");
    state.ensureSeries.mockImplementation(
      async (request: {
        expected_otoken_address: string;
        quote: Record<string, string>;
      }) => ({
        status: "ready",
        otoken_address: request.expected_otoken_address,
        execution_quote: request.quote,
      }),
    );
    state.encodeExecuteOrder.mockReturnValue("0xexecuteorder");
  });

  afterEach(() => {
    vi.clearAllMocks();
    if (ORIGINAL_LAZY_OTOKEN_ENABLED === undefined) {
      delete process.env.NEXT_PUBLIC_LAZY_OTOKEN_ENABLED;
    } else {
      process.env.NEXT_PUBLIC_LAZY_OTOKEN_ENABLED =
        ORIGINAL_LAZY_OTOKEN_ENABLED;
    }
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

    expect(state.getAccessToken).toHaveBeenCalledTimes(1);
    expect(state.ensureSeries).toHaveBeenCalledTimes(1);
    expect(state.encodeExecuteOrder).toHaveBeenCalledTimes(1);
    expect(
      state.ensureSeries.mock.invocationCallOrder[0],
    ).toBeLessThan(state.encodeExecuteOrder.mock.invocationCallOrder[0]);
    expect(
      state.encodeExecuteOrder.mock.invocationCallOrder[0],
    ).toBeLessThan(state.sendBatchTx.mock.invocationCallOrder[0]);
    expect(state.ensureSeries).toHaveBeenCalledWith(
      expect.objectContaining({
        wallet_address: "0xSmartWallet",
        expected_otoken_address: "0xOtoken",
        amount_raw: "478260",
        quote: expect.objectContaining({
          bid_price_raw: "280000",
          deadline: "1900000030",
          quote_id: "quote-1",
          max_amount_raw: "200000000",
          maker_nonce: "7",
          signature: "0xsig",
          mm_address: "0xMaker",
        }),
      }),
      "privy-token",
      expect.objectContaining({
        signal: expect.any(AbortSignal),
        idempotencyKey: expect.stringContaining("quote-1"),
      }),
    );

    // Deposit modal must NOT have been rendered (regression for B1N-309).
    expect(
      screen.queryByText(/Manage funds/i),
    ).not.toBeInTheDocument();
  });

  it("preserves eager ready execution without Privy ensure when the gate is off", async () => {
    process.env.NEXT_PUBLIC_LAZY_OTOKEN_ENABLED = "false";

    render(
      <AcceptModal
        quote={buildBaseQuote({ deployment_status: "ready" })}
        side="buy"
        onClose={vi.fn()}
        onAccepted={vi.fn()}
        initialAmount="11"
        assetSymbol="ETH"
        assetSlug="eth"
      />,
    );

    await userEvent.click(
      await screen.findByRole("button", { name: /Accept/i }),
    );

    await waitFor(() => {
      expect(state.sendBatchTx).toHaveBeenCalledTimes(1);
    });
    expect(state.getAccessToken).not.toHaveBeenCalled();
    expect(state.ensureSeries).not.toHaveBeenCalled();
    expect(state.encodeExecuteOrder).toHaveBeenCalledTimes(1);
  });

  it("blocks virtual series when the lazy rollout gate is off", async () => {
    process.env.NEXT_PUBLIC_LAZY_OTOKEN_ENABLED = "false";

    render(
      <AcceptModal
        quote={buildBaseQuote({ deployment_status: "virtual" })}
        side="buy"
        onClose={vi.fn()}
        onAccepted={vi.fn()}
        initialAmount="11"
        assetSymbol="ETH"
        assetSlug="eth"
      />,
    );

    await userEvent.click(
      await screen.findByRole("button", { name: /Accept/i }),
    );

    expect(
      await screen.findByText(/option series is still being prepared/i),
    ).toBeInTheDocument();
    expect(state.getAccessToken).not.toHaveBeenCalled();
    expect(state.ensureSeries).not.toHaveBeenCalled();
    expect(state.encodeExecuteOrder).not.toHaveBeenCalled();
    expect(state.sendBatchTx).not.toHaveBeenCalled();
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
    expect(state.ensureSeries).not.toHaveBeenCalled();
  });

  it("waits through creating before encoding or prompting the wallet", async () => {
    state.ensureSeries
      .mockImplementationOnce(
        async (request: {
          expected_otoken_address: string;
          quote: Record<string, string>;
        }) => ({
          status: "creating",
          otoken_address: request.expected_otoken_address,
          retry_after_ms: 1,
          execution_quote: request.quote,
        }),
      )
      .mockImplementationOnce(
        async (request: {
          expected_otoken_address: string;
          quote: Record<string, string>;
        }) => ({
          status: "ready",
          otoken_address: request.expected_otoken_address,
          execution_quote: request.quote,
        }),
      );

    render(
      <AcceptModal
        quote={buildBaseQuote({ deployment_status: "virtual" })}
        side="buy"
        onClose={vi.fn()}
        onAccepted={vi.fn()}
        initialAmount="11"
        assetSymbol="ETH"
        assetSlug="eth"
      />,
    );

    await userEvent.click(
      await screen.findByRole("button", { name: /Accept/i }),
    );

    expect(await screen.findByText(/Creating option series/i)).toBeInTheDocument();
    expect(state.encodeExecuteOrder).not.toHaveBeenCalled();
    expect(state.sendBatchTx).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(state.ensureSeries).toHaveBeenCalledTimes(2);
      expect(state.sendBatchTx).toHaveBeenCalledTimes(1);
    });
  });

  it("fails closed when the prepared quote does not match", async () => {
    const onQuoteInvalid = vi.fn();
    state.ensureSeries.mockImplementation(
      async (request: {
        expected_otoken_address: string;
        quote: Record<string, string>;
      }) => ({
        status: "ready",
        otoken_address: request.expected_otoken_address,
        execution_quote: {
          ...request.quote,
          maker_nonce: "8",
        },
      }),
    );

    render(
      <AcceptModal
        quote={buildBaseQuote()}
        side="buy"
        onClose={vi.fn()}
        onAccepted={vi.fn()}
        onQuoteInvalid={onQuoteInvalid}
        initialAmount="11"
        assetSymbol="ETH"
        assetSlug="eth"
      />,
    );

    await userEvent.click(
      await screen.findByRole("button", { name: /Accept/i }),
    );

    expect(
      await screen.findByText(/quote changed while the trade was being prepared/i),
    ).toBeInTheDocument();
    expect(state.encodeExecuteOrder).not.toHaveBeenCalled();
    expect(state.sendBatchTx).not.toHaveBeenCalled();

    await userEvent.click(
      screen.getByRole("button", { name: /Refresh quote/i }),
    );
    expect(onQuoteInvalid).toHaveBeenCalledTimes(1);
  });

  it("shows a retryable preparation failure and only prompts the wallet after retry", async () => {
    state.ensureSeries
      .mockRejectedValueOnce(
        new ApiError(503, {
          code: "SERIES_CREATION_FAILED",
          message: "Series creation is temporarily unavailable.",
          retryable: true,
        }),
      )
      .mockImplementationOnce(
        async (request: {
          expected_otoken_address: string;
          quote: Record<string, string>;
        }) => ({
          status: "ready",
          otoken_address: request.expected_otoken_address,
          execution_quote: request.quote,
        }),
      );

    render(
      <AcceptModal
        quote={buildBaseQuote({ deployment_status: "virtual" })}
        side="buy"
        onClose={vi.fn()}
        onAccepted={vi.fn()}
        initialAmount="11"
        assetSymbol="ETH"
        assetSlug="eth"
      />,
    );

    await userEvent.click(
      await screen.findByRole("button", { name: /Accept/i }),
    );

    expect(
      await screen.findByText(/Series creation is temporarily unavailable/i),
    ).toBeInTheDocument();
    expect(state.encodeExecuteOrder).not.toHaveBeenCalled();
    expect(state.sendBatchTx).not.toHaveBeenCalled();

    await userEvent.click(
      screen.getByRole("button", { name: /Retry preparation/i }),
    );

    await waitFor(() => {
      expect(state.ensureSeries).toHaveBeenCalledTimes(2);
      expect(state.sendBatchTx).toHaveBeenCalledTimes(1);
    });
    expect(
      state.ensureSeries.mock.calls[0][2].idempotencyKey,
    ).toBe(state.ensureSeries.mock.calls[1][2].idempotencyKey);
  });

  it("wraps ETH, approves WETH, and executes a call in one wallet batch", async () => {
    const wethBefore = BigInt(200_000_000_000_000_000);
    const nativeBefore = BigInt(1_000_000_000_000_000_000);
    state.balanceOf.mockResolvedValue(wethBefore);
    state.getBalance.mockResolvedValue(nativeBefore);
    state.readAllowance.mockResolvedValue(BigInt(0));

    render(
      <AcceptModal
        quote={buildBaseQuote({ option_type: "call" })}
        side="sell"
        onClose={vi.fn()}
        onAccepted={vi.fn()}
        initialAmount="0.5"
        assetSymbol="ETH"
        assetSlug="eth"
      />,
    );

    await userEvent.click(
      await screen.findByRole("button", { name: /Accept/i }),
    );

    await waitFor(() => {
      expect(state.sendBatchTx).toHaveBeenCalledTimes(1);
    });

    const calls = state.sendBatchTx.mock.calls[0][0];
    expect(calls).toHaveLength(3);
    expect(calls[0]).toEqual(
      expect.objectContaining({
        to: "0x0000000000000000000000000000000000000002",
        value: BigInt(300_000_000_000_000_000),
      }),
    );
    expect(calls[1]).toEqual(
      expect.objectContaining({
        to: "0x0000000000000000000000000000000000000002",
      }),
    );
    expect(calls[2]).toEqual({
      to: "0x0000000000000000000000000000000000000005",
      data: "0xexecuteorder",
    });
    expect(state.waitForReceipt).not.toHaveBeenCalled();
    expect(state.ensureSeries).toHaveBeenCalledTimes(1);
    expect(
      state.ensureSeries.mock.invocationCallOrder[0],
    ).toBeLessThan(state.sendBatchTx.mock.invocationCallOrder[0]);
  });

  it("does not prepare Solana orders", async () => {
    const previousSolanaEnabled = process.env.NEXT_PUBLIC_SOLANA_ENABLED;
    process.env.NEXT_PUBLIC_SOLANA_ENABLED = "true";
    render(
      <AcceptModal
        quote={buildBaseQuote({ chain: "solana" })}
        side="buy"
        onClose={vi.fn()}
        onAccepted={vi.fn()}
        initialAmount="11"
        assetSymbol="SOL"
        assetSlug="sol"
      />,
    );

    await userEvent.click(
      await screen.findByRole("button", { name: /Accept/i }),
    );

    await waitFor(() => {
      expect(state.ensureSeries).not.toHaveBeenCalled();
    });
    if (previousSolanaEnabled === undefined) {
      delete process.env.NEXT_PUBLIC_SOLANA_ENABLED;
    } else {
      process.env.NEXT_PUBLIC_SOLANA_ENABLED = previousSolanaEnabled;
    }
  });
});
