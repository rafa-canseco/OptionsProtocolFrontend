import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConnectButton } from "@/components/ConnectButton";

const mockWallet = {
  address: "0xabc" as `0x${string}`,
  isConnected: true,
  isReady: true,
  connectWallet: vi.fn(),
  fundingAddress: undefined,
  chainError: null,
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
  usdFormatted: "0",
  ethFormatted: "0.00",
  loading: false,
  refetch: vi.fn(),
};

vi.mock("@/hooks/useWallet", () => ({
  useWallet: () => mockWallet,
}));

let balancesOverride = { ...zeroBalances };
vi.mock("@/hooks/useBalances", () => ({
  useBalances: () => balancesOverride,
}));

let ethSpotOverride: { spot: number | undefined; loading: boolean } = {
  spot: 2000,
  loading: false,
};
let btcSpotOverride: { spot: number | undefined; loading: boolean } = {
  spot: 60000,
  loading: false,
};
vi.mock("@/hooks/useSpot", () => ({
  useSpot: (asset: string) =>
    asset === "eth" ? ethSpotOverride : btcSpotOverride,
}));

vi.mock("@/components/DepositModal", () => ({
  DepositModal: () => <div data-testid="deposit-modal" />,
}));

describe("ConnectButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    balancesOverride = { ...zeroBalances };
    ethSpotOverride = { spot: 2000, loading: false };
    btcSpotOverride = { spot: 60000, loading: false };
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

  it("shows USDC-only total for USDC-only user", () => {
    balancesOverride = { ...zeroBalances, usd: 500 };
    render(<ConnectButton />);
    expect(screen.getByText("$500.00")).toBeInTheDocument();
  });

  it("sums USDC + ETH + WETH + WBTC in USD", () => {
    balancesOverride = {
      ...zeroBalances,
      usd: 1000,
      eth: 1,
      weth: 0.5,
      wbtc: 0.1,
    };
    // total = 1000 + (1 + 0.5) * 2000 + 0.1 * 60000 = 1000 + 3000 + 6000 = 10000
    render(<ConnectButton />);
    expect(screen.getByText("$10,000.00")).toBeInTheDocument();
  });

  it("shows ... while balances are loading", () => {
    balancesOverride = { ...zeroBalances, loading: true };
    render(<ConnectButton />);
    expect(screen.getByText("...")).toBeInTheDocument();
  });

  it("shows ... while spot prices are loading", () => {
    balancesOverride = { ...zeroBalances, usd: 100 };
    ethSpotOverride = { spot: undefined, loading: true };
    render(<ConnectButton />);
    expect(screen.getByText("...")).toBeInTheDocument();
  });

  it("falls back to USDC-only when spot is undefined", () => {
    balancesOverride = { ...zeroBalances, usd: 100, eth: 1 };
    ethSpotOverride = { spot: undefined, loading: false };
    render(<ConnectButton />);
    // ETH contributes $0 when spot is undefined
    expect(screen.getByText("$100.00")).toBeInTheDocument();
  });
});
