import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DepositModal } from "@/components/DepositModal";

const ORIGINAL_ENV = { ...process.env };

const mockSendBatchTx = vi.fn();
const mockSendFundingTx = vi.fn();

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

vi.mock("@/hooks/useWallet", () => ({
  useWallet: () => ({ ...defaultWallet, ...walletOverrides }),
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
