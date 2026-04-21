import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

const mockWallets: any[] = [];
const mockClient: any = { account: { address: "0xSmartWallet" } };

vi.mock("@privy-io/react-auth", () => ({
  usePrivy: () => ({ logout: vi.fn(), ready: true }),
  useWallets: () => ({ wallets: mockWallets }),
  useConnectWallet: () => ({ connectWallet: vi.fn() }),
}));

vi.mock("@privy-io/react-auth/smart-wallets", () => ({
  useSmartWallets: () => ({ client: mockClient }),
}));

vi.mock("@privy-io/react-auth/solana", () => ({
  useWallets: () => ({ wallets: [] }),
  useCreateWallet: () => ({ createWallet: vi.fn() }),
  useSignAndSendTransaction: () => ({ signAndSendTransaction: vi.fn() }),
  useSignTransaction: () => ({ signTransaction: vi.fn() }),
}));

vi.mock("@/lib/contracts", () => ({
  CHAIN: { id: 8453 },
}));

vi.mock("@/lib/solana", () => ({
  SOLANA_RPC_URL: undefined,
  SOLANA_USDC_MINT: undefined,
  SOLANA_TSLAX_MINT: undefined,
  SOLANA_CHAIN: undefined,
  solanaConnection: undefined,
  toPublicKey: vi.fn(),
}));

function makeWallet(type: string, address: string) {
  return {
    walletClientType: type,
    address,
    switchChain: vi.fn().mockResolvedValue(undefined),
    getEthereumProvider: vi.fn(),
    loginOrLink: vi.fn(),
  };
}

describe("useWallet", () => {
  beforeEach(() => {
    mockWallets.length = 0;
    vi.resetModules();
  });

  async function getHook() {
    const mod = await import("@/hooks/useWallet");
    return renderHook(() => mod.useWallet());
  }

  it("returns hasExternalWallet=false when only embedded wallet", async () => {
    mockWallets.push(makeWallet("privy", "0xEmbedded"));
    const { result } = await getHook();

    expect(result.current.hasExternalWallet).toBe(false);
    expect(result.current.withdrawAddress).toBeUndefined();
    expect(result.current.fundingAddress).toBe("0xEmbedded");
  });

  it("returns hasExternalWallet=true when external wallet present", async () => {
    mockWallets.push(makeWallet("metamask", "0xExternal"));
    mockWallets.push(makeWallet("privy", "0xEmbedded"));
    const { result } = await getHook();

    expect(result.current.hasExternalWallet).toBe(true);
    expect(result.current.withdrawAddress).toBe("0xExternal");
    expect(result.current.fundingAddress).toBe("0xExternal");
  });

  it("returns hasExternalWallet=false when no wallets at all", async () => {
    const { result } = await getHook();

    expect(result.current.hasExternalWallet).toBe(false);
    expect(result.current.withdrawAddress).toBeUndefined();
    expect(result.current.fundingAddress).toBeUndefined();
    expect(result.current.isConnected).toBe(false);
  });

  it("fundingAddress falls back to embedded but withdrawAddress does not", async () => {
    mockWallets.push(makeWallet("privy", "0xEmbedded"));
    const { result } = await getHook();

    expect(result.current.fundingAddress).toBe("0xEmbedded");
    expect(result.current.withdrawAddress).toBeUndefined();
  });

  it("prefers external wallet for fundingAddress over embedded", async () => {
    mockWallets.push(makeWallet("privy", "0xEmbedded"));
    mockWallets.push(makeWallet("coinbase_wallet", "0xCoinbase"));
    const { result } = await getHook();

    expect(result.current.fundingAddress).toBe("0xCoinbase");
    expect(result.current.withdrawAddress).toBe("0xCoinbase");
  });
});
