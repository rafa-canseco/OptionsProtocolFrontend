import {
  encodeFunctionData,
  pad,
  type Address,
} from "viem";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import type { BatchCall } from "@/hooks/useWallet";
import { CHAIN, ADDRESSES, ERC20_ABI } from "@/lib/contracts";
import { SOLANA_USDC_MINT, solanaConnection, toPublicKey } from "@/lib/solana";

// ---------------------------------------------------------------------------
// Domain IDs (Circle CCTP V2)
// ---------------------------------------------------------------------------

export const DOMAIN_BASE = 6;
export const DOMAIN_SOLANA = 5;
const CIRCLE_IRIS_API = "https://iris-api.circle.com";
export const CCTP_FAST_FINALITY_THRESHOLD = 1000;
const CCTP_FEE_BUFFER_BPS = 2_000; // 20%

// ---------------------------------------------------------------------------
// Contract / Program addresses
// ---------------------------------------------------------------------------

const isMainnet = CHAIN.id === 8453;

export const CCTP_EVM = {
  tokenMessenger: (isMainnet
    ? "0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d"
    : "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA") as Address,
  messageTransmitter: (isMainnet
    ? "0x81D40F21F12A8F0E3252Bccb954D722d4c464B64"
    : "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275") as Address,
} as const;

export const CCTP_SOLANA = {
  tokenMessengerMinter: new PublicKey(
    "CCTPV2vPZJS2u2BBsUoscuikbYjnpFmbFsvVuJdgUMQe",
  ),
  messageTransmitter: new PublicKey(
    "CCTPV2Sm4AdWt5296sk4P66VBZ7bEhcARwFaaS9YPbeC",
  ),
} as const;

// ---------------------------------------------------------------------------
// TokenMessengerV2 ABI (EVM) — only depositForBurn
// ---------------------------------------------------------------------------

export const TOKEN_MESSENGER_V2_ABI = [
  {
    type: "function",
    name: "depositForBurn",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "destinationDomain", type: "uint32" },
      { name: "mintRecipient", type: "bytes32" },
      { name: "burnToken", type: "address" },
      { name: "destinationCaller", type: "bytes32" },
      { name: "maxFee", type: "uint256" },
      { name: "minFinalityThreshold", type: "uint32" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

// ---------------------------------------------------------------------------
// Address format converters
// ---------------------------------------------------------------------------

/** Pad a 20-byte EVM address to 32 bytes (left-padded with zeros). */
export function evmToBytes32(addr: Address): `0x${string}` {
  return pad(addr, { size: 32 });
}

/** Convert a Solana PublicKey to a 32-byte hex string. */
export function solanaToBytes32(pubkey: PublicKey): `0x${string}` {
  return ("0x" + Buffer.from(pubkey.toBytes()).toString("hex")) as `0x${string}`;
}

/** Convert a 32-byte hex string back to a Solana PublicKey. */
export function bytes32ToSolana(bytes32: `0x${string}`): PublicKey {
  return new PublicKey(Buffer.from(bytes32.slice(2), "hex"));
}

export async function getSolanaUsdcTokenAccount(owner: PublicKey): Promise<PublicKey> {
  if (!solanaConnection) {
    throw new Error("Solana RPC not configured");
  }
  if (!SOLANA_USDC_MINT) {
    throw new Error("Solana USDC mint not configured");
  }

  const mint = toPublicKey(SOLANA_USDC_MINT, "USDC mint");
  const accounts = await solanaConnection.getTokenAccountsByOwner(owner, { mint });
  if (accounts.value.length > 0) {
    return accounts.value[0].pubkey;
  }

  return getAssociatedTokenAddress(
    mint,
    owner,
    false,
    TOKEN_PROGRAM_ID,
  );
}

// ---------------------------------------------------------------------------
// EVM burn builder — returns BatchCall[] for sendBatchTx()
// ---------------------------------------------------------------------------

/**
 * Build batch calls to burn USDC on Base via CCTP V2.
 * Caller must send these via `sendBatchTx()`.
 *
 * @param amount      Raw USDC amount (6 decimals)
 * @param recipient   Destination wallet (Solana pubkey as 32-byte hex)
 * @param maxFee      Max bridge fee in raw USDC. Fetch from backend.
 */
export function buildEvmBurnCalls(
  amount: bigint,
  recipient: `0x${string}`,
  maxFee: bigint,
): BatchCall[] {
  const approveData = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: "approve",
    args: [CCTP_EVM.tokenMessenger, amount],
  });

  const burnData = encodeFunctionData({
    abi: TOKEN_MESSENGER_V2_ABI,
    functionName: "depositForBurn",
    args: [
      amount,
      DOMAIN_SOLANA,
      recipient,
      ADDRESSES.usdc,
      "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`,
      maxFee,
      CCTP_FAST_FINALITY_THRESHOLD,
    ],
  });

  return [
    { to: ADDRESSES.usdc, data: approveData },
    { to: CCTP_EVM.tokenMessenger, data: burnData },
  ];
}

