"use client";

import { useCallback } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useWallet } from "@/hooks/useWallet";
import {
  api,
  type PriceQuote,
  type BridgeJob,
  type BridgeJobStatus,
} from "@/lib/api";
import { computeCollateral } from "@/lib/execution";
import {
  buildEvmBurnCalls,
  DOMAIN_BASE,
  DOMAIN_SOLANA,
  getFastCctpMaxFee,
  getSolanaUsdcTokenAccount,
  solanaToBytes32,
} from "@/lib/cctp";
import {
  buildEvmTradeCalls,
  buildSolanaTradeTransaction,
} from "@/lib/bridgeTx";
import { isSolanaOffInProd } from "@/lib/marketState";
import { solanaConnection, toPublicKey } from "@/lib/solana";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChainId = "base" | "solana";

export interface DeficitResult {
  needsBridge: boolean;
  needsDeposit: boolean;
  sourceChain: ChainId | null;
  deficit: bigint;
}

export interface BridgeAndTradeResult {
  success: boolean;
  jobId?: string;
  chainExecuted?: ChainId;
  txHash?: string;
  error?: string;
  amount?: number;
}

export type BridgeProgress = {
  message: string;
  phase:
    | "preparing"
    | "signing"
    | "broadcasting"
    | "bridging"
    | "executing"
    | "confirmed";
  txHash?: string;
  jobId?: string;
  status?: BridgeJobStatus;
};

// Terminal states — stop polling when we hit one of these
const TERMINAL_STATUSES: BridgeJobStatus[] = [
  "completed",
  "failed",
  "mint_completed",
  "mint_completed_trade_failed",
];

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Bridge-and-trade orchestration.
 *
 * **Base → Solana** (backend submits trade):
 *   1. Smart wallet burns USDC on Base (send)
 *   2. Solana wallet signs trade tx (no send)
 *   3. POST with signedTradeTx
 *   4. Poll until "completed"
 *
 * **Solana → Base** (frontend executes trade after mint):
 *   1. Solana wallet burns USDC (send)
 *   2. POST with signedTradeTx: null
 *   3. Poll until "mint_completed"
 *   4. Frontend: sendBatchTx(approve + executeOrder)
 */
