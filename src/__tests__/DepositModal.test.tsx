import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { decodeFunctionData } from "viem";
import { DepositModal } from "@/components/DepositModal";

const SMART_WALLET = "0x1111111111111111111111111111111111111111" as const;
const FUNDING_WALLET = "0x2222222222222222222222222222222222222222" as const;
const TX_HASH = `0x${"a".repeat(64)}` as `0x${string}`;
const ORIGINAL_ENV = { ...process.env };

const {
  USDC_ADDRESS,
  WETH_ADDRESS,
  WBTC_ADDRESS,
  TRANSFER_ABI,
  mockSendBatchTx,
  mockSendFundingTx,
  mockWaitForTransactionReceipt,
} = vi.hoisted(() => ({
  USDC_ADDRESS: "0x3333333333333333333333333333333333333333" as const,
  WETH_ADDRESS: "0x4444444444444444444444444444444444444444" as const,
  WBTC_ADDRESS: "0x5555555555555555555555555555555555555555" as const,
  TRANSFER_ABI: [
    {
      name: "transfer",
      type: "function",
      inputs: [
        { name: "to", type: "address" },
        { name: "amount", type: "uint256" },
      ],
      outputs: [{ type: "bool" }],
    },
  ] as const,
  mockSendBatchTx: vi.fn(),
  mockSendFundingTx: vi.fn(),
  mockWaitForTransactionReceipt: vi.fn(),
}));

interface ExternalWalletStub {
  address: string;
  chain: "base" | "solana";
  name: string;
  walletClientType: string;
}

const baseExternalWallet: ExternalWalletStub = {
  address: FUNDING_WALLET,
  chain: "base",
  name: "MetaMask",
  walletClientType: "metamask",
};

interface WalletStub {
  address: `0x${string}` | undefined;
  fundingAddress: `0x${string}` | undefined;
  externalWallets: ExternalWalletStub[];
  sendBatchTx: ReturnType<typeof vi.fn>;
  sendFundingTx: ReturnType<typeof vi.fn>;
  activateSmartWallet: ReturnType<typeof vi.fn>;
  connectFundingWallet: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}