type CircleFeeQuote = {
  finalityThreshold: number;
  minimumFee: number;
};

export async function getFastCctpMaxFee(
  sourceDomain: number,
  destinationDomain: number,
  amount: bigint,
): Promise<bigint> {
  const response = await fetch(
    `${CIRCLE_IRIS_API}/v2/burn/USDC/fees/${sourceDomain}/${destinationDomain}`,
    { headers: { Accept: "application/json" } },
  );
  if (!response.ok) {
    throw new Error(`Could not fetch CCTP fees (${response.status}).`);
  }

  const fees = (await response.json()) as CircleFeeQuote[];
  const fastFee = fees.find(
    (fee) => fee.finalityThreshold === CCTP_FAST_FINALITY_THRESHOLD,
  );
  if (!fastFee) {
    throw new Error("CCTP fast-transfer fee is unavailable for this route.");
  }

  const minimumFeeMicros = BigInt(Math.ceil(fastFee.minimumFee * 1_000_000));
  const numerator =
    amount *
    minimumFeeMicros *
    BigInt(10_000 + CCTP_FEE_BUFFER_BPS);
  const denominator = BigInt(10_000 * 10_000 * 1_000_000);
  const fee = (numerator + denominator - BigInt(1)) / denominator;

  return fee > BigInt(0) ? fee : BigInt(1);
}

// ---------------------------------------------------------------------------
// Solana burn builder — returns a Transaction ready for signing
// ---------------------------------------------------------------------------

/**
 * Derive a PDA with the given seeds from a program.
 * Thin wrapper around PublicKey.findProgramAddressSync.
 */
function findPda(
  seeds: (Buffer | Uint8Array)[],
  programId: PublicKey,
): PublicKey {
  return PublicKey.findProgramAddressSync(seeds, programId)[0];
}

/** Build the 4-byte LE buffer for a u32. */
function u32Le(value: number): Buffer {
  const buf = Buffer.alloc(4);
  buf.writeUInt32LE(value, 0);
  return buf;
}

/** Build the 8-byte LE buffer for a u64 (from bigint). */
function u64Le(value: bigint): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(value, 0);
  return buf;
}

/**
 * Derive PDAs required by the CCTP V2 Solana depositForBurn instruction.
 */
function deriveCctpPdas(
  mint: PublicKey,
  owner: PublicKey,
  destDomain: number,
) {
  const tmm = CCTP_SOLANA.tokenMessengerMinter;
  const mt = CCTP_SOLANA.messageTransmitter;

  return {
    senderAuthority: findPda(
      [Buffer.from("sender_authority")],
      tmm,
    ),
    denylist: findPda(
      [Buffer.from("denylist_account"), owner.toBuffer()],
      tmm,
    ),
    tokenMessenger: findPda(
      [Buffer.from("token_messenger")],
      tmm,
    ),
    tokenMinter: findPda(
      [Buffer.from("token_minter")],
      tmm,
    ),
    localToken: findPda(
      [Buffer.from("local_token"), mint.toBuffer()],
      tmm,
    ),
    remoteTokenMessenger: findPda(
      [Buffer.from("remote_token_messenger"), Buffer.from(String(destDomain))],
      tmm,
    ),
    eventAuthority: findPda(
      [Buffer.from("__event_authority")],
      tmm,
    ),
    messageTransmitterConfig: findPda(
      [Buffer.from("message_transmitter")],
      mt,
    ),
    messageTransmitterEventAuthority: findPda(
      [Buffer.from("__event_authority")],
      mt,
    ),
  };
}

