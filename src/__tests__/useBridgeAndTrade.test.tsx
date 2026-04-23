import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import type { PriceQuote } from "@/lib/api";

const ORIGINAL_ENV = { ...process.env };

const mockBridgeAndTrade = vi.fn();
const mockGetBridgeStatus = vi.fn();
const mockSendBatchTx = vi.fn();
const mockSignSolanaTransaction = vi.fn();

vi.mock("@privy-io/react-auth", () => ({
  usePrivy: () => ({ user: { id: "user-1" } }),
}));

vi.mock("@/hooks/useWallet", () => ({
  useWallet: () => ({
    address: "0xSmartWallet",
    solanaAddress: "SolEmbeddedAddr1111111111111111111111111",
    sendBatchTx: mockSendBatchTx,
    signSolanaTransaction: mockSignSolanaTransaction,
  }),
}));

vi.mock("@/lib/api", () => ({
  api: {
    bridgeAndTrade: mockBridgeAndTrade,
    getBridgeStatus: mockGetBridgeStatus,
  },
}));

vi.mock("@/lib/execution", () => ({
  computeCollateral: (_isBuy: boolean, _amount: number, _strike: number, _slug: string) => ({
    collateral: BigInt(10_000_000),
  }),
}));

vi.mock("@/lib/cctp", () => ({
  buildEvmBurnCalls: () => [],
  buildSolanaBurnTransaction: vi.fn(),
  evmToBytes32: () => new Uint8Array(32),
  solanaToBytes32: () => new Uint8Array(32),
}));

vi.mock("@/lib/bridgeTx", () => ({
  buildEvmTradeCalls: () => [],
  buildSolanaTradeTransaction: vi.fn(),
}));

vi.mock("@/lib/solana", () => ({
  SOLANA_NATIVE_RESERVE_LAMPORTS: BigInt(5_000_000),
  toPublicKey: (addr: string) => ({ toBase58: () => addr }),
}));

function buildSolanaQuote(overrides: Partial<PriceQuote> = {}): PriceQuote {
  return {
    option_type: "put",
    strike: 180,
    expiry_days: 7,
    expiry_date: "2026-04-29",
    premium: 12.5,
    delta: 0.25,
    iv: 0.6,
    spot: 175,
    ttl: 30,
    expires_at: 1_900_000_000,
    available_amount: 2,
    otoken_address: "mint123",
    signature: "sig123",
    mm_address: "maker123",
    bid_price_raw: 12_500_000,
    deadline: 1_900_000_030,
    quote_id: "quote-1",
    max_amount_raw: 200_000_000,
    maker_nonce: 7,
    position_count: 0,
    chain: "solana",
    ...overrides,
  };
}

async function loadHook() {
  vi.resetModules();
  const mod = await import("@/hooks/useBridgeAndTrade");
  return mod.useBridgeAndTrade;
}

describe("useBridgeAndTrade production gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("returns zero deficit for Solana quotes in mainnet", async () => {
    process.env.NEXT_PUBLIC_DEPLOYMENT_ENV = "mainnet";
    const useBridgeAndTrade = await loadHook();

    const { result } = renderHook(() => useBridgeAndTrade());

    const deficit = result.current.checkDeficit(
      buildSolanaQuote(),
      1,
      true,
      "sol",
      BigInt(0),
      BigInt(0),
    );

    expect(deficit).toEqual({
      needsBridge: false,
      needsDeposit: false,
      sourceChain: null,
      deficit: BigInt(0),
    });
  });

  it("refuses executeBridgeAndTrade for Solana source in mainnet", async () => {
    process.env.NEXT_PUBLIC_DEPLOYMENT_ENV = "mainnet";
    const useBridgeAndTrade = await loadHook();

    const { result } = renderHook(() => useBridgeAndTrade());

    await expect(
      result.current.executeBridgeAndTrade({
        quote: buildSolanaQuote({ chain: "base" }),
        amount: 1,
        isBuy: true,
        assetSlug: "eth",
        sourceChain: "solana",
        deficit: BigInt(10_000_000),
      }),
    ).rejects.toThrow(/Solana flows are disabled in production/i);

    expect(mockSendBatchTx).not.toHaveBeenCalled();
    expect(mockSignSolanaTransaction).not.toHaveBeenCalled();
    expect(mockBridgeAndTrade).not.toHaveBeenCalled();
  });

  it("refuses executeBridgeAndTrade for Solana destination in mainnet", async () => {
    process.env.NEXT_PUBLIC_DEPLOYMENT_ENV = "mainnet";
    const useBridgeAndTrade = await loadHook();

    const { result } = renderHook(() => useBridgeAndTrade());

    await expect(
      result.current.executeBridgeAndTrade({
        quote: buildSolanaQuote(),
        amount: 1,
        isBuy: true,
        assetSlug: "sol",
        sourceChain: "base",
        deficit: BigInt(10_000_000),
      }),
    ).rejects.toThrow(/Solana flows are disabled in production/i);

    expect(mockSendBatchTx).not.toHaveBeenCalled();
    expect(mockSignSolanaTransaction).not.toHaveBeenCalled();
    expect(mockBridgeAndTrade).not.toHaveBeenCalled();
  });

  it("allows Solana deficit routing in devnet", async () => {
    process.env.NEXT_PUBLIC_DEPLOYMENT_ENV = "devnet";
    const useBridgeAndTrade = await loadHook();

    const { result } = renderHook(() => useBridgeAndTrade());

    const deficit = result.current.checkDeficit(
      buildSolanaQuote(),
      1,
      true,
      "sol",
      BigInt(10_000_000),
      BigInt(0),
    );

    // Base has enough USDC to bridge to the Solana quote target.
    expect(deficit.needsBridge).toBe(true);
    expect(deficit.sourceChain).toBe("base");
  });
});
