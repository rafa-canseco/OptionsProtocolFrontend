import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { decodeFunctionData } from "viem";
import {
  DepositModal,
  resolveSolanaUsdcWithdrawAmount,
} from "@/components/DepositModal";

const ORIGINAL_ENV = { ...process.env };

const mockSendBatchTx = vi.fn();
const mockSendFundingTx = vi.fn();
const ERC20_TRANSFER_ABI = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

type ExternalWalletStub = {
  address: string;
  chain: "base" | "solana";
  name: string;
  walletClientType: string;
};

const baseExternalWallet: ExternalWalletStub = {
  address: "0xFunding",
  chain: "base",
  name: "MetaMask",
  walletClientType: "metamask",
};

type WalletStub = {
  address: `0x${string}` | undefined;
  fundingAddress: `0x${string}` | undefined;
  withdrawAddress: `0x${string}` | undefined;
  hasExternalWallet: boolean;
  solanaAddress: string | undefined;
  externalWallets: ExternalWalletStub[];
  sendBatchTx: ReturnType<typeof vi.fn>;
  sendFundingTx: ReturnType<typeof vi.fn>;
  sendSolanaDeposit: ReturnType<typeof vi.fn>;
  sendSolanaSolDeposit: ReturnType<typeof vi.fn>;
  sendSolanaWithdraw: ReturnType<typeof vi.fn>;
  sendSolanaSolWithdraw: ReturnType<typeof vi.fn>;
  sendSolanaTransaction: ReturnType<typeof vi.fn>;
  signSolanaTransaction: ReturnType<typeof vi.fn>;
  isConnected: boolean;
  isReady: boolean;
  connectWallet: ReturnType<typeof vi.fn>;
  activateSmartWallet: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
};

const defaultWallet: WalletStub = {
  address: "0xSmartWallet" as `0x${string}`,
  fundingAddress: "0xFunding" as `0x${string}`,
  withdrawAddress: "0xFunding" as `0x${string}`,
  hasExternalWallet: true,
  solanaAddress: undefined,
  externalWallets: [baseExternalWallet],
  sendBatchTx: mockSendBatchTx,
  sendFundingTx: mockSendFundingTx,
  sendSolanaDeposit: vi.fn(),
  sendSolanaSolDeposit: vi.fn(),
  sendSolanaWithdraw: vi.fn(),
  sendSolanaSolWithdraw: vi.fn(),
  sendSolanaTransaction: vi.fn(),
  signSolanaTransaction: vi.fn(),
  isConnected: true,
  isReady: true,
  connectWallet: vi.fn(),
  activateSmartWallet: vi.fn(),
  disconnect: vi.fn(),
};

let walletOverrides: Partial<WalletStub> = {};

vi.mock("@/lib/preferences", () => ({
  useAppPreferences: () => ({ locale: "en" }),
}));

vi.mock("@/hooks/useWallet", () => ({
  useWallet: () => ({ ...defaultWallet, ...walletOverrides }),
}));

vi.mock("@/hooks/useB1naryAccount", () => ({
  useB1naryAccount: () => ({
    wallets: [],
  }),
}));

vi.mock("@/hooks/useBalances", () => ({
  useBalances: () => ({
    usd: 100,
    eth: 0.1,
    weth: 0,
    wbtc: 0,
    usdRaw: BigInt(100_000_000),
    ethRaw: BigInt(100_000_000_000_000_000),
    wethRaw: BigInt(0),
    wbtcRaw: BigInt(0),
    loading: false,
  }),
}));

vi.mock("@/hooks/useSolanaBalance", () => ({
  useSolanaBalance: () => ({
    solanaUsdc: 0,
    solanaSol: 0,
    solanaUsdcRaw: BigInt(0),
    solanaSolRaw: BigInt(0),
    solanaWsol: 0,
    solanaWsolRaw: BigInt(0),
    solanaTslax: 0,
    solanaTslaxRaw: BigInt(0),
    loading: false,
  }),
}));

vi.mock("@privy-io/react-auth", () => ({
  usePrivy: () => ({
    authenticated: true,
    user: { id: "privy-user-1" },
  }),
  useLogin: () => ({
    login: vi.fn(),
  }),
}));

vi.mock("@/lib/api", () => ({
  api: {
    bridgeAndTrade: vi.fn(),
    getBridgeStatus: vi.fn(),
    prepareSolanaCctpBurn: vi.fn(),
    submitSolanaCctpBurn: vi.fn(),
  },
}));