/**
 * Build a Solana Transaction to burn USDC via CCTP V2 depositForBurn.
 * Returns a Transaction ready for signing (NOT sent).
 *
 * @param ownerPubkey     User's Solana wallet (signer)
 * @param amount          Raw USDC amount (6 decimals)
 * @param evmRecipient    Destination EVM address as 32-byte hex
 * @param maxFee          Max bridge fee in raw USDC
 */
export async function buildSolanaBurnTransaction(
  ownerPubkey: PublicKey,
  amount: bigint,
  evmRecipient: `0x${string}`,
  maxFee: bigint,
): Promise<Transaction> {
  if (!solanaConnection) {
    throw new Error("Solana RPC not configured");
  }
  if (!SOLANA_USDC_MINT) {
    throw new Error("Solana USDC mint not configured");
  }

  const mint = toPublicKey(SOLANA_USDC_MINT, "USDC mint");
  const pdas = deriveCctpPdas(mint, ownerPubkey, DOMAIN_BASE);

  const ownerAta = await getAssociatedTokenAddress(
    mint, ownerPubkey, false, TOKEN_PROGRAM_ID,
  );

  // CCTP V2 depositForBurn instruction data (Anchor convention):
  // sha256("global:deposit_for_burn")[0..8] + Borsh-encoded args.
  const discriminator = Buffer.from(
    "d73c3d2e723780b0", "hex",
  );
  const recipientBytes = Buffer.from(evmRecipient.slice(2), "hex");
  const destCallerBytes = Buffer.alloc(32); // zero = anyone can relay

  const ixData = Buffer.concat([
    discriminator,
    u64Le(amount),
    u32Le(DOMAIN_BASE),
    recipientBytes,
    destCallerBytes,
    u64Le(maxFee),
    u32Le(0), // minFinalityThreshold
  ]);

  // Circle's MessageTransmitter stores MessageSent data in a client-generated
  // account. It must be a signer so the program can assign it during the CPI.
  const messageSentEventData = Keypair.generate();

  const burnIx = new TransactionInstruction({
    programId: CCTP_SOLANA.tokenMessengerMinter,
    keys: [
      { pubkey: ownerPubkey, isSigner: true, isWritable: true },
      { pubkey: ownerPubkey, isSigner: true, isWritable: true },
      { pubkey: pdas.senderAuthority, isSigner: false, isWritable: false },
      { pubkey: ownerAta, isSigner: false, isWritable: true },
      { pubkey: pdas.denylist, isSigner: false, isWritable: false },
      { pubkey: pdas.messageTransmitterConfig, isSigner: false, isWritable: true },
      { pubkey: pdas.tokenMessenger, isSigner: false, isWritable: false },
      { pubkey: pdas.remoteTokenMessenger, isSigner: false, isWritable: false },
      { pubkey: pdas.tokenMinter, isSigner: false, isWritable: false },
      { pubkey: pdas.localToken, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: true },
      { pubkey: messageSentEventData.publicKey, isSigner: true, isWritable: true },
      { pubkey: CCTP_SOLANA.messageTransmitter, isSigner: false, isWritable: false },
      { pubkey: CCTP_SOLANA.tokenMessengerMinter, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: pdas.eventAuthority, isSigner: false, isWritable: false },
      { pubkey: CCTP_SOLANA.tokenMessengerMinter, isSigner: false, isWritable: false },
      { pubkey: pdas.messageTransmitterEventAuthority, isSigner: false, isWritable: false },
      { pubkey: CCTP_SOLANA.messageTransmitter, isSigner: false, isWritable: false },
    ],
    data: ixData,
  });

  const tx = new Transaction();
  tx.add(burnIx);

  const { blockhash } = await solanaConnection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = ownerPubkey;
  tx.partialSign(messageSentEventData);

  return tx;
}
