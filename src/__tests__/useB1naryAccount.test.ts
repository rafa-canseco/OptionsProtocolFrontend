import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const state = vi.hoisted(() => ({
  privy: {
    authenticated: true,
    ready: true,
    user: {
      id: "privy-user-1",
      smartWallet: { address: "0xSmartWallet" } as { address: string } | undefined,
      linkedAccounts: [],
    },
  },
  evmWallets: [
    { walletClientType: "privy", address: "0xEmbeddedEvm" },
    { walletClientType: "rabby", address: "0xExternalEvm" },
  ],
  solanaWallets: [
    { address: "SolanaEmbedded", standardWallet: { name: "Privy", isPrivyWallet: true } },
    { address: "SolanaExternal", standardWallet: { name: "Phantom" } },
  ],
  smartWalletClientAddress: "0xSmartWallet" as string | null,
  api: {
    getB1naryAccount: vi.fn(),
    getB1naryAccountByWallet: vi.fn(),
    createB1naryAccount: vi.fn(),
    addTrustedB1naryMember: vi.fn(),
    linkTrustedB1naryWallet: vi.fn(),
  },
}));

vi.mock("@privy-io/react-auth", () => ({
  usePrivy: () => state.privy,
  useWallets: () => ({ wallets: state.evmWallets }),
}));

vi.mock("@privy-io/react-auth/smart-wallets", () => ({
  useSmartWallets: () => ({
    client: state.smartWalletClientAddress
      ? { account: { address: state.smartWalletClientAddress } }
      : undefined,
  }),
}));

vi.mock("@privy-io/react-auth/solana", () => ({
  useWallets: () => ({ wallets: state.solanaWallets }),
}));

vi.mock("@/lib/api", () => ({
  api: state.api,
}));

