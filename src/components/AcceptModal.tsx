"use client";

import { useState, useMemo } from "react";
import {
  parseUnits,
  UserRejectedRequestError,
  WaitForTransactionReceiptTimeoutError,
  type Address,
  type Hash,
} from "viem";
import { useWallet } from "@/hooks/useWallet";
import { publicClient, ADDRESSES, ERC20_ABI, BATCH_SETTLER_ABI } from "@/lib/contracts";
import type { PriceQuote } from "@/lib/api";

interface Props {
  quote: PriceQuote;
  side: "buy" | "sell";
  onClose: () => void;
  onAccepted: (txHash: string) => void;
}

type TxStep = "idle" | "approving" | "executing" | "confirmed";

function computeAPR(premium: number, strike: number, expiryDays: number): number {
  return (premium / strike) * (365 / expiryDays) * 100;
}

function untilDate(expiryDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + expiryDays);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function AcceptModal({ quote, side, onClose, onAccepted }: Props) {
  const { address, walletClient, isConnected, login } = useWallet();
  const [step, setStep] = useState<TxStep>("idle");
  const [error, setError] = useState<string | null>(null);

  const isBuy = side === "buy";

  // Buy: amount in USD (default = strike). Sell: amount in ETH (default = 1).
  const [amount, setAmount] = useState(isBuy ? quote.strike : 1);

  const until = untilDate(quote.expiry_days);
  const apr = computeAPR(quote.premium, quote.strike, quote.expiry_days);

  // Buy: show ETH equivalent. Sell: show USD value.
  const equivalent = isBuy
    ? `${(amount / quote.strike).toFixed(2)} ETH`
    : `$${(amount * quote.spot).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  const ethEquiv = isBuy ? (amount / quote.strike).toFixed(2) : String(amount);

  // Earnings ALWAYS in USD
  const scaledPremium = isBuy
    ? (quote.premium * amount) / quote.strike
    : quote.premium * amount;

  const premiumDisplay = `$${scaledPremium.toFixed(0)}`;

  const commitDisplay = isBuy
    ? `$${amount.toLocaleString()}`
    : `${amount} ETH`;

  // Min / Max — max capped by available capacity
  const minAmount = isBuy ? 100 : 0.01;
  const maxAmount = isBuy
    ? quote.available_amount * quote.strike
    : quote.available_amount;
  const minLabel = isBuy ? `$${minAmount.toLocaleString()}` : `${minAmount} ETH`;
  const maxLabel = isBuy
    ? `$${maxAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
    : `${maxAmount.toFixed(2)} ETH`;

  const contextText = useMemo(() => {
    if (isBuy) {
      return `Choose the price you're happy to buy ETH at. If the price reaches $${quote.strike.toLocaleString()} by ${until}, you buy it. If it doesn't, your dollars come back. Either way, you keep the earnings.`;
    }
    return `Choose the price you're happy to sell ETH at. If the price reaches $${quote.strike.toLocaleString()} by ${until}, you sell it at that price. If it doesn't, you keep your ETH. Either way, you keep the earnings.`;
  }, [isBuy, quote.strike, until]);

  const loading = step !== "idle";
  const buttonLabel =
    step === "approving"
      ? isBuy ? "Approving USDC..." : "Approving WETH..."
      : step === "executing"
        ? "Executing order..."
        : step === "confirmed"
          ? "Done"
          : !isConnected
            ? "Connect wallet"
            : "Accept";

  async function handleAccept() {
    if (!isConnected || !address) {
      login();
      return;
    }
    if (!walletClient) {
      console.warn("[AcceptModal] walletClient is null despite isConnected=true");
      setError("Wallet provider failed to initialize. Try disconnecting and reconnecting.");
      return;
    }
    if (!quote.otoken_address) {
      console.warn("[AcceptModal] otoken_address is null but row was not disabled");
      setError("This option is not available on-chain yet.");
      return;
    }
    if (amount <= 0 || amount < minAmount || amount > maxAmount) {
      setError(`Amount must be between ${minLabel} and ${maxLabel}.`);
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
        const amountStr = amount.toFixed(8);
        oTokenAmount = parseUnits(amountStr, 8);
        collateral = parseUnits(amountStr, 18);
        collateralAsset = ADDRESSES.weth;
      }

      // Check balance before spending gas
      const balance = await publicClient.readContract({
        address: collateralAsset,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [address],
      });
      if (balance < collateral) {
        const token = isBuy ? "USDC" : "WETH";
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

      // Approve if needed — reset to 0 first (USDC requires this)
      if (currentAllowance < collateral) {
        updateStep("approving");
        if (currentAllowance > BigInt(0)) {
          const resetHash = await walletClient.writeContract({
            address: collateralAsset,
            abi: ERC20_ABI,
            functionName: "approve",
            args: [ADDRESSES.marginPool, BigInt(0)],
            account: address,
            chain: publicClient.chain,
          });
          const resetReceipt = await publicClient.waitForTransactionReceipt({ hash: resetHash as Hash });
          if (resetReceipt.status === "reverted") {
            setError("Approval reset reverted. Please try again.");
            setStep("idle");
            return;
          }
        }
        const approveHash = await walletClient.writeContract({
          address: collateralAsset,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [ADDRESSES.marginPool, collateral],
          account: address,
          chain: publicClient.chain,
        });
        const approveReceipt = await publicClient.waitForTransactionReceipt({ hash: approveHash as Hash });
        if (approveReceipt.status === "reverted") {
          setError("Token approval reverted on-chain.");
          setStep("idle");
          return;
        }
      }

      // Execute order
      updateStep("executing");
      const txHash = await walletClient.writeContract({
        address: ADDRESSES.batchSettler,
        abi: BATCH_SETTLER_ABI,
        functionName: "executeOrder",
        args: [oTokenAddress, oTokenAmount, collateral],
        account: address,
        chain: publicClient.chain,
      });
      const executeReceipt = await publicClient.waitForTransactionReceipt({ hash: txHash as Hash });
      if (executeReceipt.status === "reverted") {
        setError("Order reverted on-chain. The option may no longer be available.");
        setStep("idle");
        return;
      }

      updateStep("confirmed");
      onAccepted(txHash as string);
    } catch (err: unknown) {
      console.error("[AcceptModal] Transaction failed:", err);
      if (err instanceof UserRejectedRequestError) {
        setError("Transaction cancelled.");
      } else if (err instanceof WaitForTransactionReceiptTimeoutError && currentStep === "approving") {
        setError("Approval submitted but confirmation is taking longer than expected. Check your wallet before retrying.");
      } else if (err instanceof WaitForTransactionReceiptTimeoutError && currentStep === "executing") {
        setError("Transaction submitted but confirmation is taking longer than expected. Check your wallet or block explorer before retrying.");
      } else if (currentStep === "idle") {
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

        {/* Title */}
        <p className="text-lg font-semibold text-[var(--text)]">
          {isBuy ? "Buy" : "Sell"} ETH at ${quote.strike.toLocaleString()}
        </p>

        {/* Contextual explanation */}
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
          {contextText}
        </p>

        {/* Amount input */}
        <div>
          <label className="text-sm font-medium text-[var(--text)] mb-2 block">Amount</label>
          <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
            {isBuy && <span className="text-[var(--text-secondary)]">$</span>}
            <input
              type="number"
              value={amount}
              step={isBuy ? 100 : 0.1}
              disabled={loading}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (val >= 0) setAmount(val);
              }}
              className="flex-1 bg-transparent text-[var(--text)] font-semibold text-base focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="text-sm text-[var(--text-secondary)]">
              {isBuy ? equivalent : "ETH"}
            </span>
          </div>
          {!isBuy && (
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              ≈ {equivalent}
            </p>
          )}
          <p className="text-xs text-[var(--text-secondary)] mt-1.5">
            Min {minLabel} · Max {maxLabel}
          </p>
        </div>

        <div className="h-px bg-[var(--border)]" />

        {/* Summary */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-[var(--text-secondary)]">You earn</span>
            <div className="text-right">
              <span className="text-xl font-bold text-[var(--accent)]">{premiumDisplay}</span>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">{Math.round(apr)}% APR</p>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-[var(--text-secondary)]">Until</span>
            <span className="text-sm font-medium text-[var(--text)]">{until}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-[var(--text-secondary)]">You commit</span>
            <span className="text-sm font-medium text-[var(--text)]">{commitDisplay}</span>
          </div>
        </div>

        <div className="h-px bg-[var(--border)]" />

        {/* Explicit outcomes */}
        <div className="space-y-3">
          <div>
            <p className="text-sm text-[var(--text)]">
              If price hits ${quote.strike.toLocaleString()}:
            </p>
            <p className="text-sm text-[var(--text-secondary)]">
              {isBuy
                ? `You buy ${ethEquiv} ETH @ $${quote.strike.toLocaleString()} + keep ${premiumDisplay}`
                : `You sell ${amount} ETH @ $${quote.strike.toLocaleString()} + keep ${premiumDisplay}`}
            </p>
          </div>
          <div>
            <p className="text-sm text-[var(--text)]">
              If price doesn&apos;t hit:
            </p>
            <p className="text-sm text-[var(--text-secondary)]">
              {isBuy
                ? `$${amount.toLocaleString()} back + keep ${premiumDisplay}`
                : `${amount} ETH back + keep ${premiumDisplay}`}
            </p>
          </div>
        </div>

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
