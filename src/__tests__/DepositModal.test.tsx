import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DepositModal } from "@/components/DepositModal";

const SMART_WALLET = "0x1111111111111111111111111111111111111111" as const;
const FUNDING_WALLET = "0x2222222222222222222222222222222222222222" as const;
const TX_HASH = `0x${"a".repeat(64)}` as `0x${string}`;

const {
  USDC_ADDRESS,
  WETH_ADDRESS,
  WBTC_ADDRESS,
  mockSendBatchTx,
  mockSendFundingTx,
  mockWaitForTransactionReceipt,
} = vi.hoisted(() => ({
  USDC_ADDRESS: "0x3333333333333333333333333333333333333333" as const,
  WETH_ADDRESS: "0x4444444444444444444444444444444444444444" as const,
  WBTC_ADDRESS: "0x5555555555555555555555555555555555555555" as const,
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

  it("renders Base as a fixed network and excludes Solana wallets and copy", () => {
    walletOverrides = {
      externalWallets: [baseExternalWallet, solanaWallet],
    };

    render(<DepositModal onClose={vi.fn()} />);

    expect(screen.getByLabelText("Network Base")).toHaveTextContent("Base");
    expect(screen.queryByText(/Solana/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Phantom")).not.toBeInTheDocument();
    expect(screen.getByText(/MetaMask · Base wallet/)).toBeInTheDocument();
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

    expect(
      screen.getByRole("button", { name: "Connect Base wallet" }),
    ).toBeInTheDocument();
    expect(mockSendBatchTx).not.toHaveBeenCalled();
  });
});