describe("useB1naryAccount", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    state.privy.user.smartWallet = { address: "0xSmartWallet" };
    state.smartWalletClientAddress = "0xSmartWallet";
    state.evmWallets = [
      { walletClientType: "privy", address: "0xEmbeddedEvm" },
      { walletClientType: "rabby", address: "0xExternalEvm" },
    ];
    state.solanaWallets = [
      { address: "SolanaEmbedded", standardWallet: { name: "Privy", isPrivyWallet: true } },
      { address: "SolanaExternal", standardWallet: { name: "Phantom" } },
    ];
    state.api.getB1naryAccount.mockResolvedValue({
      account: { id: "account-1", username: "rafa" },
      members: [],
      wallets: [],
    });
    state.api.getB1naryAccountByWallet.mockResolvedValue({
      account: null,
      members: [],
      wallets: [],
    });
    state.api.addTrustedB1naryMember.mockImplementation(
      async (accountId: string, privyUserId: string) => ({
        account: { id: accountId, username: "rafa" },
        members: [
          {
            account_id: accountId,
            privy_user_id: privyUserId,
            role: "owner",
            verified_at: "2026-05-06T00:00:00Z",
            created_at: "2026-05-06T00:00:00Z",
          },
        ],
        wallets: [],
      }),
    );
    state.api.linkTrustedB1naryWallet.mockImplementation(
      async (_accountId: string, params: { address: string }) => ({
        wallet: {
          id: `${params.address}-wallet`,
          account_id: "account-1",
          chain: params.address.startsWith("0x") ? "base" : "solana",
          address: params.address,
          address_normalized: params.address.startsWith("0x")
            ? params.address.toLowerCase()
            : params.address,
          wallet_type: "embedded",
          role: "trading",
          verified_at: "2026-05-06T00:00:00Z",
        },
      }),
    );
  });

  it("syncs only Privy trusted trading wallets without linking external wallets", async () => {
    const { useB1naryAccount } = await import("@/hooks/useB1naryAccount");
    renderHook(() => useB1naryAccount());

    await waitFor(() => {
      expect(state.api.linkTrustedB1naryWallet).toHaveBeenCalledTimes(3);
    });

    expect(state.api.linkTrustedB1naryWallet).toHaveBeenCalledWith(
      "account-1",
      expect.objectContaining({
        address: "0xSmartWallet",
        walletType: "smart",
        role: "trading",
      }),
    );
    expect(state.api.linkTrustedB1naryWallet).toHaveBeenCalledWith(
      "account-1",
      expect.objectContaining({
        address: "0xEmbeddedEvm",
        walletType: "embedded",
      }),
    );
    expect(state.api.linkTrustedB1naryWallet).toHaveBeenCalledWith(
      "account-1",
      expect.objectContaining({
        address: "SolanaEmbedded",
        walletType: "embedded",
      }),
    );
    expect(state.api.linkTrustedB1naryWallet).not.toHaveBeenCalledWith(
      "account-1",
      expect.objectContaining({ address: "0xExternalEvm" }),
    );
    expect(state.api.linkTrustedB1naryWallet).not.toHaveBeenCalledWith(
      "account-1",
      expect.objectContaining({ address: "SolanaExternal" }),
    );
  });

  it("does not request onboarding before a trusted trading wallet exists", async () => {
    state.api.getB1naryAccount.mockResolvedValue({
      account: null,
      members: [],
      wallets: [],
    });
    state.privy.user.smartWallet = undefined;
    state.smartWalletClientAddress = null;
    state.evmWallets = [
      { walletClientType: "rabby", address: "0xExternalEvm" },
    ];
    state.solanaWallets = [
      { address: "SolanaExternal", standardWallet: { name: "Phantom" } },
    ];

    const { useB1naryAccount } = await import("@/hooks/useB1naryAccount");
    const { result } = renderHook(() => useB1naryAccount());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.trustedWalletCandidates).toHaveLength(0);
    expect(result.current.needsOnboarding).toBe(false);
  });

  it("recognizes an existing b1nary account from a connected wallet before onboarding", async () => {
    state.api.getB1naryAccount.mockResolvedValue({
      account: null,
      members: [],
      wallets: [],
    });
    state.privy.user.smartWallet = undefined;
    state.smartWalletClientAddress = null;
    state.evmWallets = [
      { walletClientType: "rabby", address: "0xExternalEvm" },
    ];
    state.solanaWallets = [
      { address: "SolanaExternal", standardWallet: { name: "Phantom" } },
    ];
    state.api.getB1naryAccountByWallet.mockImplementation(
      async (_chain: string, address: string) => {
        if (address !== "SolanaExternal") {
          return { account: null, members: [], wallets: [] };
        }
        return {
          account: { id: "account-solana", username: "solanatesting" },
          members: [],
          wallets: [
            {
              id: "wallet-solana",
              account_id: "account-solana",
              privy_user_id: "old-privy-user",
              chain: "solana",
              address: "SolanaExternal",
              address_normalized: "SolanaExternal",
              wallet_type: "external",
              role: "login",
              wallet_client_type: "phantom",
              verification_message: null,
              verification_signature: null,
              verified_at: "2026-05-06T00:00:00Z",
              created_at: "2026-05-06T00:00:00Z",
              updated_at: "2026-05-06T00:00:00Z",
            },
          ],
        };
      },
    );
    state.api.addTrustedB1naryMember.mockResolvedValue({
      account: { id: "account-solana", username: "solanatesting" },
      members: [
        {
          account_id: "account-solana",
          privy_user_id: "privy-user-1",
          role: "owner",
          verified_at: "2026-05-06T00:00:00Z",
          created_at: "2026-05-06T00:00:00Z",
        },
      ],
      wallets: [],
    });

    const { useB1naryAccount } = await import("@/hooks/useB1naryAccount");
    const { result } = renderHook(() => useB1naryAccount());

    await waitFor(() => {
      expect(result.current.account?.username).toBe("solanatesting");
    });

    expect(state.api.addTrustedB1naryMember).toHaveBeenCalledWith(
      "account-solana",
      "privy-user-1",
    );
    expect(result.current.needsOnboarding).toBe(false);
  });
});