const defaultWallet: WalletStub = {
  address: SMART_WALLET,
  fundingAddress: FUNDING_WALLET,
  externalWallets: [baseExternalWallet],
  sendBatchTx: mockSendBatchTx,
  sendFundingTx: mockSendFundingTx,
  activateSmartWallet: vi.fn(),
  connectFundingWallet: vi.fn(),
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
  useB1naryAccount: () => ({ wallets: [] }),
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

vi.mock("@privy-io/react-auth", () => ({
  usePrivy: () => ({ authenticated: true }),
  useLogin: () => ({ login: vi.fn() }),
}));

vi.mock("@/lib/contracts", () => ({
  publicClient: { waitForTransactionReceipt: mockWaitForTransactionReceipt },
  ADDRESSES: {
    usdc: USDC_ADDRESS,
    weth: WETH_ADDRESS,
    wbtc: WBTC_ADDRESS,
  },
  CHAIN: {
    id: 8453,
    blockExplorers: { default: { url: "https://basescan.org" } },
  },
  ERC20_ABI: TRANSFER_ABI,
}));

vi.mock("@/lib/dataInvalidation", () => ({
  invalidateData: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  walletOverrides = {};
  mockSendFundingTx.mockResolvedValue(TX_HASH);
  mockSendBatchTx.mockResolvedValue(TX_HASH);
  mockWaitForTransactionReceipt.mockResolvedValue({ status: "success" });
});

describe("DepositModal Base-only network", () => {
  const solanaWallet: ExternalWalletStub = {
    address: "SolWalletAddress11111111111111111111111111",
    chain: "solana",
    name: "Phantom",
    walletClientType: "phantom",
  };

  it("provides a named focus-managed dialog, labelled amount, and Escape dismissal", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<DepositModal onClose={onClose} />);

    expect(screen.getByRole("dialog", { name: "Deposit funds" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Deposit amount in USDC" })).toBeInTheDocument();
    const close = screen.getByRole("button", { name: "Close funds dialog" });
    await waitFor(() => expect(close).toHaveFocus());

    await user.keyboard("{Escape}");
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });

  it("omits redundant network and multi-wallet selectors while excluding Solana", () => {
    walletOverrides = {
      externalWallets: [baseExternalWallet, solanaWallet],
    };

    render(<DepositModal onClose={vi.fn()} />);

    expect(screen.queryByLabelText("Network Base")).not.toBeInTheDocument();
    expect(screen.queryByText(/^Network$|^Red$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Solana/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Phantom")).not.toBeInTheDocument();
    expect(screen.getByText("Source wallet")).toBeInTheDocument();
    expect(screen.getByText("MetaMask")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("only lists Base assets", async () => {
    render(<DepositModal onClose={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: "Token USDC" }));

    expect(screen.getByText("ETH")).toBeInTheDocument();
    expect(screen.getByText("WETH")).toBeInTheDocument();
    expect(screen.getByText("cbBTC")).toBeInTheDocument();
    expect(screen.queryByText(/^SOL$/)).not.toBeInTheDocument();
    expect(screen.queryByText("wSOL")).not.toBeInTheDocument();
    expect(screen.queryByText("TSLAx")).not.toBeInTheDocument();
  });

  it("falls back to USDC when a legacy non-Base token is requested", () => {
    render(<DepositModal onClose={vi.fn()} requiredToken="sol" />);

    expect(screen.getByRole("button", { name: "Token USDC" })).toBeInTheDocument();
    expect(screen.getByText("Deposit on Base")).toBeInTheDocument();
    expect(screen.queryByText(/Solana/i)).not.toBeInTheDocument();
  });
});

describe("DepositModal Dynerox stage preview", () => {
  beforeEach(() => {
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

  it("keeps the simplified Base crypto transfer flow as the default", () => {
    render(<DepositModal onClose={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Crypto" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText("Transfer Crypto")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Token USDC" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Network Base")).not.toBeInTheDocument();
    expect(screen.getByText("Source wallet")).toBeInTheDocument();
    expect(screen.getByText("MetaMask")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Open demo/i }),
    ).not.toBeInTheDocument();
  });

  it("presents concise MXN onboarding before opening the exact on-ramp", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<DepositModal onClose={vi.fn()} />);

    await userEvent.click(
      screen.getByRole("button", { name: /Onboard with MXN/i }),
    );

    expect(screen.getByRole("button", { name: /Onboard with MXN/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText("Fund with pesos")).toBeInTheDocument();
    expect(screen.getByText("Deposit through SPEI and receive USDC.")).toBeInTheDocument();
    expect(screen.getByText("Temporary demo on Ethereum.")).toBeInTheDocument();
    expect(screen.queryByText(/Privy/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/wallet/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Token USDC" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Network Base")).not.toBeInTheDocument();
    expect(screen.queryByText("MetaMask")).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: /Open demo/i }),
    );

    expect(openSpy).toHaveBeenCalledWith(
      "https://stage-app.dynerox.com/c/tenbin?from_currency=MXN&from_network=SPEI&to_currency=USDC&to_network=ethereum",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("opens the exact off-ramp Checkout from Withdraw", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<DepositModal onClose={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /Withdraw/i }));
    expect(screen.getByRole("button", { name: "To wallet" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /To MXN/i }),
    );
    expect(screen.getByText("Withdraw to MXN")).toBeInTheDocument();
    expect(screen.getByText("Send USDC and receive MXN through SPEI.")).toBeInTheDocument();
    expect(screen.getByText("Temporary demo on Ethereum.")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: /Open demo/i }),
    );

    expect(openSpy).toHaveBeenCalledWith(
      "https://stage-app.dynerox.com/c/tenbin?from_currency=USDC&from_network=ethereum&to_currency=MXN&to_network=SPEI",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("does not allow method changes or Checkout launch during a crypto transfer", async () => {
    mockSendFundingTx.mockImplementationOnce(() => new Promise(() => {}));
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<DepositModal onClose={vi.fn()} />);

    await userEvent.type(screen.getByRole("textbox"), "1");
    await userEvent.click(screen.getByRole("button", { name: "Deposit USDC" }));

    const bankMethod = screen.getByRole("button", {
      name: /Onboard with MXN/i,
    });
    await waitFor(() => expect(bankMethod).toBeDisabled());
    await userEvent.click(bankMethod);

    expect(screen.getByText("Transfer Crypto")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Open demo/i }),
    ).not.toBeInTheDocument();
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("hides MXN onboarding when preview configuration is incomplete", () => {
    delete process.env.NEXT_PUBLIC_DYNEROX_TENANT_CODE;

    render(<DepositModal onClose={vi.fn()} />);

    expect(
      screen.queryByRole("button", { name: /Onboard with MXN/i }),
    ).not.toBeInTheDocument();
  });

  it("hides MXN onboarding in mainnet even when public config is present", () => {
    process.env.NEXT_PUBLIC_DEPLOYMENT_ENV = "mainnet";

    render(<DepositModal onClose={vi.fn()} />);

    expect(
      screen.queryByRole("button", { name: /Onboard with MXN/i }),
    ).not.toBeInTheDocument();
  });
});

describe("DepositModal Base transfers", () => {
  it("submits a Base USDC deposit from the selected external wallet", async () => {
    render(<DepositModal onClose={vi.fn()} />);

    await userEvent.type(screen.getByRole("textbox"), "1");
    await userEvent.click(screen.getByRole("button", { name: "Deposit USDC" }));

    await waitFor(() => expect(mockSendFundingTx).toHaveBeenCalledTimes(1));
    expect(mockSendFundingTx).toHaveBeenCalledWith(
      expect.objectContaining({ to: USDC_ADDRESS }),
      FUNDING_WALLET,
    );
    expect(mockWaitForTransactionReceipt).toHaveBeenCalledWith({ hash: TX_HASH });
  });

  it("lets the user choose a linked destination wallet without restoring the heavy selector", async () => {
    const secondWallet = {
      address: "0x6666666666666666666666666666666666666666",
      chain: "base" as const,
      name: "Coinbase",
      walletClientType: "coinbase_wallet",
    };
    walletOverrides = {
      externalWallets: [baseExternalWallet, secondWallet],
    };

    render(<DepositModal onClose={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /withdraw/i }));

    expect(screen.getByText("Destination wallet")).toBeInTheDocument();
    const destination = screen.getByRole("combobox", {
      name: "Select withdrawal wallet",
    });
    expect(destination).toHaveValue(FUNDING_WALLET);

    await userEvent.selectOptions(destination, secondWallet.address);

    expect(destination).toHaveValue(secondWallet.address);
    expect(screen.getByText("Coinbase")).toBeInTheDocument();
    expect(screen.getByText("0x6666...6666")).toBeInTheDocument();

    await userEvent.type(screen.getByRole("textbox"), "1");
    await userEvent.click(screen.getByRole("button", { name: "Withdraw USDC" }));

    await waitFor(() => expect(mockSendBatchTx).toHaveBeenCalledTimes(1));
    const [calls] = mockSendBatchTx.mock.calls[0];
    expect(
      decodeFunctionData({ abi: TRANSFER_ABI, data: calls[0].data }).args,
    ).toEqual([secondWallet.address, BigInt(1_000_000)]);
  });

  it("keeps the canonical deposit source isolated from withdrawal selection", async () => {
    const secondWallet = {
      address: "0x6666666666666666666666666666666666666666",
      chain: "base" as const,
      name: "Coinbase",
      walletClientType: "coinbase_wallet",
    };
    walletOverrides = {
      externalWallets: [baseExternalWallet, secondWallet],
    };

    render(<DepositModal onClose={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /withdraw/i }));
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Select withdrawal wallet" }),
      secondWallet.address,
    );
    await userEvent.click(screen.getByRole("button", { name: /deposit/i }));

    expect(screen.getByText("Source wallet")).toBeInTheDocument();
    expect(screen.getByText("MetaMask")).toBeInTheDocument();
    expect(screen.getByText("0x2222...2222")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("submits a Base USDC withdrawal to the selected external wallet", async () => {
    render(<DepositModal onClose={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /withdraw/i }));
    await userEvent.type(screen.getByRole("textbox"), "1");
    await userEvent.click(screen.getByRole("button", { name: "Withdraw USDC" }));

    await waitFor(() => expect(mockSendBatchTx).toHaveBeenCalledTimes(1));
    expect(mockSendBatchTx).toHaveBeenCalledWith([
      expect.objectContaining({ to: USDC_ADDRESS }),
    ]);
    expect(mockWaitForTransactionReceipt).toHaveBeenCalledWith({ hash: TX_HASH });
  });

  it("shows a Base connect prompt and does not submit when no external wallet exists", async () => {
    walletOverrides = {
      fundingAddress: undefined,
      externalWallets: [],
    };

    render(<DepositModal onClose={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /withdraw/i }));

    const connectButton = screen.getByRole("button", {
      name: "Connect Base wallet",
    });
    expect(connectButton).toBeInTheDocument();

    await userEvent.click(connectButton);

    expect(defaultWallet.connectFundingWallet).toHaveBeenCalledTimes(1);
    expect(mockSendBatchTx).not.toHaveBeenCalled();
  });
});
