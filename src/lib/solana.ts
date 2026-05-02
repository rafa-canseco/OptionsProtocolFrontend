import { Connection, PublicKey } from "@solana/web3.js";

// Vercel/Railway env values can be stored with trailing whitespace or newlines,
// which would slip into PublicKey/Connection ctors and fail at runtime.
const envStr = (raw: string | undefined, fallback = ""): string =>
  (raw && raw.trim()) || fallback;

export const SOLANA_RPC_URL = envStr(process.env.NEXT_PUBLIC_SOLANA_RPC_URL);
export const SOLANA_USDC_MINT = envStr(process.env.NEXT_PUBLIC_SOLANA_USDC_MINT);
export const SOLANA_TSLAX_MINT = envStr(process.env.NEXT_PUBLIC_SOLANA_TSLAX_MINT);
export const SOLANA_CHAIN = envStr(
  process.env.NEXT_PUBLIC_SOLANA_CHAIN,
  "solana:devnet",
);

/** Native SOL mint address — used as wSOL when wrapped into SPL token */
export const SOLANA_WSOL_MINT =
  "So11111111111111111111111111111111111111112";

/**
 * Keep native SOL available for rent/account state when wrapping to wSOL.
 * Gas is sponsored, but wrapping can still require rent-exempt lamports.
 */
export const SOLANA_NATIVE_RESERVE_LAMPORTS = BigInt(15_000_000);

/** Block explorer for Solana transaction links */
export const SOLANA_EXPLORER_URL = envStr(
  process.env.NEXT_PUBLIC_SOLANA_EXPLORER_URL,
  "https://solscan.io",
);

export function solanaTxUrl(signature: string): string {
  const baseUrl = `${SOLANA_EXPLORER_URL.replace(/\/$/, "")}/tx/${signature}`;
  if (SOLANA_CHAIN.includes("devnet")) return `${baseUrl}?cluster=devnet`;
  if (SOLANA_CHAIN.includes("testnet")) return `${baseUrl}?cluster=testnet`;
  return baseUrl;
}

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

if (!SOLANA_TSLAX_MINT) {
  console.warn(
    "[solana] NEXT_PUBLIC_SOLANA_TSLAX_MINT is not set. " +
      "TSLAx balance will always show as zero.",
  );
}

export const solanaConnection = SOLANA_RPC_URL
  ? new Connection(SOLANA_RPC_URL)
  : null;

/**
 * Derive a websocket URL for Solana subscriptions from the configured HTTP RPC URL.
 * Falls back to the public devnet wss endpoint only when the env var is empty.
 *
 * Privy/`@solana/kit` `createSolanaRpcSubscriptions` requires a wss URL distinct
 * from the http one, but providers like Helius accept the same host via wss.
 */
export function solanaWsUrl(): string {
  if (!SOLANA_RPC_URL) return "wss://api.devnet.solana.com";
  return SOLANA_RPC_URL.replace(/^http/, "ws");
}

export function toPublicKey(value: string, label: string): PublicKey {
  // Trim defensively: Vercel/Railway env vars can carry trailing newlines.
  const trimmed = value?.trim() ?? "";
  try {
    return new PublicKey(trimmed);
  } catch {
    throw new Error(
      `Invalid Solana public key for ${label}: "${value}"`,
    );
  }
}
