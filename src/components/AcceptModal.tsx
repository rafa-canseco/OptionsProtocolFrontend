"use client";

import { useState, useMemo, useEffect } from "react";
import {
  parseUnits,
  encodeFunctionData,
  type Address,
} from "viem";
import { useWallet } from "@/hooks/useWallet";
import { useBalances } from "@/hooks/useBalances";
import { publicClient, ADDRESSES, ERC20_ABI, BATCH_SETTLER_ABI } from "@/lib/contracts";
import type { PriceQuote } from "@/lib/api";

interface Props {
  quote: PriceQuote;
  side: "buy" | "sell";
  onClose: () => void;
  onAccepted: (txHash: string) => void;
}

type TxStep = "idle" | "approving" | "executing" | "confirmed";

const PERCENTAGES = [25, 50, 75, 100] as const;

function computeAPR(premium: number, strike: number, expiryDays: number): number {
  return (premium / strike) * (365 / expiryDays) * 100;
}

function untilDate(expiryDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + expiryDays);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function AcceptModal({ quote, side, onClose, onAccepted }: Props) {
  const { address, sendSponsoredTx, isConnected, login } = useWallet();
  const { usd, eth } = useBalances(address);
  const [step, setStep] = useState<TxStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [activePercent, setActivePercent] = useState<number>(100);

  const isBuy = side === "buy";
  const walletBalance = isBuy ? usd : eth;

  // Max capped by available capacity
  const maxAmount = isBuy
    ? quote.available_amount * quote.strike
    : quote.available_amount;

  // Compute amount from percentage
  function computeAmount(pct: number): number {
    const raw = walletBalance * (pct / 100);
    const value = Math.min(raw, maxAmount);
    return isBuy ? Math.floor(value) : Number(value.toFixed(4));
  }

  const [amount, setAmount] = useState(() => computeAmount(100));

  // Recalculate when balance loads (it's 0 initially, then populates)
  useEffect(() => {
    setAmount(computeAmount(activePercent));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletBalance]);

  function handlePercent(pct: number) {
    setActivePercent(pct);
    setAmount(computeAmount(pct));
  }

  const until = untilDate(quote.expiry_days);
  const apr = computeAPR(quote.premium, quote.strike, quote.expiry_days);
  const returnPct = (quote.premium / quote.strike) * 100;

  const ethEquiv = isBuy ? (amount / quote.strike).toFixed(2) : String(amount);

  // Earnings ALWAYS in USD
  const scaledPremium = isBuy
    ? (quote.premium * amount) / quote.strike
    : quote.premium * amount;

  const premiumDisplay = `$${scaledPremium.toFixed(0)}`;

  const commitDisplay = isBuy
    ? `$${amount.toLocaleString()}`
    : `${amount} ETH`;

  const cappedByMax = walletBalance * (activePercent / 100) > maxAmount;

  const contextText = useMemo(() => {
    if (isBuy) {
      return `If the price reaches $${quote.strike.toLocaleString()} by ${until}, you buy it. If it doesn't, your dollars come back. Either way, you keep the earnings.`;
    }
    return `If the price reaches $${quote.strike.toLocaleString()} by ${until}, you sell it at that price. If it doesn't, you keep your ETH. Either way, you keep the earnings.`;
  }, [isBuy, quote.strike, until]);

  const loading = step !== "idle";
  const buttonLabel =
    step === "approving"
      ? isBuy ? "Approving USD..." : "Approving ETH..."
      : step === "executing"
        ? "Executing order..."
        : step === "confirmed"
          ? "Done"
          : !isConnected
            ? "Connect wallet"
            : "Accept";

  const minAmount = isBuy ? 100 : 0.01;

  async function handleAccept() {
    if (!isConnected || !address) {
      login();
      return;
    }
    if (!quote.otoken_address) {
      setError("This option is not available on-chain yet.");
      return;
    }
    if (amount <= 0 || amount < minAmount || amount > maxAmount) {
      setError("Invalid amount.");
      return;
    }

    setError(null);
    const oTokenAddress = quote.otoken_address as Address;
    let currentStep = "idle" as TxStep;
    const updateStep = (s: TxStep) => { currentStep = s; setStep(s); };

    try {
      let oTokenAmount: bigint;
      let collateral: bigint;
      let collateralAsset: Address;

      if (isBuy) {
        const ethUnits = amount / quote.strike;
        oTokenAmount = parseUnits(ethUnits.toFixed(8), 8);
        collateral = parseUnits(amount.toFixed(6), 6);
        collateralAsset = ADDRESSES.usdc;
      } else {
        const formattedAmount = amount.toFixed(8);
        oTokenAmount = parseUnits(formattedAmount, 8);
        collateral = parseUnits(formattedAmount, 18);
        collateralAsset = ADDRESSES.weth;
      }

      // Check balance before sending tx
      const balance = await publicClient.readContract({
        address: collateralAsset,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [address],
      });
      if (balance < collateral) {
        const token = isBuy ? "USD" : "ETH";
        setError(`Insufficient ${token} balance.`);
        return;
      }

      // Check allowance
      const currentAllowance = await publicClient.readContract({
        address: collateralAsset,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [address, ADDRESSES.marginPool],
      });

      // Approve if needed — reset to 0 first (safe pattern for any ERC-20)
      if (currentAllowance < collateral) {
        updateStep("approving");
        if (currentAllowance > BigInt(0)) {
          const resetData = encodeFunctionData({
            abi: ERC20_ABI,
            functionName: "approve",
            args: [ADDRESSES.marginPool, BigInt(0)],
          });
          await sendSponsoredTx({ to: collateralAsset, data: resetData });
        }
        const approveData = encodeFunctionData({
          abi: ERC20_ABI,
          functionName: "approve",
          args: [ADDRESSES.marginPool, collateral],
        });
        await sendSponsoredTx({ to: collateralAsset, data: approveData });
      }

      // Execute order
      updateStep("executing");
      const executeData = encodeFunctionData({
        abi: BATCH_SETTLER_ABI,
        functionName: "executeOrder",
        args: [oTokenAddress, oTokenAmount, collateral],
      });
      const receipt = await sendSponsoredTx({ to: ADDRESSES.batchSettler, data: executeData });

      updateStep("confirmed");
      const txHash = typeof receipt === "object" && receipt !== null && "transactionHash" in receipt
        ? (receipt as { transactionHash: string }).transactionHash
        : String(receipt);
      onAccepted(txHash);
    } catch (err: unknown) {
      console.error("[AcceptModal] Transaction failed:", err);
      if (currentStep === "idle") {
        setError("Could not read on-chain data. Check your network connection and try again.");
      } else if (currentStep === "approving") {
        setError("Token approval failed. Please try again.");
      } else if (currentStep === "executing") {
        setError("Order execution failed. Your approval succeeded — try accepting again.");
      } else {
        setError("Transaction failed. Please try again.");
      }
      setStep("idle");
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
          <p className="text-lg font-semibold text-[var(--text)]">
            {isBuy ? "Buy" : "Sell"} ETH at ${quote.strike.toLocaleString()}
          </p>
          {amount > 0 && (
            <div className="mt-1">
              <span className="text-2xl font-bold text-[var(--accent)]">Earn {premiumDisplay}</span>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                {returnPct.toFixed(1)}% in {quote.expiry_days}d · {Math.round(apr)}% APR
              </p>
            </div>
          )}
        </div>

        {/* Contextual explanation */}
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
          {contextText}
        </p>

        {/* Percentage buttons — only control */}
        <div>
          <div className="grid grid-cols-4 gap-2">
            {PERCENTAGES.map((pct) => (
              <button
                key={pct}
                onClick={() => handlePercent(pct)}
                disabled={loading || walletBalance <= 0}
                className={`py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  activePercent === pct
                    ? "bg-[var(--accent)] text-white"
                    : "bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--border)]"
                } disabled:opacity-40`}
              >
                {pct}%
              </button>
            ))}
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-1.5">
            {isBuy
              ? `$${walletBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })} available`
              : `${walletBalance.toFixed(2)} ETH available`}
            {cappedByMax && (
              <span className="text-[var(--accent)]"> · Max {isBuy
                ? `$${maxAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                : `${maxAmount.toFixed(2)} ETH`}
              </span>
            )}
          </p>
        </div>

        {amount > 0 && <div className="h-px bg-[var(--border)]" />}

        {/* Commit + outcomes */}
        {amount > 0 && (
          <div className="space-y-2.5">
            <div className="flex justify-between items-center">
              <span className="text-sm text-[var(--text-secondary)]">You commit</span>
              <span className="text-sm font-medium text-[var(--text)]">{commitDisplay}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-[var(--text-secondary)]">Until</span>
              <span className="text-sm font-medium text-[var(--text)]">{until}</span>
            </div>
          </div>
        )}

        {amount > 0 && <div className="h-px bg-[var(--border)]" />}

        {/* Outcomes — compact */}
        {amount > 0 && (
          <div className="space-y-1.5 text-sm">
            <p className="text-[var(--text-secondary)]">
              <span className="text-[var(--text)]">If price hits:</span>{" "}
              {isBuy
                ? `You buy ${ethEquiv} ETH + keep ${premiumDisplay}`
                : `You sell ${amount} ETH + keep ${premiumDisplay}`}
            </p>
            <p className="text-[var(--text-secondary)]">
              <span className="text-[var(--text)]">If not:</span>{" "}
              {isBuy
                ? `$${amount.toLocaleString()} back + keep ${premiumDisplay}`
                : `${amount} ETH back + keep ${premiumDisplay}`}
            </p>
          </div>
        )}

        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

        <button
          onClick={handleAccept}
          disabled={loading || amount < minAmount || amount > maxAmount}
          className="w-full rounded-xl bg-[var(--accent)] py-3.5 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-40 transition-colors"
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}