vi.mock("@/lib/cctp", () => ({
  buildEvmBurnCalls: vi.fn(() => []),
  solanaToBytes32: vi.fn(() => new Uint8Array(32)),
}));

vi.mock("@/lib/contracts", () => ({
  publicClient: { waitForTransactionReceipt: vi.fn() },
  ADDRESSES: {
    usdc: "0xUSDC",
    weth: "0xWETH",
    wbtc: "0xWBTC",
  },
  CHAIN: {
    id: 8453,
    blockExplorers: { default: { url: "https://basescan.org" } },
  },
  ERC20_ABI: [
    {
      name: "transfer",
      type: "function",
      inputs: [
        { name: "to", type: "address" },
        { name: "amount", type: "uint256" },
      ],
      outputs: [{ type: "bool" }],
    },
  ],
}));

vi.mock("@/lib/solana", () => ({
  SOLANA_NATIVE_RESERVE_LAMPORTS: BigInt(15_000_000),
  SOLANA_RPC_URL: undefined,
  SOLANA_USDC_MINT: undefined,
  SOLANA_TSLAX_MINT: undefined,
  SOLANA_CHAIN: undefined,
  solanaConnection: undefined,
  solanaTxUrl: (hash: string) => `https://solscan.io/tx/${hash}`,
  toPublicKey: vi.fn(),
}));

describe("DepositModal withdraw guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    walletOverrides = {};
  });

  it("shows connect prompt when no external wallet on withdraw tab", async () => {
    walletOverrides = {
      hasExternalWallet: false,
      withdrawAddress: undefined,
      externalWallets: [],
    };

    render(<DepositModal onClose={vi.fn()} />);

    const withdrawTab = screen.getByRole("button", { name: /withdraw/i });
    await userEvent.click(withdrawTab);

    expect(
      screen.getByRole("button", { name: /Connect Base wallet/i }),
    ).toBeInTheDocument();
  });

  it("shows destination address when external wallet is connected", async () => {
    render(<DepositModal onClose={vi.fn()} />);

    const withdrawTab = screen.getByRole("button", { name: /withdraw/i });
    await userEvent.click(withdrawTab);

    expect(screen.getByText("To")).toBeInTheDocument();
    expect(screen.getByText(/0xFund...ding/)).toBeInTheDocument();
  });

  it("does not call sendBatchTx when no external wallets", async () => {
    walletOverrides = {
      hasExternalWallet: false,
      withdrawAddress: undefined,
      externalWallets: [],
    };

    render(<DepositModal onClose={vi.fn()} />);

    const withdrawTab = screen.getByRole("button", { name: /withdraw/i });
    await userEvent.click(withdrawTab);

    expect(mockSendBatchTx).not.toHaveBeenCalled();
  });
});

describe("resolveSolanaUsdcWithdrawAmount", () => {
  it("uses the refreshed raw Solana USDC balance when CCTP mints less than requested", () => {
    expect(
      resolveSolanaUsdcWithdrawAmount(
        BigInt(23_682_947),
        BigInt(23_682_946),
      ),
    ).toBe(BigInt(23_682_946));
  });

  it("keeps the requested amount when the refreshed balance covers it", () => {
    expect(
      resolveSolanaUsdcWithdrawAmount(
        BigInt(10_000),
        BigInt(23_682_946),
      ),
    ).toBe(BigInt(10_000));
  });
});

