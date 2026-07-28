"use client";

import { useEffect, useRef, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import {
  maxUint256,
  encodeFunctionData,
  type Address,
} from "viem";
import { useWallet } from "@/hooks/useWallet";
import { useBalances } from "@/hooks/useBalances";
import { useSolanaBalance } from "@/hooks/useSolanaBalance";
import { useBridgeAndTrade } from "@/hooks/useBridgeAndTrade";
import { publicClient, ADDRESSES, CHAIN, ERC20_ABI, WETH_ABI } from "@/lib/contracts";
import {
  VersionedTransaction,
} from "@solana/web3.js";
import {
  solanaTxUrl,
  toPublicKey,
} from "@/lib/solana";
import {
  buildSolanaTradeSetupTransaction,
  buildSolanaTradeTransaction,
} from "@/lib/bridgeTx";
import type { BatchCall } from "@/hooks/useWallet";
import { api, type PriceQuote } from "@/lib/api";
import { saveOptimistic } from "@/lib/optimisticPositions";
import { getAssetConfig } from "@/lib/assets";
import {
  computeAPR,
  computeROI,
  computeCollateral,
  encodeExecuteOrder,
  fireAndPoll,
  readTokenBalance,
  buildOptimisticPosition,
} from "@/lib/execution";
import { floorTo, fmtAsset } from "@/lib/utils";
import {
  isLazyOTokenEnabled,
  isProductionReadOnlyAsset,
} from "@/lib/marketState";
import {
  prepareSeries,
  SeriesPreparationError,
} from "@/lib/seriesPreparation";
import { clearPendingBridge, savePendingBridge } from "@/lib/pendingBridge";
import type { YieldMetric } from "./YieldToggle";
import { DepositModal } from "@/components/DepositModal";

interface Props {
  quote: PriceQuote;
  side: "buy" | "sell";
  onClose: () => void;
  onAccepted: (info: { amount: number; txHash: string | null }) => void;
  onQuoteInvalid?: () => void;
  renderExtra?: React.ReactNode | ((amount: number) => React.ReactNode);
  initialAmount?: string;
  confirmOnly?: boolean;
  maxPositionEth?: number;
  assetSymbol?: string;
  /** Asset slug ("eth" | "btc") to pick the right collateral token for calls */
  assetSlug?: string;
  yieldMetric?: YieldMetric;
}

type TxStep = "idle" | "preparing" | "executing" | "confirmed";

const PERCENTAGES = [25, 50, 75, 100] as const;
// Solana's packet limit is 1232 raw bytes. This guard receives base64 length,
// where the equivalent ceiling is 4 * ceil(1232 / 3) = 1644.
const SOLANA_PRIVY_SAFE_MAIN_TX_BASE64_BYTES = 1644;
const SOLANA_PRIVY_SPLIT_SETUP_BASE64_BYTES = 1260;
type DepositToken = "usdc" | "eth" | "btc" | "sol" | "tslax";

function getSerializedBase64Length(tx: { serialize: () => Uint8Array }): number {
  return 4 * Math.ceil(tx.serialize().length / 3);
}

function formatSolRawAmount(rawLamports: bigint, decimals = 8): string {
  const divisor = BigInt(10) ** BigInt(9 - decimals);
  const displayUnits = rawLamports / divisor;
  const scale = BigInt(10) ** BigInt(decimals);
  const whole = displayUnits / scale;
  const fraction = (displayUnits % scale).toString().padStart(decimals, "0");
  const trimmed = fraction.replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole.toString();
}


export function AcceptModal({ quote, side, onClose, onAccepted, onQuoteInvalid, renderExtra, initialAmount, confirmOnly, maxPositionEth, assetSymbol = "ETH", assetSlug = "eth", yieldMetric = "apr" }: Props) {
  const { getAccessToken } = usePrivy();
  const {
    address,
    solanaAddress,
    sendBatchTx,
    sendSolanaTransaction,
    signSolanaTransaction,
    activateSolanaTradingWallet,
    isConnected,
  } = useWallet();
  const { usd, eth, weth, wbtc, usdRaw: baseUsdcRaw, loading: baseBalLoading } = useBalances(address);
  const {
    solanaUsdcRaw,
    solanaUsdc,
    solanaWsolRaw,
    solanaSolRaw,
    solanaTslaxRaw,
    solanaTslax,
    loading: solBalLoading,
  } = useSolanaBalance(solanaAddress);
  const balancesLoading = baseBalLoading || solBalLoading;
  const { checkDeficit, executeBridgeAndTrade } = useBridgeAndTrade();
  const [step, setStep] = useState<TxStep>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [chainExecuted, setChainExecuted] = useState<"base" | "solana" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activePercent, setActivePercent] = useState<number | null>(null);
  const [showDeposit, setShowDeposit] = useState(false);
  const [depositToken, setDepositToken] = useState<DepositToken>("usdc");
  const [progressMessage, setProgressMessage] = useState("Preparing order...");
  const [preparationFailure, setPreparationFailure] =
    useState<SeriesPreparationError | null>(null);
  const inFlightRef = useRef(false);
  const preparationAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      preparationAbortRef.current?.abort();
    };
  }, []);

  const isBuy = side === "buy";
  const isBtc = assetSlug === "btc";
  const lazyOTokenEnabled = isLazyOTokenEnabled();
  const assetConfig = getAssetConfig(assetSlug);
  const isSol = assetSlug === "sol";
  const marketReadOnly = isProductionReadOnlyAsset(
    assetConfig ?? { slug: assetSlug, chain: quote.chain },
  );
  const solTotalBalance = Number(solanaWsolRaw + solanaSolRaw) / 1e9;
  // For covered calls: ETH uses native + WETH, BTC uses WBTC, SOL uses wSOL + native SOL
  // For buys: show combined USDC (Base + Solana) since bridge handles cross-chain
  const walletBalance = isBuy
    ? usd + solanaUsdc
    : assetSlug === "tslax"
      ? solanaTslax
    : isSol
      ? solTotalBalance
      : isBtc ? wbtc : eth + weth;

  const capEth = maxPositionEth ?? quote.available_amount;
  const maxAmount = isBuy
    ? Math.min(quote.available_amount, capEth) * quote.strike
    : Math.min(quote.available_amount, capEth);
  const maxByBalance = isBuy
    ? walletBalance
    : isSol
      ? solTotalBalance
      : walletBalance;
  const maxInputAmount = Math.min(maxByBalance, maxAmount);

  const [amountStr, setAmountStr] = useState(initialAmount ?? "");
  const amount = Number(amountStr) || 0;


  function handlePercent(pct: number) {
    setActivePercent(pct);
    if (!isBuy && isSol) {
      const solTotalRaw = solanaWsolRaw + solanaSolRaw;
      const quoteMaxRaw = BigInt(Math.floor(maxAmount * 1e9));
      const rawAvailable = solTotalRaw < quoteMaxRaw ? solTotalRaw : quoteMaxRaw;
      const raw = (rawAvailable * BigInt(pct)) / BigInt(100);
      setAmountStr(formatSolRawAmount(raw, assetConfig?.displayDecimals ?? 4));
      return;
    }

    const raw = maxInputAmount * (pct / 100);
    if (isBuy) {
      setAmountStr(floorTo(raw, 2).toString());
    } else {
      const decimals = isSol ? 8 : (assetConfig?.displayDecimals ?? 4);
      setAmountStr(floorTo(raw, decimals).toString());
    }
  }

  const apr = computeAPR(quote.premium, quote.strike, quote.expiry_days);
  const roi = computeROI(quote.premium, quote.strike);
  const yieldLabel = yieldMetric === "apr"
    ? `${Math.round(apr)}% APR`
    : `${roi.toFixed(1)}% ROI`;

  const ethEquiv = isBuy ? fmtAsset(amount / quote.strike) : String(amount);

  const scaledPremium = isBuy
    ? (quote.premium * amount) / quote.strike
    : quote.premium * amount;

  const premiumDisplay = scaledPremium < 1
    ? `$${scaledPremium.toFixed(2)}`
    : `$${scaledPremium.toFixed(2)}`;

  const commitDisplay = isBuy
    ? `$${amount.toLocaleString()}`
    : `${amount} ${assetSymbol}`;

  const loading = step !== "idle";
  const buttonLabel =
    step === "preparing"
      ? "Preparing trade..."
      : step === "executing"
      ? "Working..."
      : step === "confirmed"
        ? "Done"
        : preparationFailure?.kind === "stale"
          ? "Refresh quote"
          : preparationFailure && !preparationFailure.retryable
            ? "Close"
            : preparationFailure
              ? "Retry preparation"
        : !isConnected
          ? "Connect wallet"
          : "Accept";

  const minAmount = isBuy
    ? (assetConfig?.minBuyAmountUsd ?? 10)
    : (assetConfig?.minSellAmount ?? 0.005);

  async function handleAccept() {
    if (preparationFailure?.kind === "stale") {
      if (onQuoteInvalid) onQuoteInvalid();
      else onClose();
      return;
    }
    if (preparationFailure && !preparationFailure.retryable) {
      onClose();
      return;
    }
    if (marketReadOnly) {
      setError(`${assetSymbol} is visible in production, but trading is still coming soon.`);
      return;
    }

    if (!isConnected) {
      setDepositToken(
        isBuy
          ? "usdc"
          : assetSlug === "tslax"
            ? "tslax"
            : isSol
              ? "sol"
              : isBtc
                ? "btc"
                : "eth",
      );
      setShowDeposit(true);
      return;
    }

    if (!quote.otoken_address || !quote.signature || !quote.mm_address || !quote.bid_price_raw
        || !quote.deadline || !quote.quote_id || quote.max_amount_raw == null
        || quote.maker_nonce == null) {
      setError("This option is not available on-chain yet.");
      return;
    }
    if (
      quote.chain === "base" &&
      !lazyOTokenEnabled &&
      quote.deployment_status != null &&
      quote.deployment_status !== "ready"
    ) {
      setError("This option series is still being prepared. Refresh and try again shortly.");
      return;
    }

    if (amount < minAmount) {
      const label = isBuy ? `$${minAmount}` : `${minAmount} ${assetSymbol}`;
      setError(`Minimum amount is ${label}.`);
      return;
    }
    if (amount > maxAmount) {
      const label = isBuy
        ? `$${maxAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
        : `${fmtAsset(maxAmount)} ${assetSymbol}`;
      setError(`Exceeds max trade size. Enter ${label} or less.`);
      return;
    }

    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setError(null);
    setPreparationFailure(null);
    setProgressMessage("Checking balances...");
    let currentStep: TxStep = "idle";
    const updateStep = (s: TxStep) => {
      currentStep = s;
      setStep(s);
      if (s === "idle") setProgressMessage("Preparing order...");
    };

    try {
      // --- Cross-chain bridge detection for buys (USDC bridgeable via CCTP) ---
      if (isBuy && quote.chain) {
        const deficit = checkDeficit(
          quote, amount, isBuy, assetSlug, baseUsdcRaw, solanaUsdcRaw,
          solanaWsolRaw, solanaSolRaw, solanaTslaxRaw,
        );

        // Insufficient balance across both chains — prompt deposit
        if (deficit.needsDeposit) {
          setDepositToken("usdc");
          setShowDeposit(true);
          return;
        }

        if (deficit.needsBridge && deficit.sourceChain) {
          if (!address) {
            setError("Base smart wallet not ready. Reconnect your Base account and try again.");
            return;
          }
          if (!solanaAddress) {
            updateStep("executing");
            setProgressMessage("Activating Solana trading account...");
            try {
              await activateSolanaTradingWallet();
              setError("Solana trading account activated. Click Accept again to continue.");
            } finally {
              updateStep("idle");
            }
            return;
          }
          updateStep("executing");
          setProgressMessage("Checking bridge route...");
          savePendingBridge({
            message: "Checking bridge route...",
            quoteId: quote.quote_id,
          });
          const result = await executeBridgeAndTrade({
            quote, amount, isBuy, assetSlug,
            sourceChain: deficit.sourceChain,
            deficit: deficit.deficit,
            onProgress: (progress) => {
              setProgressMessage(progress.message);
              savePendingBridge({
                message: progress.message,
                jobId: progress.jobId,
                txHash: progress.txHash,
                quoteId: quote.quote_id,
              });
            },
          });

          if (result.success) {
            const acceptedAmount = result.amount ?? amount;
            clearPendingBridge();
            setTxHash(result.txHash ?? null);
            setChainExecuted(result.chainExecuted ?? null);
            updateStep("confirmed");
            onAccepted({ amount: acceptedAmount, txHash: result.txHash ?? null });
            window.dispatchEvent(new Event("balance:refetch"));

            const pos = buildOptimisticPosition(
              quote, acceptedAmount, isBuy, address!, assetSlug,
            );
            pos.tx_hash = result.txHash ?? "";
            try { saveOptimistic(pos); } catch (err) {
              console.warn("[AcceptModal] Could not save optimistic position:", err);
            }
          } else {
            setError(
              result.error ??
                "Bridge-and-trade failed. Check your balance before retrying.",
            );
            setStep("idle");
          }
          return;
        }

        // Sufficient on target chain — fall through to direct execution
      }

      // --- Solana sells: SOL/wSOL collateral (not bridgeable) ---
      if (!isBuy && quote.chain === "solana") {
        const deficit = checkDeficit(
          quote, amount, isBuy, assetSlug, baseUsdcRaw, solanaUsdcRaw,
          solanaWsolRaw, solanaSolRaw, solanaTslaxRaw,
        );

        if (deficit.needsDeposit) {
          setDepositToken(assetSlug === "tslax" ? "tslax" : "sol");
          setShowDeposit(true);
          return;
        }
      }

      // --- Direct Solana execution (buys with enough on Solana, or sells) ---
      if (quote.chain === "solana") {
        if (!solanaAddress) {
          updateStep("executing");
          setProgressMessage("Activating Solana trading account...");
          try {
            await activateSolanaTradingWallet();
            setError("Solana trading account activated. Click Accept again to continue.");
          } finally {
            updateStep("idle");
          }
          return;
        }

        updateStep("executing");
        setProgressMessage("Preparing Solana order...");

        const solanaPk = toPublicKey(solanaAddress, "Solana wallet");
        const { collateral } = computeCollateral(
          isBuy,
          amount,
          quote.strike,
          assetSlug,
        );

        let wrapAmount = BigInt(0);
        if (!isBuy && assetSlug === "sol" && solanaWsolRaw < collateral) {
          wrapAmount = collateral - solanaWsolRaw;
          if (solanaSolRaw < wrapAmount) {
            setDepositToken("sol");
            setShowDeposit(true);
            setStep("idle");
            return;
          }
        }

        let tradeTx = await buildSolanaTradeTransaction(
          quote, amount, isBuy, assetSlug, solanaPk,
          isBuy ? undefined : solanaWsolRaw,
          wrapAmount,
        );

        const tradeTxBase64Length = getSerializedBase64Length(tradeTx);
        if (
          wrapAmount > BigInt(0) ||
          tradeTxBase64Length > SOLANA_PRIVY_SPLIT_SETUP_BASE64_BYTES
        ) {
          if (wrapAmount > BigInt(0)) {
            setProgressMessage("Preparing sponsored Solana setup...");
            const setup = await api.prepareSolanaSponsoredSetup({
              user: solanaPk.toBase58(),
              otokenMint: quote.otoken_address!,
              wrapLamports: wrapAmount.toString(),
              approveAmount: collateral.toString(),
            });
            const setupTx = VersionedTransaction.deserialize(
              Buffer.from(setup.transaction, "base64"),
            );
            const signedSetup = await signSolanaTransaction(setupTx.serialize());
            setProgressMessage("Confirming Solana setup...");
            await api.completeSolanaSponsoredSetup({
              user: solanaPk.toBase58(),
              transaction: Buffer.from(signedSetup).toString("base64"),
            });
            window.dispatchEvent(new Event("balance:refetch"));
          } else {
            setProgressMessage("Preparing Solana accounts...");
            const setupTx = await buildSolanaTradeSetupTransaction(
              quote,
              amount,
              isBuy,
              assetSlug,
              solanaPk,
              wrapAmount,
              true,
            );
            if (setupTx) {
              setProgressMessage("Confirming Solana setup...");
              await sendSolanaTransaction(setupTx);
              window.dispatchEvent(new Event("balance:refetch"));
            }
          }

          tradeTx = await buildSolanaTradeTransaction(
            quote, amount, isBuy, assetSlug, solanaPk,
            isBuy ? undefined : collateral,
            BigInt(0),
            false,
            false,
          );
        }

        const finalTradeTxBase64Length = getSerializedBase64Length(tradeTx);
        if (finalTradeTxBase64Length > SOLANA_PRIVY_SAFE_MAIN_TX_BASE64_BYTES) {
          throw new Error(
            `Solana transaction is too large for sponsored execution (${finalTradeTxBase64Length} bytes).`,
          );
        }

        setProgressMessage("Executing order on Solana...");
        const signature = await sendSolanaTransaction(tradeTx);
        setTxHash(signature);
        setChainExecuted("solana");
        updateStep("confirmed");
        onAccepted({ amount, txHash: signature });
        window.dispatchEvent(new Event("balance:refetch"));

        const pos = buildOptimisticPosition(
          quote, amount, isBuy,
          solanaAddress as unknown as Address, assetSlug,
        );
        pos.tx_hash = signature;
        try { saveOptimistic(pos); } catch (err) {
          console.warn("[AcceptModal] Could not save optimistic position:", err);
        }
        return;
      }

      // --- Direct Base execution ---
      if (!address) {
        setDepositToken(
          isBuy
            ? "usdc"
            : assetSlug === "tslax"
              ? "tslax"
              : isSol
                ? "sol"
                : isBtc
                  ? "btc"
                  : "eth",
        );
        setShowDeposit(true);
        return;
      }

      const { oTokenAmount, collateral, collateralAsset } =
        computeCollateral(isBuy, amount, quote.strike, assetSlug);

      // On-chain collateral check for sells only. Buys use USDC collateral
      // which was already validated in checkDeficit above; running the
      // WETH/cbBTC branch on a buy compares USDC-denominated collateral
      // (6 decimals) against WETH/cbBTC balances (18/8 decimals), which
      // redirects a sufficiently funded buyer to the deposit modal.
      let wrapAmount = BigInt(0);
      let nativeBalanceBefore: bigint | null = null;
      if (!isBuy) {
        setProgressMessage("Checking collateral...");
        if (isBtc) {
          // BTC calls: cbBTC is already ERC20, no wrapping needed
          const wbtcBal = await readTokenBalance(ADDRESSES.wbtc, address);
          if (wbtcBal < collateral) {
            setDepositToken("btc");
            setShowDeposit(true);
            return;
          }
        } else {
          // ETH calls: accept native ETH + WETH combined, wrap if needed
          const [wethBal, nativeBal] = await Promise.all([
            readTokenBalance(ADDRESSES.weth, address),
            publicClient.getBalance({ address }),
          ]);
          nativeBalanceBefore = nativeBal;
          if (wethBal + nativeBal < collateral) {
            setDepositToken("eth");
            setShowDeposit(true);
            return;
          }
          if (wethBal < collateral) {
            wrapAmount = collateral - wethBal;
          }
        }
      }

      let executionQuote = quote;
      if (lazyOTokenEnabled) {
        updateStep("preparing");
        setProgressMessage("Preparing trade...");
        const preparationAbort = new AbortController();
        preparationAbortRef.current = preparationAbort;
        const accessToken = await getAccessToken();
        if (preparationAbort.signal.aborted) return;
        if (!accessToken) {
          throw new SeriesPreparationError(
            "auth",
            "Your session expired. Reconnect your wallet and try again.",
            { code: "AUTH_REQUIRED", retryable: true },
          );
        }

        executionQuote = await prepareSeries({
          quote,
          walletAddress: address,
          amountRaw: oTokenAmount.toString(),
          accessToken,
          signal: preparationAbort.signal,
          onCreating: () => setProgressMessage("Creating option series..."),
        });
        preparationAbortRef.current = null;
      }

      setProgressMessage("Trade ready. Confirming in wallet...");
      const executeData = encodeExecuteOrder(
        executionQuote,
        oTokenAmount,
        collateral,
      );
      const currentAllowance = await publicClient.readContract({
        address: collateralAsset, abi: ERC20_ABI,
        functionName: "allowance", args: [address, ADDRESSES.marginPool],
      });

      updateStep("executing");

      setProgressMessage(
        wrapAmount > BigInt(0) && currentAllowance < collateral
          ? "Wrapping ETH, approving collateral, and executing order..."
          : wrapAmount > BigInt(0)
            ? "Wrapping ETH and executing order..."
            : currentAllowance < collateral
          ? "Approving collateral and executing order..."
          : "Executing order on Base...",
      );
      const balanceBefore = await readTokenBalance(collateralAsset, address);
      const balanceDecreased = async () => {
        if (wrapAmount > BigInt(0) && nativeBalanceBefore != null) {
          const nativeBalance = await publicClient.getBalance({ address });
          return nativeBalance < nativeBalanceBefore;
        }
        const bal = await readTokenBalance(collateralAsset, address);
        return bal < balanceBefore;
      };

      const approveAndExecuteCalls: BatchCall[] = [];
      if (wrapAmount > BigInt(0)) {
        approveAndExecuteCalls.push({
          to: ADDRESSES.weth,
          data: encodeFunctionData({
            abi: WETH_ABI,
            functionName: "deposit",
            args: [],
          }),
          value: wrapAmount,
        });
      }
      if (currentAllowance < collateral) {
        approveAndExecuteCalls.push({
          to: collateralAsset,
          data: encodeFunctionData({
            abi: ERC20_ABI,
            functionName: "approve",
            args: [ADDRESSES.marginPool, maxUint256],
          }),
        });
      }
      approveAndExecuteCalls.push({ to: ADDRESSES.batchSettler, data: executeData });

      const label = wrapAmount > BigInt(0)
        ? currentAllowance < collateral
          ? "batch-wrap-approve-execute"
          : "batch-wrap-execute"
        : currentAllowance < collateral
          ? "batch-approve-execute"
          : "executeOrder";
      const resultHash = await fireAndPoll(
        () => sendBatchTx(approveAndExecuteCalls),
        balanceDecreased,
        label,
      );
      if (resultHash) setTxHash(resultHash);

      setChainExecuted(executionQuote.chain ?? "base");
      updateStep("confirmed");
      onAccepted({ amount, txHash: resultHash });
      window.dispatchEvent(new Event("balance:refetch"));

      const pos = buildOptimisticPosition(
        executionQuote,
        amount,
        isBuy,
        address,
        assetSlug,
      );
      pos.tx_hash = resultHash ?? "";
      try { saveOptimistic(pos); } catch (err) {
        console.warn("[AcceptModal] Could not save optimistic position:", err);
      }
    } catch (err: unknown) {
      console.error("[AcceptModal] Transaction failed:", err);
      if (err instanceof SeriesPreparationError) {
        clearPendingBridge();
        setPreparationFailure(err);
        setError(err.message);
        setStep("idle");
        setProgressMessage("Preparing order...");
        return;
      }
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("Solana flows are disabled")) {
        clearPendingBridge();
        setError(msg);
      } else if (msg.includes("Timed out") || msg.includes("Lost connection")) {
        setError(msg);
      } else if (msg.includes("collateral vault is not initialized")) {
        clearPendingBridge();
        setError(msg);
      } else if (
        msg.includes("API 409") &&
        msg.includes("Bridge job already exists for quote")
      ) {
        clearPendingBridge();
        setError("This quote was already used. Fetching a fresh quote...");
        onQuoteInvalid?.();
      } else if (currentStep === "idle") {
        clearPendingBridge();
        setError("Could not read on-chain data. Check your connection and try again.");
      } else {
        clearPendingBridge();
        setError("Transaction failed. No funds were moved. Please try again.");
      }
      setStep("idle");
      setProgressMessage("Preparing order...");
    } finally {
      preparationAbortRef.current = null;
      inFlightRef.current = false;
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="fixed inset-0 bg-black/30" onClick={loading ? undefined : onClose} />
      <div className="relative w-full max-w-md bg-[var(--bg)] rounded-t-2xl sm:rounded-2xl border border-[var(--border)] p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Back button */}
        <button
          onClick={onClose}
          disabled={loading}
          className="text-sm text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors disabled:opacity-40"
        >
          ← Back
        </button>

        {/* Title + earnings hero */}
        <div>
          <p className="text-lg font-semibold text-[var(--bone)]">
            {isBuy ? "Buy" : "Sell"} {assetSymbol} at ${quote.strike.toLocaleString()}/{assetSymbol}
          </p>
          {marketReadOnly && (
            <p className="mt-1 text-xs text-amber-400/90">
              This market is read-only in production. Live quotes are visible, but execution is blocked.
            </p>
          )}
          {amount > 0 && (
            <div className="mt-1 flex items-baseline gap-3">
              <p className="text-2xl font-bold text-[var(--accent)] font-mono">
                {premiumDisplay}
              </p>
              <p className="text-sm font-semibold text-[var(--accent)] font-mono">
                {yieldLabel}
              </p>
            </div>
          )}
        </div>

        {/* Amount controls — hidden in confirmOnly mode */}
        {!confirmOnly && (
          <>
            {/* Percentage buttons */}
            <div>
              <div className="grid grid-cols-4 gap-2">
                {PERCENTAGES.map((pct) => (
                  <button
                    key={pct}
                    onClick={() => handlePercent(pct)}
                    disabled={loading || walletBalance <= 0}
                    className={`py-2.5 rounded-xl text-sm font-semibold transition-all ${
                      activePercent === pct
                        ? "bg-[var(--accent)] text-[var(--bg)]"
                        : "bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--border)]"
                    } disabled:opacity-40`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>

            {/* Amount input */}
            <div>
              <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
                <div className="flex items-center gap-1.5 shrink-0">
                  <img
                    src={
                      isBuy
                        ? "/usdc.svg"
                        : assetSlug === "sol"
                          ? "/sol.png"
                          : assetSlug === "btc"
                            ? "/cbbtc.webp"
                            : assetSlug === "tslax"
                              ? "/tslax.svg"
                              : "/eth.png"
                    }
                    alt={isBuy ? "USDC" : assetSymbol}
                    className="w-5 h-5 rounded-full"
                  />
                  <span className="text-sm font-bold text-[var(--bone)]">
                    {isBuy ? "USDC" : assetSymbol}
                  </span>
                </div>
                <input
                  type="text"
                  inputMode="decimal"
                  value={amountStr}
                  disabled={loading}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === "" || /^(0|[1-9]\d*)?\.?\d*$/.test(raw)) {
                      setAmountStr(raw);
                      setActivePercent(null);
                    }
                  }}
                  className="flex-1 bg-transparent text-[var(--text)] font-semibold text-base focus:outline-none text-right"
                />
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-1.5">
                {balancesLoading
                  ? "Balance ..."
                  : isSol && !isBuy
                    ? (
                      <>
                        Balance {floorTo(solTotalBalance, 4).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} {assetSymbol}
                      </>
                    )
                    : isBuy
                      ? `Balance $${floorTo(walletBalance, 2).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : `Balance ${floorTo(walletBalance, 4).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ${assetSymbol}`}
              </p>
              {amount > 0 && amount < minAmount && (
                <p className="text-xs text-[var(--danger)] mt-1">
                  Minimum is {isBuy ? `$${minAmount}` : `${minAmount} ${assetSymbol}`}
                </p>
              )}
            </div>
          </>
        )}

        {/* Commit + outcomes */}
        {amount > 0 && (
          <>
            <div className="h-px bg-[var(--border)]" />
            <p className="text-sm text-[var(--text)]">
              You commit {commitDisplay} for {quote.expiry_days} days
            </p>

            {renderExtra ? (
              typeof renderExtra === "function" ? renderExtra(amount) : renderExtra
            ) : (
              <div className="space-y-1.5 text-sm">
                <p className="text-[var(--text-secondary)]">
                  <span className="text-[var(--text)]">If price hits ${quote.strike.toLocaleString()}:</span>{" "}
                  {isBuy
                    ? `You buy ${ethEquiv} ${assetSymbol} + keep ${premiumDisplay}`
                    : `You sell ${amount} ${assetSymbol} + keep ${premiumDisplay}`}
                </p>
                <p className="text-[var(--text-secondary)]">
                  <span className="text-[var(--text)]">If not:</span>{" "}
                  {isBuy
                    ? `${commitDisplay} back + keep ${premiumDisplay}`
                    : `${amount} ${assetSymbol} back + keep ${premiumDisplay}`}
                </p>
              </div>
            )}
          </>
        )}

        {amount > 0 && amount < minAmount && (
          <p className="text-sm text-[var(--danger)]">
            Minimum is {isBuy ? `$${minAmount}` : `${minAmount} ${assetSymbol}`}
          </p>
        )}

        {amount > maxAmount && (
          <p className="text-sm text-[var(--danger)]">
            Exceeds max trade size — enter {isBuy
              ? `$${maxAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
              : `${fmtAsset(maxAmount)} ${assetSymbol}`} or less.
          </p>
        )}

        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

        {(step === "preparing" || step === "executing") && (
          <div className="rounded-xl border border-[var(--accent)]/25 bg-[var(--accent)]/5 px-3 py-2 shadow-[0_0_24px_rgba(0,0,0,0.10)]">
            <div className="flex items-center gap-2 text-sm font-medium text-[var(--text)]">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent)] opacity-50" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />
              </span>
              <span>{progressMessage}</span>
            </div>
            <p className="mt-1 pl-4 text-xs text-[var(--text-secondary)]">
              {step === "preparing"
                ? "This normally takes a few seconds. No wallet confirmation is needed yet."
                : "This can take a few minutes. Keep this window open."}
            </p>
          </div>
        )}

        <button
          onClick={handleAccept}
          disabled={marketReadOnly || loading || amount < minAmount || amount > maxAmount}
          className="w-full rounded-xl bg-[var(--accent)] py-3.5 text-sm font-semibold text-[var(--bg)] hover:bg-[var(--accent-hover)] disabled:opacity-40 transition-colors"
        >
          {marketReadOnly ? "Coming soon" : buttonLabel}
        </button>

        {step === "confirmed" && chainExecuted && (
          <p className="text-center text-xs text-[var(--text-secondary)]">
            Executed on {chainExecuted === "solana" ? "Solana" : "Base"}
          </p>
        )}

        {step === "confirmed" && txHash && (
          <a
            href={
              chainExecuted === "solana"
                ? solanaTxUrl(txHash)
                : `${CHAIN.blockExplorers?.default.url}/tx/${txHash}`
            }
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center text-sm text-[var(--accent)] hover:underline"
          >
            View transaction ↗
          </a>
        )}
      </div>

        {showDeposit && (
          <DepositModal
            requiredToken={depositToken}
            onClose={() => setShowDeposit(false)}
            onComplete={() => setShowDeposit(false)}
          />
        )}
    </div>
  );
}