export function useBridgeAndTrade() {
  const { user } = usePrivy();
  const {
    address,
    solanaAddress,
    sendBatchTx,
    sendSolanaTransaction,
    signSolanaTransaction,
  } = useWallet();

  const checkDeficit = useCallback(
    (
      quote: PriceQuote,
      amount: number,
      isBuy: boolean,
      assetSlug: string,
      baseUsdcRaw: bigint,
      solanaUsdcRaw: bigint,
      solanaWsolRaw?: bigint,
      solanaSolRaw?: bigint,
      solanaTslaxRaw?: bigint,
    ): DeficitResult => {
      if (!quote.chain) {
        throw new Error(
          "Quote is missing the `chain` field. " +
            "This is a bug — all quotes must specify their chain.",
        );
      }

      // Production gate: Solana is read-only in mainnet. Throwing (rather
      // than silent zero-deficit) is deliberate defense-in-depth: if
      // `marketReadOnly` ever bypasses the button guard in AcceptModal,
      // the thrown error surfaces through its catch block instead of
      // quietly advancing the flow with fabricated state.
      if (isSolanaOffInProd() && quote.chain === "solana") {
        throw new Error("Solana flows are disabled in production.");
      }

      const { collateral } = computeCollateral(
        isBuy, amount, quote.strike, assetSlug,
      );

      // Puts (buy side): USDC collateral — can bridge cross-chain
      if (isBuy) {
        const targetBalance =
          quote.chain === "base" ? baseUsdcRaw : solanaUsdcRaw;

        if (targetBalance >= collateral) {
          return { needsBridge: false, needsDeposit: false, sourceChain: null, deficit: BigInt(0) };
        }

        const sourceChain: ChainId =
          quote.chain === "base" ? "solana" : "base";
        const sourceBalance =
          sourceChain === "base" ? baseUsdcRaw : solanaUsdcRaw;

        // Total across both chains still insufficient — user must deposit
        if (targetBalance + sourceBalance < collateral) {
          return { needsBridge: false, needsDeposit: true, sourceChain: null, deficit: collateral - targetBalance - sourceBalance };
        }

        const deficit = collateral - targetBalance;
        return { needsBridge: true, needsDeposit: false, sourceChain, deficit };
      }

      // Calls (sell side): wrapped asset collateral
      if (quote.chain === "solana") {
        if (assetSlug === "tslax") {
          const available = solanaTslaxRaw ?? BigInt(0);
          if (available >= collateral) {
            return { needsBridge: false, needsDeposit: false, sourceChain: null, deficit: BigInt(0) };
          }
          return { needsBridge: false, needsDeposit: true, sourceChain: null, deficit: collateral - available };
        }

        // SOL calls: wSOL + wrappable native SOL. Setup/rent/fees are sponsored
        // by the backend, so the user's full native SOL balance can be collateral.
        const nativeRaw = solanaSolRaw ?? BigInt(0);
        const available = (solanaWsolRaw ?? BigInt(0)) + nativeRaw;
        if (available >= collateral) {
          return { needsBridge: false, needsDeposit: false, sourceChain: null, deficit: BigInt(0) };
        }
        // Can't bridge SOL/wSOL via CCTP — user must deposit
        return { needsBridge: false, needsDeposit: true, sourceChain: null, deficit: collateral - available };
      }

      // Base calls: existing WETH/cbBTC logic — handled by AcceptModal on-chain check
      return { needsBridge: false, needsDeposit: false, sourceChain: null, deficit: BigInt(0) };
    },
    [],
  );

  const executeBridgeAndTrade = useCallback(
    async (params: {
      quote: PriceQuote;
      amount: number;
      isBuy: boolean;
      assetSlug: string;
      sourceChain: ChainId;
      deficit: bigint;
      onProgress?: (progress: BridgeProgress) => void;
    }): Promise<BridgeAndTradeResult> => {
      const { quote, amount, isBuy, assetSlug, sourceChain, deficit, onProgress } =
        params;
      const destChain: ChainId =
        sourceChain === "base" ? "solana" : "base";

      // Production gate: refuse any Solana source or destination before
      // signing or hitting the network.
      if (
        isSolanaOffInProd() &&
        (sourceChain === "solana" ||
          destChain === "solana" ||
          quote.chain === "solana")
      ) {
        throw new Error("Solana flows are disabled in production.");
      }

      if (!address) throw new Error("Smart wallet not connected");
      if (!solanaAddress) throw new Error("Solana wallet not ready");
      if (!user?.id) throw new Error("Privy user not authenticated");

      if (sourceChain === "base") {
        return executeBaseToSolana(
          quote, amount, isBuy, assetSlug, deficit,
          address, solanaAddress, user.id, onProgress,
        );
      }
      return executeSolanaToBase(
        quote, amount, isBuy, assetSlug, deficit,
        address, solanaAddress, user.id, onProgress,
      );
    },
    [
      address,
      solanaAddress,
      user,
      sendBatchTx,
      sendSolanaTransaction,
      signSolanaTransaction,
    ],
  );

  // -----------------------------------------------------------------------
  // Base → Solana: backend submits pre-signed Solana trade tx
  // -----------------------------------------------------------------------
  async function executeBaseToSolana(
    quote: PriceQuote,
    amount: number,
    isBuy: boolean,
    assetSlug: string,
    deficit: bigint,
    smartWalletAddr: string,
    solanaAddr: string,
    userId: string,
    onProgress?: (progress: BridgeProgress) => void,
  ): Promise<BridgeAndTradeResult> {
    const solanaPk = toPublicKey(solanaAddr, "Solana wallet");
    onProgress?.({
      phase: "preparing",
      message: "Resolving Solana USDC account...",
    });
    const solanaUsdcAccount = await getSolanaUsdcTokenAccount(solanaPk);
    const recipient = solanaToBytes32(solanaUsdcAccount);
    const usdcBalanceBefore = await readSolanaTokenBalance(solanaUsdcAccount);

    // 2a. Burn USDC on Base via smart wallet
    onProgress?.({
      phase: "broadcasting",
      message: "Checking bridge fee...",
    });
    const maxFee = await getFastCctpMaxFee(DOMAIN_BASE, DOMAIN_SOLANA, deficit);
    const burnCalls = buildEvmBurnCalls(deficit, recipient, maxFee);
    onProgress?.({
      phase: "broadcasting",
      message: "Reserving bridge route...",
    });
    const reserved = await api.reserveBridgeAndTrade({
      signedTradeTx: null,
      quoteId: quote.quote_id!,
      sourceChain: "base",
      destChain: "solana",
      userId,
      mintRecipient: solanaUsdcAccount.toBase58(),
      burnAmount: deficit.toString(),
    });
    console.log("[useBridgeAndTrade] Bridge job reserved:", reserved.job_id);
    onProgress?.({
      phase: "broadcasting",
      message: "Moving USDC from Base to Solana...",
      jobId: reserved.job_id,
    });
    const burnTxHash = (await sendBatchTx(burnCalls)) as string;
    console.log("[useBridgeAndTrade] Base CCTP burn tx:", burnTxHash);
    onProgress?.({
      phase: "signing",
      message: "Preparing your Solana order...",
      txHash: burnTxHash,
    });

    // 3. POST to backend as bridge-only. The Solana trade is built after mint,
    // using the actual USDC that arrived after CCTP fees/rounding.
    onProgress?.({
      phase: "bridging",
      message: "Starting bridge confirmation...",
      txHash: burnTxHash,
      jobId: reserved.job_id,
    });
    const { job_id: jobId } = await api.bridgeAndTrade({
      burnTxHash,
      signedTradeTx: null,
      quoteId: quote.quote_id!,
      sourceChain: "base",
      destChain: "solana",
      userId,
      mintRecipient: solanaUsdcAccount.toBase58(),
      burnAmount: deficit.toString(),
    });
    console.log("[useBridgeAndTrade] Bridge job created:", jobId);

    // 4. Poll until terminal
    onProgress?.({
      phase: "bridging",
      message: "Waiting for USDC to arrive on Solana...",
      txHash: burnTxHash,
      jobId,
    });
    const job = await pollBridgeStatus(jobId, onProgress);
    if (job.status === "failed") {
      return jobToResult(jobId, job);
    }

    onProgress?.({
      phase: "executing",
      message: "Executing order on Solana...",
      jobId,
      txHash: job.mint_tx_hash ?? job.burn_tx_hash,
      status: job.status,
    });
    if (!solanaConnection) {
      throw new Error("Solana RPC not configured");
    }
    const arrivedRaw = await waitForSolanaUsdcBalance(
      solanaUsdcAccount,
      usdcBalanceBefore,
      BigInt(Math.floor(amount * 1_000_000)),
    );
    const desiredRaw = BigInt(Math.floor(amount * 1_000_000));
    const tradeAmountRaw = arrivedRaw < desiredRaw ? arrivedRaw : desiredRaw;
    if (tradeAmountRaw <= BigInt(0)) {
      throw new Error("USDC did not arrive on Solana. Check bridge status before retrying.");
    }
    const actualAmount = Number(tradeAmountRaw) / 1_000_000;
    const tradeTx = await buildSolanaTradeTransaction(
      quote,
      actualAmount,
      isBuy,
      assetSlug,
      solanaPk,
    );
    const tradeTxHash = await sendSolanaTransaction(tradeTx);
    console.log("[useBridgeAndTrade] Solana trade tx:", tradeTxHash);

    return {
      success: true,
      jobId,
      chainExecuted: "solana",
      txHash: tradeTxHash,
      amount: actualAmount,
    };
  }

  // -----------------------------------------------------------------------
  // Solana → Base: frontend executes Base trade after backend mints
  // -----------------------------------------------------------------------
  async function executeSolanaToBase(
    quote: PriceQuote,
    amount: number,
    isBuy: boolean,
    assetSlug: string,
    deficit: bigint,
    smartWalletAddr: string,
    solanaAddr: string,
    userId: string,
    onProgress?: (progress: BridgeProgress) => void,
  ): Promise<BridgeAndTradeResult> {
    // 2. Backend prepares a sponsored CCTP burn. The user only signs as
    // token owner; backend remains fee payer and broadcasts the final tx.
    onProgress?.({
      phase: "preparing",
      message: "Preparing sponsored Solana transfer...",
    });
    const preparedBurn = await api.prepareSolanaCctpBurn({
      owner: solanaAddr,
      destChain: "base",
      mintRecipient: smartWalletAddr,
      burnAmount: deficit.toString(),
      maxFee: "0",
      minFinalityThreshold: 2000,
    });
    const preparedBurnBytes = Buffer.from(
      preparedBurn.transaction_base64,
      "base64",
    );
    onProgress?.({
      phase: "signing",
      message: "Confirming Solana transfer...",
    });
    const signedBurnBytes = await signSolanaTransaction(
      new Uint8Array(preparedBurnBytes),
    );
    const signedBurnBase64 = Buffer.from(signedBurnBytes).toString("base64");

    // 3. Backend broadcasts the fully signed burn and creates the bridge job.
    onProgress?.({
      phase: "broadcasting",
      message: "Sending USDC to Base...",
    });
    const { job_id: jobId } = await api.submitSolanaCctpBurn({
      signedTransactionBase64: signedBurnBase64,
      destChain: "base",
      userId,
      mintRecipient: smartWalletAddr,
      burnAmount: deficit.toString(),
      quoteId: quote.quote_id!,
      signedTradeTx: null,
    });
    console.log("[useBridgeAndTrade] Solana CCTP burn job created:", jobId);

    // 4. Poll until mint_completed (USDC on Base)
    onProgress?.({
      phase: "bridging",
      message: "Waiting for USDC to arrive on Base...",
      jobId,
    });
    const job = await pollBridgeStatus(jobId, onProgress);

    if (job.status === "failed") {
      return jobToResult(jobId, job);
    }

    if (
      job.status === "mint_completed" ||
      job.status === "mint_completed_trade_failed"
    ) {
      // 5. USDC arrived on Base — execute trade via smart wallet
      onProgress?.({
        phase: "executing",
        message: "Executing order on Base...",
        jobId,
        status: job.status,
      });
      const tradeCalls = buildEvmTradeCalls(
        quote, amount, isBuy, assetSlug,
      );
      const tradeTxHash = (await sendBatchTx(tradeCalls)) as string;
      console.log("[useBridgeAndTrade] Base trade tx:", tradeTxHash);
      onProgress?.({
        phase: "confirmed",
        message: "Order sent.",
        txHash: tradeTxHash,
        jobId,
        status: job.status,
      });

      return {
        success: true,
        jobId,
        chainExecuted: "base",
        txHash: tradeTxHash,
      };
    }

    // completed (shouldn't happen without signedTradeTx, but handle)
    return jobToResult(jobId, job);
  }

  return { checkDeficit, executeBridgeAndTrade };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jobToResult(
  jobId: string,
  job: BridgeJob,
): BridgeAndTradeResult {
  return {
    success: job.status === "completed",
    jobId,
    chainExecuted: job.dest_chain,
    txHash: job.trade_tx_hash ?? job.mint_tx_hash ?? undefined,
    error: job.error_message ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Status polling (2s interval per backend recommendation)
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 2_000;
const MAX_POLL_ATTEMPTS = 180; // 6 minutes max
const SOLANA_BALANCE_POLL_INTERVAL_MS = 1_500;
const SOLANA_BALANCE_MAX_ATTEMPTS = 40; // 60s max

async function pollBridgeStatus(
  jobId: string,
  onProgress?: (progress: BridgeProgress) => void,
): Promise<BridgeJob> {
  let lastStatus: BridgeJobStatus | null = null;

  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    const job = await api.getBridgeStatus(jobId);
    if (job.status !== lastStatus) {
      lastStatus = job.status;
      console.log("[useBridgeAndTrade] Bridge job status:", jobId, job.status);
      onProgress?.({
        phase: TERMINAL_STATUSES.includes(job.status) ? "confirmed" : "bridging",
        message: bridgeStatusMessage(job),
        jobId,
        status: job.status,
        txHash: job.trade_tx_hash ?? job.mint_tx_hash ?? job.burn_tx_hash,
      });
    }

    if (TERMINAL_STATUSES.includes(job.status)) {
      return job;
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  return {
    id: jobId,
    status: "failed",
    source_chain: "base",
    dest_chain: "solana",
    burn_tx_hash: "",
    burn_amount: "",
    mint_recipient: "",
    quote_id: "",
    mint_tx_hash: null,
    trade_tx_hash: null,
    error_message:
      "Timed out waiting for bridge completion. " +
      "Your funds may still be in transit — check your balance before retrying.",
    created_at: "",
    updated_at: "",
  };
}

async function readSolanaTokenBalance(tokenAccount: { toBase58: () => string }): Promise<bigint> {
  if (!solanaConnection) {
    throw new Error("Solana RPC not configured");
  }
  try {
    const balance = await solanaConnection.getTokenAccountBalance(
      toPublicKey(tokenAccount.toBase58(), "Solana token account"),
      "confirmed",
    );
    return BigInt(balance.value.amount);
  } catch {
    return BigInt(0);
  }
}

async function waitForSolanaUsdcBalance(
  tokenAccount: { toBase58: () => string },
  balanceBefore: bigint,
  desiredRaw: bigint,
): Promise<bigint> {
  let latest = balanceBefore;

  for (let i = 0; i < SOLANA_BALANCE_MAX_ATTEMPTS; i++) {
    latest = await readSolanaTokenBalance(tokenAccount);
    if (latest >= desiredRaw || latest > balanceBefore) {
      return latest;
    }
    await new Promise((resolve) =>
      setTimeout(resolve, SOLANA_BALANCE_POLL_INTERVAL_MS),
    );
  }

  return latest;
}

function bridgeStatusMessage(job: BridgeJob): string {
  switch (job.status) {
    case "completed":
      return "Bridge complete. Order executed.";
    case "mint_completed":
      return `USDC arrived on ${job.dest_chain === "base" ? "Base" : "Solana"}.`;
    case "mint_completed_trade_failed":
      return "USDC arrived. Final order needs retry.";
    case "failed":
      return "Bridge failed.";
    default:
      return `Waiting for USDC to arrive on ${job.dest_chain === "base" ? "Base" : "Solana"}...`;
  }
}