describe("DepositModal Dynerox stage preview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    walletOverrides = {};
    process.env = {
      ...ORIGINAL_ENV,
      NEXT_PUBLIC_DEPLOYMENT_ENV: "testnet",
      NEXT_PUBLIC_DYNEROX_CHECKOUT_BASE_URL: "https://stage-app.dynerox.com",
      NEXT_PUBLIC_DYNEROX_TENANT_CODE: "tenbin",
    };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
  });

  it("keeps the existing crypto transfer flow as the default method", () => {
    render(<DepositModal onClose={vi.fn()} />);

    expect(screen.getByText("Transfer Crypto")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Token USDC/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Network Base/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Continue to Dynerox/i }),
    ).not.toBeInTheDocument();
  });

  it("executes the default crypto deposit with Dynerox configured", async () => {
    const smartWallet = "0x1111111111111111111111111111111111111111";
    const hash = `0x${"1".repeat(64)}`;
    const onComplete = vi.fn();
    walletOverrides = { address: smartWallet };
    mockSendFundingTx.mockResolvedValueOnce(hash);

    render(<DepositModal onClose={vi.fn()} onComplete={onComplete} />);

    await userEvent.type(screen.getByRole("textbox"), "1.25");
    await userEvent.click(screen.getByRole("button", { name: "Deposit USDC" }));

    await waitFor(() => expect(mockSendFundingTx).toHaveBeenCalledOnce());
    const [call, fundingWallet] = mockSendFundingTx.mock.calls[0];
    expect(call.to).toBe("0xUSDC");
    expect(fundingWallet).toBe("0xFunding");
    expect(
      decodeFunctionData({ abi: ERC20_TRANSFER_ABI, data: call.data }).args,
    ).toEqual([smartWallet, BigInt(1_250_000)]);
    expect(await screen.findByText("Deposit confirmed.")).toBeInTheDocument();
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("executes the default crypto withdrawal with Dynerox configured", async () => {
    const recipient = "0x2222222222222222222222222222222222222222";
    const hash = `0x${"2".repeat(64)}`;
    walletOverrides = {
      withdrawAddress: recipient,
      externalWallets: [{ ...baseExternalWallet, address: recipient }],
    };
    mockSendBatchTx.mockResolvedValueOnce(hash);

    render(<DepositModal onClose={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /Withdraw/i }));
    await userEvent.type(screen.getByRole("textbox"), "2.5");
    await userEvent.click(screen.getByRole("button", { name: "Withdraw USDC" }));

    await waitFor(() => expect(mockSendBatchTx).toHaveBeenCalledOnce());
    const [calls] = mockSendBatchTx.mock.calls[0];
    expect(calls).toHaveLength(1);
    expect(calls[0].to).toBe("0xUSDC");
    expect(
      decodeFunctionData({ abi: ERC20_TRANSFER_ABI, data: calls[0].data }).args,
    ).toEqual([recipient, BigInt(2_500_000)]);
    expect(await screen.findByText("Withdrawal confirmed.")).toBeInTheDocument();
  });

  it("does not allow switching to Dynerox during a pending crypto deposit", async () => {
    walletOverrides = {
      address: "0x1111111111111111111111111111111111111111",
    };
    mockSendFundingTx.mockImplementationOnce(() => new Promise(() => {}));
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<DepositModal onClose={vi.fn()} />);

    await userEvent.type(screen.getByRole("textbox"), "1");
    await userEvent.click(screen.getByRole("button", { name: "Deposit USDC" }));

    const bankMethod = screen.getByRole("button", { name: /Bank transfer \(MXN\)/i });
    expect(bankMethod).toBeDisabled();
    await userEvent.click(bankMethod);

    expect(screen.getByText("Transfer Crypto")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Continue to Dynerox/i }),
    ).not.toBeInTheDocument();
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("opens the on-ramp Checkout and hides crypto selectors", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<DepositModal onClose={vi.fn()} />);

    await userEvent.click(
      screen.getByRole("button", { name: /Bank transfer \(MXN\)/i }),
    );

    expect(screen.queryByRole("button", { name: /Token USDC/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Network Base/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Base is not enabled by Dynerox yet/i)).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: /Continue to Dynerox/i }),
    );

    expect(openSpy).toHaveBeenCalledWith(
      "https://stage-app.dynerox.com/c/tenbin?from_currency=MXN&from_network=SPEI&to_currency=USDC&to_network=ethereum",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("opens the off-ramp Checkout from Withdraw", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<DepositModal onClose={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /Withdraw/i }));
    await userEvent.click(
      screen.getByRole("button", { name: /Bank transfer \(MXN\)/i }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: /Continue to Dynerox/i }),
    );

    expect(openSpy).toHaveBeenCalledWith(
      "https://stage-app.dynerox.com/c/tenbin?from_currency=USDC&from_network=ethereum&to_currency=MXN&to_network=SPEI",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("stays hidden in mainnet even when public config is present", () => {
    process.env.NEXT_PUBLIC_DEPLOYMENT_ENV = "mainnet";
    render(<DepositModal onClose={vi.fn()} />);

    expect(
      screen.queryByRole("button", { name: /Bank transfer \(MXN\)/i }),
    ).not.toBeInTheDocument();
  });
});

