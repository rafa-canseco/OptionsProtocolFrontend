import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const state = vi.hoisted(() => ({
  privy: {
    authenticated: true,
    ready: true,
    user: {
      id: "privy-user-1",
      smartWallet: { address: "0xSmartWallet" },
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
  api: {
    getB1naryAccount: vi.fn(),
    createB1naryAccount: vi.fn(),
    linkTrustedB1naryWallet: vi.fn(),
  },
}));

vi.mock("@privy-io/react-auth", () => ({
  usePrivy: () => state.privy,
  useWallets: () => ({ wallets: state.evmWallets }),
}));

vi.mock("@privy-io/react-auth/smart-wallets", () => ({
  useSmartWallets: () => ({
    client: { account: { address: "0xSmartWallet" } },
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
    vi.clearAllMocks();
    state.api.getB1naryAccount.mockResolvedValue({
      account: { id: "account-1", username: "rafa" },
      members: [],
      wallets: [],
    });
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
});
