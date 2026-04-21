import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConnectButton } from "@/components/ConnectButton";

const mockWallet = {
  address: "0xabc" as `0x${string}`,
  solanaAddress: undefined as string | undefined,
  isConnected: true,
  isReady: true,
  connectWallet: vi.fn(),
};

const zeroBalances = {
  usdRaw: BigInt(0),
  ethRaw: BigInt(0),
  wethRaw: BigInt(0),
  wbtcRaw: BigInt(0),
  usd: 0,
  eth: 0,
  weth: 0,
  wbtc: 0,
  loading: false,
};

const zeroSolBalance = {
  solanaUsdc: 0,
  solanaSol: 0,
  solanaUsdcRaw: BigInt(0),
  solanaSolRaw: BigInt(0),
  solanaWsol: 0,
  solanaWsolRaw: BigInt(0),
  solanaTslax: 0,
  solanaTslaxRaw: BigInt(0),
  loading: false,
};

vi.mock("@/hooks/useWallet", () => ({
  useWallet: () => mockWallet,
}));

let balancesOverride = { ...zeroBalances };
vi.mock("@/hooks/useBalances", () => ({
  useBalances: () => balancesOverride,
}));

let solBalanceOverride = { ...zeroSolBalance };
vi.mock("@/hooks/useSolanaBalance", () => ({
  useSolanaBalance: () => solBalanceOverride,
}));

vi.mock("@/components/DepositModal", () => ({
  DepositModal: () => <div data-testid="deposit-modal" />,
}));

describe("ConnectButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    balancesOverride = { ...zeroBalances };
    solBalanceOverride = { ...zeroSolBalance };
    mockWallet.isConnected = true;
    mockWallet.isReady = true;
  });

  it("shows Connect when not connected", () => {
    mockWallet.isConnected = false;
    render(<ConnectButton />);
    expect(screen.getByText("Connect")).toBeInTheDocument();
  });

  it("shows loading skeleton when not ready", () => {
    mockWallet.isReady = false;
    render(<ConnectButton />);
    expect(screen.queryByText("Connect")).not.toBeInTheDocument();
    expect(screen.queryByText("Deposit")).not.toBeInTheDocument();
  });

  it("shows Deposit when all balances are zero", () => {
    render(<ConnectButton />);
    expect(screen.getByText("Deposit")).toBeInTheDocument();
  });

  it("shows USDC total from Base", () => {
    balancesOverride = { ...zeroBalances, usd: 500 };
    render(<ConnectButton />);
    expect(screen.getByText("$500.00")).toBeInTheDocument();
  });

  it("sums Base USDC + Solana USDC", () => {
    balancesOverride = { ...zeroBalances, usd: 1000 };
    solBalanceOverride = { ...zeroSolBalance, solanaUsdc: 500 };
    render(<ConnectButton />);
    expect(screen.getByText("$1,500.00")).toBeInTheDocument();
  });

  it("shows ... while balances are loading", () => {
    balancesOverride = { ...zeroBalances, loading: true };
    render(<ConnectButton />);
    expect(screen.getByText("...")).toBeInTheDocument();
  });

  it("shows ... while Solana balances are loading", () => {
    balancesOverride = { ...zeroBalances, usd: 100 };
    solBalanceOverride = { ...zeroSolBalance, loading: true };
    render(<ConnectButton />);
    expect(screen.getByText("...")).toBeInTheDocument();
  });

  it("shows balance from Solana only", () => {
    solBalanceOverride = { ...zeroSolBalance, solanaUsdc: 250 };
    render(<ConnectButton />);
    expect(screen.getByText("$250.00")).toBeInTheDocument();
  });
});
