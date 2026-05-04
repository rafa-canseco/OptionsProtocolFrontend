import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";

const ORIGINAL_ENV = { ...process.env };

type MockEvmWallet = ReturnType<typeof makeWallet>;
type MockSolanaWallet = ReturnType<typeof makeSolanaWallet>;

const mockWallets: MockEvmWallet[] = [];
const mockSolanaWallets: MockSolanaWallet[] = [];
const mockClient = { account: { address: "0xSmartWallet" } };
const mockLogin = vi.fn();
const mockLogout = vi.fn();
const mockCreateSolanaWallet = vi.fn();
let mockPrivyState = {
  authenticated: true,
  ready: true,
};

vi.mock("@privy-io/react-auth", () => ({
  usePrivy: () => ({
    authenticated: mockPrivyState.authenticated,
    login: mockLogin,
    logout: mockLogout,
    ready: mockPrivyState.ready,
  }),
  useWallets: () => ({ wallets: mockWallets }),
  useConnectWallet: () => ({ connectWallet: vi.fn() }),
}));

vi.mock("@privy-io/react-auth/smart-wallets", () => ({
  useSmartWallets: () => ({ client: mockClient }),
}));

vi.mock("@privy-io/react-auth/solana", () => ({
  useWallets: () => ({ wallets: mockSolanaWallets }),
  useCreateWallet: () => ({ createWallet: mockCreateSolanaWallet }),
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

function makeSolanaWallet(address: string, isEmbedded = false) {
  return {
    address,
    standardWallet: isEmbedded
      ? { name: "Privy", isPrivyWallet: true }
      : { name: "Phantom" },
  };
}

describe("useWallet", () => {
  beforeEach(() => {
    mockWallets.length = 0;
    mockSolanaWallets.length = 0;
    mockPrivyState = { authenticated: true, ready: true };
    mockLogin.mockReset();
    mockLogout.mockReset();
    mockCreateSolanaWallet.mockReset();
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

  it("prompts Privy login before creating a Solana embedded wallet", async () => {
    process.env = { ...ORIGINAL_ENV };
    process.env.NEXT_PUBLIC_DEPLOYMENT_ENV = "devnet";
    mockPrivyState = { authenticated: false, ready: true };
    mockSolanaWallets.push(makeSolanaWallet("ExternalSolanaWallet"));
    const { result } = await getHook();

    await expect(
      result.current.sendSolanaDeposit("ExternalSolanaWallet", BigInt(1)),
    ).rejects.toThrow(/connect your wallet before depositing to Solana/i);

    expect(mockLogin).toHaveBeenCalledTimes(1);
    expect(mockCreateSolanaWallet).not.toHaveBeenCalled();
  });

  it("does not create a Solana embedded wallet before Privy is ready", async () => {
    process.env = { ...ORIGINAL_ENV };
    process.env.NEXT_PUBLIC_DEPLOYMENT_ENV = "devnet";
    mockPrivyState = { authenticated: true, ready: false };
    mockSolanaWallets.push(makeSolanaWallet("ExternalSolanaWallet"));
    const { result } = await getHook();

    await expect(
      result.current.sendSolanaDeposit("ExternalSolanaWallet", BigInt(1)),
    ).rejects.toThrow(/wallet session is still loading/i);

    expect(mockLogin).not.toHaveBeenCalled();
    expect(mockCreateSolanaWallet).not.toHaveBeenCalled();
  });
});

describe("useWallet Solana production gate", () => {
  beforeEach(() => {
    mockWallets.length = 0;
    mockSolanaWallets.length = 0;
    mockPrivyState = { authenticated: true, ready: true };
    mockLogin.mockReset();
    mockLogout.mockReset();
    mockCreateSolanaWallet.mockReset();
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV };
    process.env.NEXT_PUBLIC_DEPLOYMENT_ENV = "mainnet";
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  async function getHook() {
    const mod = await import("@/hooks/useWallet");
    return renderHook(() => mod.useWallet());
  }

  it("sendSolanaDeposit throws in mainnet", async () => {
    const { result } = await getHook();
    await expect(
      result.current.sendSolanaDeposit("SomeSolAddr", BigInt(1)),
    ).rejects.toThrow(/Solana flows are disabled in production/i);
  });

  it("sendSolanaSolDeposit throws in mainnet", async () => {
    const { result } = await getHook();
    await expect(
      result.current.sendSolanaSolDeposit("SomeSolAddr", BigInt(1)),
    ).rejects.toThrow(/Solana flows are disabled in production/i);
  });

  it("sendSolanaWithdraw throws in mainnet", async () => {
    const { result } = await getHook();
    await expect(
      result.current.sendSolanaWithdraw("SomeSolAddr", BigInt(1)),
    ).rejects.toThrow(/Solana flows are disabled in production/i);
  });

  it("sendSolanaSolWithdraw throws in mainnet", async () => {
    const { result } = await getHook();
    await expect(
      result.current.sendSolanaSolWithdraw("SomeSolAddr", BigInt(1)),
    ).rejects.toThrow(/Solana flows are disabled in production/i);
  });

  it("sendSolanaTransaction throws in mainnet", async () => {
    const { result } = await getHook();
    await expect(
      result.current.sendSolanaTransaction({} as never),
    ).rejects.toThrow(/Solana flows are disabled in production/i);
  });

  it("signSolanaTransaction throws in mainnet", async () => {
    const { result } = await getHook();
    await expect(
      result.current.signSolanaTransaction(new Uint8Array()),
    ).rejects.toThrow(/Solana flows are disabled in production/i);
  });
});