describe("DepositModal Solana production gate", () => {
  const solanaWallet: ExternalWalletStub = {
    address: "SolWalletAddress11111111111111111111111111",
    chain: "solana",
    name: "Phantom",
    walletClientType: "phantom",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    walletOverrides = {};
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("hides the Solana network option in mainnet", () => {
    process.env.NEXT_PUBLIC_DEPLOYMENT_ENV = "mainnet";
    walletOverrides = {
      solanaAddress: "SolEmbeddedAddr1111111111111111111111111",
      externalWallets: [baseExternalWallet, solanaWallet],
    };

    render(<DepositModal onClose={vi.fn()} />);

    expect(
      screen.queryByRole("button", { name: /Network Solana/i }),
    ).not.toBeInTheDocument();
  });

  it("filters Solana external wallets from the selector in mainnet", () => {
    process.env.NEXT_PUBLIC_DEPLOYMENT_ENV = "mainnet";
    walletOverrides = {
      externalWallets: [baseExternalWallet, solanaWallet],
    };

    render(<DepositModal onClose={vi.fn()} />);

    expect(screen.getByText(/0xFund...ding/)).toBeInTheDocument();
    expect(screen.queryByText("Phantom")).not.toBeInTheDocument();
  });

  it("still allows selecting Solana in devnet", async () => {
    process.env.NEXT_PUBLIC_DEPLOYMENT_ENV = "devnet";
    walletOverrides = {
      solanaAddress: "SolEmbeddedAddr1111111111111111111111111",
      externalWallets: [baseExternalWallet, solanaWallet],
    };

    render(<DepositModal onClose={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /Network Base/i }));
    await userEvent.click(screen.getByRole("button", { name: /^Solana$/i }));

    expect(screen.getByText(/SolWal...1111/)).toBeInTheDocument();
    expect(screen.getByText(/Solana wallet/)).toBeInTheDocument();
  });

  it("shows wSOL only for Solana withdrawals", async () => {
    process.env.NEXT_PUBLIC_DEPLOYMENT_ENV = "devnet";
    walletOverrides = {
      solanaAddress: "SolEmbeddedAddr1111111111111111111111111",
      externalWallets: [baseExternalWallet, solanaWallet],
    };

    render(<DepositModal onClose={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /Network Base/i }));
    await userEvent.click(screen.getByRole("button", { name: /^Solana$/i }));
    await userEvent.click(screen.getByRole("button", { name: /Token USDC/i }));
    expect(screen.queryByText("wSOL")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /withdraw/i }));
    await userEvent.click(screen.getByRole("button", { name: /Token USDC/i }));
    expect(screen.getByText("wSOL")).toBeInTheDocument();
  });

  it("ignores requiredToken=tslax in mainnet and does not preselect Solana", () => {
    process.env.NEXT_PUBLIC_DEPLOYMENT_ENV = "mainnet";
    walletOverrides = {
      externalWallets: [baseExternalWallet],
    };

    render(<DepositModal onClose={vi.fn()} requiredToken="tslax" />);

    // The deposit UI falls back to the Base tab — we should see a Base
    // deposit note, not a Solana one.
    expect(
      screen.getByText(/Deposit on Base/i),
    ).toBeInTheDocument();
  });

  it("ignores requiredToken=sol in mainnet and falls back to Base", () => {
    process.env.NEXT_PUBLIC_DEPLOYMENT_ENV = "mainnet";
    walletOverrides = {
      externalWallets: [baseExternalWallet],
    };

    render(<DepositModal onClose={vi.fn()} requiredToken="sol" />);

    expect(
      screen.getByText(/Deposit on Base/i),
    ).toBeInTheDocument();
  });

  it("auto-selects the Base wallet when Solana wallets are filtered in mainnet", () => {
    process.env.NEXT_PUBLIC_DEPLOYMENT_ENV = "mainnet";
    walletOverrides = {
      externalWallets: [baseExternalWallet, solanaWallet],
    };

    render(<DepositModal onClose={vi.fn()} />);

    expect(screen.queryByText("Phantom")).not.toBeInTheDocument();
    expect(screen.getByText(/0xFund...ding/)).toBeInTheDocument();
    expect(screen.getByText(/Base wallet/)).toBeInTheDocument();
  });
});
