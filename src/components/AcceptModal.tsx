"use client";

import { useState } from "react";
import {
  parseUnits,
  encodeFunctionData,
  maxUint256,
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
  onAccepted: (info: { amount: number }) => void;
  renderExtra?: React.ReactNode | ((amount: number) => React.ReactNode);
  initialAmount?: string;
  /** When true, hides amount input — modal becomes a confirmation screen. */
  confirmOnly?: boolean;
}

type TxStep = "idle" | "approving" | "executing" | "confirmed";

const PERCENTAGES = [25, 50, 75, 100] as const;

function computeAPR(premium: number, strike: number, expiryDays: number): number {
  return (premium / strike) * (365 / expiryDays) * 100;
}

export function AcceptModal({ quote, side, onClose, onAccepted, renderExtra, initialAmount, confirmOnly }: Props) {
  const { address, sendSponsoredTx, isConnected, login } = useWallet();
  const { usd, eth } = useBalances(address);
  const [step, setStep] = useState<TxStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [activePercent, setActivePercent] = useState<number | null>(null);

  const isBuy = side === "buy";
  const walletBalance = isBuy ? usd : eth;

  // Max capped by available capacity
  const maxAmount = isBuy
    ? quote.available_amount * quote.strike
    : quote.available_amount;

  // String state avoids leading-zero bug with controlled number inputs.
  const [amountStr, setAmountStr] = useState(initialAmount ?? "");
  const amount = Number(amountStr) || 0;


  function handlePercent(pct: number) {
    const raw = walletBalance * (pct / 100);
    setActivePercent(pct);
    if (isBuy) {
      setAmountStr(Math.floor(raw).toString());
    } else {
      setAmountStr(Number(raw.toFixed(4)).toString());
    }
  }

  const apr = computeAPR(quote.premium, quote.strike, quote.expiry_days);

  const ethEquiv = isBuy ? (amount / quote.strike).toFixed(2) : String(amount);

  // Earnings ALWAYS in USD
  const scaledPremium = isBuy
    ? (quote.premium * amount) / quote.strike
    : quote.premium * amount;

  const premiumDisplay = `$${scaledPremium.toFixed(0)}`;

  const commitDisplay = isBuy
    ? `$${amount.toLocaleString()}`
    : `${amount} ETH`;

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
    if (amount < minAmount) {
      const minLabel = isBuy ? `$${minAmount}` : `${minAmount} ETH`;
      setError(`Minimum amount is ${minLabel}.`);
      return;
    }
    if (amount > maxAmount) {
      const maxLabel = isBuy
        ? `$${maxAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
        : `${maxAmount.toFixed(2)} ETH`;
      setError(`Maximum available is ${maxLabel}.`);
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
        // Put: user commits USD. oTokenAmount in 8 dec, collateral in LUSD 6 dec.
        // Contract formula: collateral_6dec = (oTokenAmount_8dec * strikePrice_8dec) / 1e10
        const ethUnits = amount / quote.strike;
        oTokenAmount = parseUnits(ethUnits.toFixed(8), 8);
        const strikePrice8 = BigInt(Math.round(quote.strike * 1e8));
        collateral = (oTokenAmount * strikePrice8) / BigInt(1e10);
        collateralAsset = ADDRESSES.usdc;
      } else {
        // Call: user commits ETH. oTokenAmount in 8 dec, collateral in LETH 18 dec.
        // Contract formula: collateral_18dec = oTokenAmount_8dec * 1e10
        const formattedAmount = amount.toFixed(8);
        oTokenAmount = parseUnits(formattedAmount, 8);
        collateral = oTokenAmount * BigInt(1e10);
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

      // Poll on-chain until a condition is met (default: 2s interval, 60 attempts = ~120s timeout).
      // Tolerates transient RPC errors; aborts only after 5 consecutive failures.
      const pollUntil = async (
        check: () => Promise<boolean>,
        label: string,
        intervalMs = 2000,
        maxAttempts = 60,
      ) => {
        let consecutiveErrors = 0;
        for (let i = 0; i < maxAttempts; i++) {
          try {
            const done = await check();
            consecutiveErrors = 0;
            if (done) {
              console.log(`[AcceptModal] ${label} confirmed on-chain`);
              return;
            }
          } catch (err) {
            consecutiveErrors++;
            console.warn(`[AcceptModal] Poll check failed for ${label} (attempt ${i + 1}):`, err);
            if (consecutiveErrors >= 5) {
              throw new Error(`Lost connection while waiting for ${label}. Your transaction may still be processing — check your wallet before retrying.`);
            }
          }
          await new Promise((r) => setTimeout(r, intervalMs));
        }
        throw new Error(`Timed out waiting for ${label}`);
      };

      // Fire a tx and poll for on-chain confirmation simultaneously.
      // If the tx rejects immediately (user cancel, sponsorship fail), we catch it fast.
      // If polling confirms first, we ignore the tx promise resolution.
      const sendAndPoll = async (
        tx: { to: Address; data: `0x${string}` },
        check: () => Promise<boolean>,
        label: string,
      ) => {
        const txPromise = sendSponsoredTx(tx).then(() => "tx-resolved" as const);
        const pollPromise = pollUntil(check, label).then(() => "poll-confirmed" as const);
        const result = await Promise.race([txPromise, pollPromise]);
        if (result === "tx-resolved") {
          // Tx resolved but poll hasn't confirmed yet — keep waiting
          await pollPromise;
        } else {
          // Poll confirmed first — suppress any late tx rejection
          txPromise.catch(() => {});
        }
      };

      // Check allowance
      const currentAllowance = await publicClient.readContract({
        address: collateralAsset,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [address, ADDRESSES.marginPool],
      });

      // Approve if needed — use max approval so it's only needed once per token
      if (currentAllowance < collateral) {
        updateStep("approving");

        const approveData = encodeFunctionData({
          abi: ERC20_ABI,
          functionName: "approve",
          args: [ADDRESSES.marginPool, maxUint256],
        });
        await sendAndPoll(
          { to: collateralAsset, data: approveData },
          async () => {
            const a = await publicClient.readContract({
              address: collateralAsset, abi: ERC20_ABI, functionName: "allowance",
              args: [address, ADDRESSES.marginPool],
            });
            return a >= collateral;
          },
          "approve",
        );
      }

      // Approve oToken to BatchSettler (needed for safeTransferFrom in executeOrder)
      console.log("[AcceptModal] Checking oToken allowance...", { oTokenAddress, user: address, spender: ADDRESSES.batchSettler });
      const oTokenAllowance = await publicClient.readContract({
        address: oTokenAddress,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [address, ADDRESSES.batchSettler],
      });
      console.log("[AcceptModal] oToken allowance:", oTokenAllowance.toString(), "needed:", oTokenAmount.toString());

      if (oTokenAllowance < oTokenAmount) {
        console.log("[AcceptModal] Approving oToken to BatchSettler...");
        updateStep("approving");
        const oTokenApproveData = encodeFunctionData({
          abi: ERC20_ABI,
          functionName: "approve",
          args: [ADDRESSES.batchSettler, maxUint256],
        });
        await sendAndPoll(
          { to: oTokenAddress, data: oTokenApproveData },
          async () => {
            const a = await publicClient.readContract({
              address: oTokenAddress, abi: ERC20_ABI, functionName: "allowance",
              args: [address, ADDRESSES.batchSettler],
            });
            return a >= oTokenAmount;
          },
          "oToken-approve",
        );
      } else {
        console.log("[AcceptModal] oToken already approved, skipping");
      }

      // Execute order
      console.log("[AcceptModal] All approvals confirmed, executing order...");
      updateStep("executing");

      // Snapshot balance before executeOrder to detect when collateral is deducted
      const balanceBefore = await publicClient.readContract({
        address: collateralAsset,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [address],
      });

      const executeData = encodeFunctionData({
        abi: BATCH_SETTLER_ABI,
        functionName: "executeOrder",
        args: [oTokenAddress, oTokenAmount, collateral],
      });
      // Poll until balance decreases (collateral deducted)
      await sendAndPoll(
        { to: ADDRESSES.batchSettler, data: executeData },
        async () => {
          const bal = await publicClient.readContract({
            address: collateralAsset, abi: ERC20_ABI, functionName: "balanceOf",
            args: [address],
          });
          return bal < balanceBefore;
        },
        "executeOrder",
      );

      updateStep("confirmed");
      onAccepted({ amount });
      window.dispatchEvent(new Event("balance:refetch"));
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
            {isBuy ? "Buy" : "Sell"} ETH at ${quote.strike.toLocaleString()}/ETH
          </p>
          {amount > 0 && (
            <div className="mt-1 flex items-baseline gap-3">
              <p className="text-2xl font-bold text-[var(--accent)]">
                {premiumDisplay}
              </p>
              <p className="text-sm font-semibold text-[var(--text-secondary)]">
                {Math.round(apr)}% APR
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
                        ? "bg-[var(--accent)] text-white"
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
                {isBuy && <span className="text-[var(--text-secondary)]">$</span>}
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
                  className="flex-1 bg-transparent text-[var(--text)] font-semibold text-base focus:outline-none"
                />
                {!isBuy && <span className="text-sm text-[var(--text-secondary)]">ETH</span>}
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-1.5">
                Balance {isBuy
                  ? `$${walletBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                  : `${walletBalance.toFixed(2)} ETH`}
              </p>
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

            {/* Outcome cards (renderExtra) replace text outcomes when provided */}
            {renderExtra ? (
              typeof renderExtra === "function" ? renderExtra(amount) : renderExtra
            ) : (
              <div className="space-y-1.5 text-sm">
                <p className="text-[var(--text-secondary)]">
                  <span className="text-[var(--text)]">If price hits ${quote.strike.toLocaleString()}:</span>{" "}
                  {isBuy
                    ? `You buy ${ethEquiv} ETH + keep ${premiumDisplay}`
                    : `You sell ${amount} ETH + keep ${premiumDisplay}`}
                </p>
                <p className="text-[var(--text-secondary)]">
                  <span className="text-[var(--text)]">If not:</span>{" "}
                  {isBuy
                    ? `${commitDisplay} back + keep ${premiumDisplay}`
                    : `${amount} ETH back + keep ${premiumDisplay}`}
                </p>
              </div>
            )}
          </>
        )}

        {amount > maxAmount && (
          <p className="text-sm text-[var(--danger)]">
            Max available: {isBuy
              ? `$${maxAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
              : `${maxAmount.toFixed(2)} ETH`}
          </p>
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
