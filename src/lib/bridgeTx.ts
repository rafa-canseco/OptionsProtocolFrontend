/**
 * Trade tx builders for the bridge-and-trade flow.
 *
 * Direction-dependent signing strategy:
 *
 * Base → Solana:
 *   - Burn: smart wallet sends on Base
 *   - Trade: Solana embedded wallet signs (NOT sends) — backend submits
 *
 * Solana → Base:
 *   - Burn: Solana embedded wallet sends
 *   - Trade: frontend waits for backend mint, then calls sendBatchTx()
 *     directly (the Privy smart wallet doesn't support sign-without-send
 *     for ERC-4337 UserOps)
 */
import {
  maxUint256,
  encodeFunctionData,
} from "viem";
import { PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createApproveInstruction,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import type { PriceQuote } from "@/lib/api";
import type { BatchCall } from "@/hooks/useWallet";
import { ADDRESSES, ERC20_ABI } from "@/lib/contracts";
import { SOLANA_USDC_MINT, solanaConnection, toPublicKey } from "@/lib/solana";
import { encodeExecuteOrder, computeCollateral } from "@/lib/execution";

// ---------------------------------------------------------------------------
// Solana b1nary program addresses (from CONTEXT.md — devnet)
// ---------------------------------------------------------------------------

const SOLANA_PROGRAMS = {
  batchSettler: new PublicKey(
    process.env.NEXT_PUBLIC_SOLANA_BATCH_SETTLER ??
      "GpR6id2cHu5fUGsFm7NUKkB4NzfuEDa6brPzkSrgAzvS",
  ),
  marginPool: new PublicKey(
    process.env.NEXT_PUBLIC_SOLANA_MARGIN_POOL ??
      "Hp7XDp9USyoid2f7cJKPxmDrvHM2D8izeeGzkViPiy5r",
  ),
} as const;

// ---------------------------------------------------------------------------
// EVM: Build batch calls for approve + executeOrder on Base
// ---------------------------------------------------------------------------

/**
 * Build the batch calls for an EVM trade (approve + executeOrder).
 * Used for Solana→Base direction: after backend mints USDC to the
 * smart wallet, the frontend calls sendBatchTx() with these calls.
 */
export function buildEvmTradeCalls(
  quote: PriceQuote,
  amount: number,
  isBuy: boolean,
  assetSlug: string,
): BatchCall[] {
  const { oTokenAmount, collateral, collateralAsset } =
    computeCollateral(isBuy, amount, quote.strike, assetSlug);

  const calls: BatchCall[] = [];

  const approveData = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: "approve",
    args: [ADDRESSES.marginPool, maxUint256],
  });
  calls.push({ to: collateralAsset, data: approveData });

  const executeData = encodeExecuteOrder(quote, oTokenAmount, collateral);
  calls.push({ to: ADDRESSES.batchSettler, data: executeData });

  return calls;
}

// ---------------------------------------------------------------------------
// Solana: Build a trade Transaction (approve + executeOrder)
// ---------------------------------------------------------------------------

/** Build 8-byte LE buffer for a u64 (bigint). */
function u64Le(value: bigint): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(value, 0);
  return buf;
}

/**
 * Build a Solana Transaction for approve + executeOrder on the
 * b1nary Solana programs. Returns unsigned — caller must sign via
 * Privy's `signSolanaTransaction()`.
 *
 * NOTE: Instruction data format assumes Anchor-style Borsh encoding
 * matching the deployed Solana BatchSettler program. Verify against
 * the on-chain IDL during devnet testing.
 */
export async function buildSolanaTradeTransaction(
  quote: PriceQuote,
  amount: number,
  isBuy: boolean,
  assetSlug: string,
  ownerPubkey: PublicKey,
): Promise<Transaction> {
  if (!solanaConnection) {
    throw new Error("Solana RPC not configured");
  }
  if (!SOLANA_USDC_MINT) {
    throw new Error("Solana USDC mint not configured");
  }

  const mint = toPublicKey(SOLANA_USDC_MINT, "USDC mint");
  const { oTokenAmount, collateral } =
    computeCollateral(isBuy, amount, quote.strike, assetSlug);

  const ownerAta = await getAssociatedTokenAddress(
    mint, ownerPubkey, false, TOKEN_PROGRAM_ID,
  );

  const marginPoolPda = PublicKey.findProgramAddressSync(
    [Buffer.from("margin_pool")],
    SOLANA_PROGRAMS.marginPool,
  )[0];

  const approveIx = createApproveInstruction(
    ownerAta,
    marginPoolPda,
    ownerPubkey,
    collateral,
    [],
    TOKEN_PROGRAM_ID,
  );

  // executeOrder: Anchor discriminator + Borsh args
  const discriminator = Buffer.from("733db418a820d714", "hex");

  const oTokenMint = toPublicKey(
    quote.otoken_address!,
    "oToken mint",
  );

  const ixData = Buffer.concat([
    discriminator,
    oTokenMint.toBuffer(),
    u64Le(BigInt(quote.bid_price_raw!)),
    u64Le(BigInt(quote.deadline!)),
    u64Le(BigInt(quote.quote_id!)),
    u64Le(BigInt(quote.max_amount_raw!)),
    u64Le(BigInt(quote.maker_nonce!)),
    lengthPrefixed(
      Buffer.from(quote.signature!.replace("0x", ""), "hex"),
    ),
    u64Le(oTokenAmount),
    u64Le(collateral),
  ]);

  const executeIx = new TransactionInstruction({
    programId: SOLANA_PROGRAMS.batchSettler,
    keys: [
      { pubkey: ownerPubkey, isSigner: true, isWritable: true },
      { pubkey: oTokenMint, isSigner: false, isWritable: true },
      { pubkey: ownerAta, isSigner: false, isWritable: true },
      { pubkey: marginPoolPda, isSigner: false, isWritable: true },
      { pubkey: SOLANA_PROGRAMS.marginPool, isSigner: false, isWritable: false },
      { pubkey: SOLANA_PROGRAMS.batchSettler, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      {
        pubkey: new PublicKey("11111111111111111111111111111111"),
        isSigner: false,
        isWritable: false,
      },
    ],
    data: ixData,
  });

  const tx = new Transaction();
  tx.add(approveIx, executeIx);

  const { blockhash } = await solanaConnection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = ownerPubkey;

  return tx;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Borsh-encode a byte array with a 4-byte LE length prefix. */
function lengthPrefixed(data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32LE(data.length, 0);
  return Buffer.concat([len, data]);
}
