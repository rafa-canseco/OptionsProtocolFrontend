import { Connection, PublicKey } from "@solana/web3.js";

export const SOLANA_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "";
export const SOLANA_USDC_MINT = process.env.NEXT_PUBLIC_SOLANA_USDC_MINT ?? "";
export const SOLANA_CHAIN =
  process.env.NEXT_PUBLIC_SOLANA_CHAIN ?? "solana:devnet";

if (!SOLANA_RPC_URL) {
  console.warn(
    "[solana] NEXT_PUBLIC_SOLANA_RPC_URL is not set. " +
      "Solana features will not work.",
  );
}

if (!SOLANA_USDC_MINT) {
  console.warn(
    "[solana] NEXT_PUBLIC_SOLANA_USDC_MINT is not set. " +
      "Solana USDC balance will always show as zero.",
  );
}

export const solanaConnection = SOLANA_RPC_URL
  ? new Connection(SOLANA_RPC_URL)
  : null;

export function toPublicKey(value: string, label: string): PublicKey {
  try {
    return new PublicKey(value);
  } catch {
    throw new Error(
      `Invalid Solana public key for ${label}: "${value}"`,
    );
  }
}
