import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DepositModal } from "@/components/DepositModal";

const mockSendBatchTx = vi.fn();
const mockSendFundingTx = vi.fn();

const baseExternalWallet = {
  address: "0xFunding",
  chain: "base" as const,
  name: "MetaMask",
  walletClientType: "metamask",
};

const defaultWallet = {
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

let walletOverrides: Partial<typeof defaultWallet> = {};

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
  SOLANA_RPC_URL: undefined,
  SOLANA_USDC_MINT: undefined,
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

    // The wallet selector area should show "+ Connect another wallet"
    expect(
      screen.getByText(/\+ Connect another wallet/),
    ).toBeInTheDocument();
  });

  it("shows destination address when external wallet is connected", async () => {
    render(<DepositModal onClose={vi.fn()} />);

    const withdrawTab = screen.getByRole("button", { name: /withdraw/i });
    await userEvent.click(withdrawTab);

    // "Withdraw to" note with the truncated address and gas info
    expect(
      screen.getByText(/Withdraw to.*Gas is sponsored/),
    ).toBeInTheDocument();
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
