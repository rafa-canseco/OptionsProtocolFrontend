import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const getParsedTokenAccountsByOwner = vi.fn();
const getBalance = vi.fn();

vi.mock("@/lib/solana", () => ({
  SOLANA_USDC_MINT: "UsdcMint1111111111111111111111111111111111",
  SOLANA_TSLAX_MINT: "TslaxMint11111111111111111111111111111111",
  SOLANA_WSOL_MINT: "So11111111111111111111111111111111111111112",
  solanaConnection: {
    getParsedTokenAccountsByOwner,
    getBalance,
  },
  toPublicKey: (value: string) => ({ toBase58: () => value }),
}));

function mockTokenAccount(rawAmount: string) {
  return {
    value: [
      {
        account: {
          data: {
            parsed: { info: { tokenAmount: { amount: rawAmount } } },
          },
        },
      },
    ],
  };
}

describe("useSolanaBalance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reads USDC, wSOL, TSLAx, and native SOL balances", async () => {
    const byMint = new Map<string, ReturnType<typeof mockTokenAccount>>([
      ["UsdcMint1111111111111111111111111111111111", mockTokenAccount("1000000")],
      ["TslaxMint11111111111111111111111111111111", mockTokenAccount("25000000")],
      ["So11111111111111111111111111111111111111112", mockTokenAccount("0")],
    ]);

    getParsedTokenAccountsByOwner.mockImplementation(
      async (_owner, { mint }: { mint: { toBase58: () => string } }) =>
        byMint.get(mint.toBase58()) ?? { value: [] },
    );
    getBalance.mockResolvedValue(2_500_000_000);

    const { useSolanaBalance } = await import("@/hooks/useSolanaBalance");
    const { result } = renderHook(() => useSolanaBalance("wallet111"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.solanaUsdcRaw).toBe(BigInt(1_000_000));
    expect(result.current.solanaUsdc).toBe(1);
    expect(result.current.solanaTslaxRaw).toBe(BigInt(25_000_000));
    expect(result.current.solanaTslax).toBe(0.25);
    expect(result.current.solanaWsolRaw).toBe(BigInt(0));
    expect(result.current.solanaSolRaw).toBe(BigInt(2_500_000_000));
    expect(result.current.solanaSol).toBe(2.5);
  });
});
