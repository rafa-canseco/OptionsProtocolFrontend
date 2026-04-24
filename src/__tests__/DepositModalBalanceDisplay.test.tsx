import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DepositModal } from "@/components/DepositModal";

const baseExternalWallet = {
  address: "0xFunding" as const,
  chain: "base" as const,
  name: "MetaMask",
  walletClientType: "metamask",
};

const solanaExternalWallet = {
  address: "SolExt11111111111111111111111111111111111111",
  chain: "solana" as const,
  name: "Phantom",
  walletClientType: "phantom",
};

const SMART_WALLET = "0xSmartWallet";
const EOA_WALLET = "0xFunding";
const SOL_TRADING = "SolTrading11111111111111111111111111111111";

let walletAddressOverride: string | undefined = SMART_WALLET;

vi.mock("@/hooks/useWallet", () => ({
  useWallet: () => ({
    address: walletAddressOverride,
    fundingAddress: EOA_WALLET,
    withdrawAddress: EOA_WALLET,
    hasExternalWallet: true,
    solanaAddress: SOL_TRADING,
    externalWallets: [baseExternalWallet, solanaExternalWallet],
    sendBatchTx: vi.fn(),
    sendFundingTx: vi.fn(),
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
  }),
}));

vi.mock("@/hooks/useBalances", () => ({
  useBalances: (address: string | undefined) => {
    if (address === SMART_WALLET) {
      return {
        usd: 1234, eth: 0.5, weth: 0, wbtc: 0.1,
        usdRaw: BigInt(1_234_000_000),
        ethRaw: BigInt(500_000_000_000_000_000),
        wethRaw: BigInt(0),
        wbtcRaw: BigInt(10_000_000),
        loading: false,
      };
    }
    if (address === EOA_WALLET) {
      return {
        usd: 50, eth: 2, weth: 0, wbtc: 0,
        usdRaw: BigInt(50_000_000),
        ethRaw: BigInt(2_000_000_000_000_000_000),
        wethRaw: BigInt(0),
        wbtcRaw: BigInt(0),
        loading: false,
      };
    }
    return {
      usd: 0, eth: 0, weth: 0, wbtc: 0,
      usdRaw: BigInt(0), ethRaw: BigInt(0),
      wethRaw: BigInt(0), wbtcRaw: BigInt(0),
      loading: false,
    };
  },
}));

vi.mock("@/hooks/useSolanaBalance", () => ({
  useSolanaBalance: (address: string | undefined) => {
    if (address === SOL_TRADING) {
      return {
        solanaUsdc: 500, solanaSol: 1.5,
        solanaUsdcRaw: BigInt(500_000_000),
        solanaSolRaw: BigInt(1_500_000_000),
        solanaWsol: 0, solanaWsolRaw: BigInt(0),
        solanaTslax: 10, solanaTslaxRaw: BigInt(1_000_000_000),
        loading: false,
      };
    }
    if (address === solanaExternalWallet.address) {
      return {
        solanaUsdc: 100, solanaSol: 3,
        solanaUsdcRaw: BigInt(100_000_000),
        solanaSolRaw: BigInt(3_000_000_000),
        solanaWsol: 0, solanaWsolRaw: BigInt(0),
        solanaTslax: 0, solanaTslaxRaw: BigInt(0),
        loading: false,
      };
    }
    return {
      solanaUsdc: 0, solanaSol: 0,
      solanaUsdcRaw: BigInt(0), solanaSolRaw: BigInt(0),
      solanaWsol: 0, solanaWsolRaw: BigInt(0),
      solanaTslax: 0, solanaTslaxRaw: BigInt(0),
      loading: false,
    };
  },
}));

vi.mock("@/lib/contracts", () => ({
  publicClient: { waitForTransactionReceipt: vi.fn() },
  ADDRESSES: { usdc: "0xUSDC", weth: "0xWETH", wbtc: "0xWBTC" },
  CHAIN: { id: 8453, blockExplorers: { default: { url: "https://basescan.org" } } },
  ERC20_ABI: [],
}));

vi.mock("@/lib/solana", () => ({
  SOLANA_RPC_URL: "https://api.devnet.solana.com",
  SOLANA_USDC_MINT: "4AxUuLpB1tnpyCSohZDf2tDq6xHab7H4gsenG4WTAKBD",
  SOLANA_TSLAX_MINT: "H3sTci14zw4uVRNetdALKjv5KKHEab9M3rAJQ4BfhHaF",
  SOLANA_CHAIN: "solana:devnet",
  solanaConnection: {},
  solanaTxUrl: (hash: string) => `https://solscan.io/tx/${hash}`,
  toPublicKey: vi.fn(),
}));

vi.mock("@/lib/marketState", () => ({
  isSolanaOffInProd: () => false,
}));

describe("DepositModal balance display — tester scenario", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    walletAddressOverride = SMART_WALLET;
  });

  it("withdraw tab initial: Base card shows $1,234.00 (smart wallet)", async () => {
    const user = userEvent.setup();
    render(<DepositModal onClose={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /^withdraw$/i }));
    expect(screen.getByText("$1,234.00")).toBeInTheDocument();
  });

  it("withdraw + select Solana wallet first: Base card STILL shows $1,234.00", async () => {
    const user = userEvent.setup();
    render(<DepositModal onClose={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /^withdraw$/i }));

    // Select Phantom (solana) "abajo primero"
    const phantomBtn = screen.getByText("Phantom").closest("button")!;
    await user.click(phantomBtn);

    // Base card still shows $1,234.00 (smartBalances unaffected)
    expect(screen.getByText("$1,234.00")).toBeInTheDocument();
    // Solana card default token is "sol" → shows 1.5 SOL from trading account
    expect(screen.getByText(/1\.50 SOL/)).toBeInTheDocument();
  });

  it("withdraw + select Solana wallet: amount input Balance shows $500 (solana trading)", async () => {
    const user = userEvent.setup();
    render(<DepositModal onClose={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /^withdraw$/i }));
    const phantomBtn = screen.getByText("Phantom").closest("button")!;
    await user.click(phantomBtn);

    // Amount input Balance line reflects solBalance (Solana trading account)
    // Default token "usdc" for solana → $500
    expect(screen.getByText(/^Balance \$500\.00$/)).toBeInTheDocument();
  });

  it("withdraw + change token in amount input (abajo) then check Base card", async () => {
    const user = userEvent.setup();
    render(<DepositModal onClose={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /^withdraw$/i }));

    // Amount input Balance initially shows USDC from smart wallet = $1,234.00
    expect(screen.getByText(/^Balance \$1,234\.00$/)).toBeInTheDocument();
    // Base card also $1,234.00
    expect(screen.getAllByText("$1,234.00").length).toBeGreaterThanOrEqual(1);
  });

  it("FIX: smart wallet inactive + Solana wallet → Base card shows — (not $0.00)", async () => {
    walletAddressOverride = undefined;
    const user = userEvent.setup();
    render(<DepositModal onClose={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /^withdraw$/i }));

    const phantomBtn = screen.getByText("Phantom").closest("button")!;
    await user.click(phantomBtn);

    // Base card should NOT show $0.00 — it should show — (em dash) since
    // the smart wallet is not activated yet. This prevents the confusing
    // display where 0.00 looks like a real balance.
    expect(screen.queryByText("$0.00")).not.toBeInTheDocument();
    expect(screen.getByText("Activation needed")).toBeInTheDocument();
  });
});
