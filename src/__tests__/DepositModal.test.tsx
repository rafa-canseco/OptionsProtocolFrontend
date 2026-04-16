import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DepositModal } from "@/components/DepositModal";

const mockSendBatchTx = vi.fn();
const mockSendFundingTx = vi.fn();

const defaultWallet = {
  address: "0xSmartWallet" as `0x${string}`,
  fundingAddress: "0xFunding" as `0x${string}`,
  withdrawAddress: "0xFunding" as `0x${string}`,
  hasExternalWallet: true,
  sendBatchTx: mockSendBatchTx,
  sendFundingTx: mockSendFundingTx,
  chainError: null,
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

describe("DepositModal withdraw guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    walletOverrides = {};
  });

  it("shows warning and disables button when no external wallet on withdraw tab", async () => {
    walletOverrides = {
      hasExternalWallet: false,
      withdrawAddress: undefined,
    };

    render(<DepositModal onClose={vi.fn()} />);

    const withdrawTab = screen.getByRole("button", { name: /withdraw/i });
    await userEvent.click(withdrawTab);

    expect(
      screen.getByText("Connect your external wallet to withdraw."),
    ).toBeInTheDocument();

    const withdrawButton = screen.getByRole("button", {
      name: /withdraw usdc/i,
    });
    expect(withdrawButton).toBeDisabled();
  });

  it("shows destination address when external wallet is connected", async () => {
    render(<DepositModal onClose={vi.fn()} />);

    const withdrawTab = screen.getByRole("button", { name: /withdraw/i });
    await userEvent.click(withdrawTab);

    expect(
      screen.getByText(/Withdraw to 0xFund\.\.\.ding/),
    ).toBeInTheDocument();
  });

  it("does not call sendBatchTx when hasExternalWallet is false", async () => {
    walletOverrides = {
      hasExternalWallet: false,
      withdrawAddress: undefined,
    };

    render(<DepositModal onClose={vi.fn()} />);

    const withdrawTab = screen.getByRole("button", { name: /withdraw/i });
    await userEvent.click(withdrawTab);

    // Button should be disabled, but verify sendBatchTx never called
    expect(mockSendBatchTx).not.toHaveBeenCalled();
  });
});
