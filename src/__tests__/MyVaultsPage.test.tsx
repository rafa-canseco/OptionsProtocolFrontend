import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MyVaultsPage } from "@/components/vaults/MyVaultsPage";

const mocks = vi.hoisted(() => ({
  useWallet: vi.fn(),
  useBalances: vi.fn(),
  useCspVault: vi.fn(),
}));

vi.mock("@/hooks/useWallet", () => ({ useWallet: mocks.useWallet }));
vi.mock("@/hooks/useBalances", () => ({ useBalances: mocks.useBalances }));
vi.mock("@/hooks/useCspVault", () => ({ useCspVault: mocks.useCspVault }));
vi.mock("@/components/vaults/VaultHeader", () => ({
  VaultHeader: () => <nav>Vaults My Vaults</nav>,
}));
vi.mock("@/components/vaults/VaultIcon", () => ({
  VaultIcon: () => <div aria-hidden="true" />,
}));
vi.mock("@/components/vaults/VaultDialog", () => ({
  VaultDialog: ({ open, initialAction }: { open: boolean; initialAction?: string }) => (
    <div data-testid="vault-dialog" data-open={String(open)} data-initial-action={initialAction} />
  ),
}));
vi.mock("@/lib/contracts", () => ({
  CHAIN: { id: 84532 },
  ADDRESSES: {
    usdc: "0x2222222222222222222222222222222222222222",
    weth: "0x3333333333333333333333333333333333333333",
  },
  ERC20_ABI: [],
}));

const ADDRESS = "0x4444444444444444444444444444444444444444";

function action(available: boolean) {
  return { available, reason: available ? null : "UNAVAILABLE", mode: null };
}

function snapshot({ stale = false, empty = false }: { stale?: boolean; empty?: boolean } = {}) {
  const vault = {
    vaultKey: "base-sepolia:eth-usdc-csp",
    chainId: 84532,
    vaultAddress: "0x1111111111111111111111111111111111111111",
    assets: {
      deposit: { symbol: "USDC", address: "0x2222222222222222222222222222222222222222", decimals: 6 },
      assigned: { symbol: "WETH", address: "0x3333333333333333333333333333333333333333", decimals: 18 },
    },
    status: "active",
    summary: {
      totalManagedAssets: "100000000",
      totalShares: "100000000",
      sharePriceAssets: "1000000",
      availableIdleAssets: "0",
      activeCollateral: "100000000",
      activeBatchCount: 1,
      utilizationBps: 10000,
      pendingDepositAssets: "0",
      pendingWithdrawalShares: "0",
      accountedUnderlyingAssets: "0",
    },
    currentCycle: {
      epochId: 1,
      status: "active",
      startedAt: 1,
      endedAt: null,
      premiumEarned: "0",
      performanceFee: "0",
      assignmentShortfall: "0",
      closed: false,
      batchesTruncated: false,
      batches: [],
    },
    asOfBlock: 100,
    indexedAt: "2026-07-15T00:00:00Z",
    finality: "head",
    stale,
  };
  const user = {
    vaultKey: vault.vaultKey,
    chainId: 84532,
    vaultAddress: vault.vaultAddress,
    address: ADDRESS,
    position: {
      activeShares: empty ? "0" : "100000000",
      activeAssets: empty ? "0" : "125000000",
      pendingDepositAssets: "0",
      withdrawal: {
        epochId: null,
        shares: "0",
        claimable: false,
        usdcAssets: "0",
        wethAssets: "0",
      },
      claimableAssignedWeth: "0",
    },
    actions: {
      deposit: action(true),
      cancelPendingDeposit: action(false),
      withdrawIdle: action(false),
      requestWithdraw: action(true),
      claimWithdraw: action(false),
      claimAssignedWeth: action(false),
    },
    asOfBlock: 100,
    indexedAt: "2026-07-15T00:00:00Z",
    finality: "head",
    stale,
  };
  return { vault, user, loading: false, error: null, refetch: vi.fn() };
}

describe("MyVaultsPage", () => {
  beforeEach(() => {
    mocks.useWallet.mockReturnValue({ address: ADDRESS });
    mocks.useBalances.mockReturnValue({ usd: 25, usdRaw: BigInt(25_000_000) });
    mocks.useCspVault.mockReturnValue(snapshot());
  });

  it("shows active USDC and shares separately and opens VaultDialog in context", async () => {
    const user = userEvent.setup();
    render(<MyVaultsPage />);

    expect(screen.getByText("$125.00 USDC")).toBeInTheDocument();
    expect(screen.getByText("100.00")).toBeInTheDocument();
    expect(screen.queryByText(/APY|earnings|PnL/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /request withdrawal/i }));
    expect(screen.getByTestId("vault-dialog")).toHaveAttribute("data-open", "true");
    expect(screen.getByTestId("vault-dialog")).toHaveAttribute("data-initial-action", "withdraw");
  });

  it("keeps stale balances visible while disabling the primary action", () => {
    mocks.useCspVault.mockReturnValue(snapshot({ stale: true }));
    render(<MyVaultsPage />);

    expect(screen.getByText("$125.00 USDC")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /request withdrawal/i })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(/out of date/i);
  });

  it("hides a vault with no shares, pending balances, or claimables", () => {
    mocks.useCspVault.mockReturnValue(snapshot({ empty: true }));
    render(<MyVaultsPage />);

    expect(screen.queryByRole("heading", { name: "USDC CSP" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /explore vaults/i })).toHaveAttribute("href", "/vaults");
  });

  it("preserves the page structure for loading and error states", () => {
    mocks.useCspVault.mockReturnValue({
      vault: null,
      user: null,
      loading: true,
      error: null,
      refetch: vi.fn(),
    });
    const { rerender } = render(<MyVaultsPage />);
    expect(screen.getByLabelText("Loading vault positions")).toBeInTheDocument();

    mocks.useCspVault.mockReturnValue({
      vault: null,
      user: null,
      loading: false,
      error: "Could not load vault data.",
      refetch: vi.fn(),
    });
    rerender(<MyVaultsPage />);
    expect(screen.getByRole("heading", { name: "Position unavailable" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
