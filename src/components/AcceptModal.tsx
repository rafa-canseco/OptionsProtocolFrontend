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
import type { PriceQuote, Position } from "@/lib/api";
import { saveOptimistic } from "@/lib/optimisticPositions";

interface Props {
  quote: PriceQuote;
  side: "buy" | "sell";
  onClose: () => void;
  onAccepted: (info: { amount: number }) => void;
  renderExtra?: React.ReactNode | ((amount: number) => React.ReactNode);
  initialAmount?: string;
  confirmOnly?: boolean;
}

type TxStep = "idle" | "executing" | "confirmed";

const PERCENTAGES = [25, 50, 75, 100] as const;

function computeAPR(
  premium: number,
  strike: number,
  expiryDays: number,
): number {
  if (strike <= 0 || expiryDays <= 0) return 0;
  return (premium / strike) * (365 / expiryDays) * 100;
}

async function pollUntil(
  check: () => Promise<boolean>,
  label: string,
  intervalMs = 2000,
  maxAttempts = 60,
) {
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
      console.warn(
        `[AcceptModal] Poll failed for ${label} (attempt ${i + 1}):`,
        err,
      );
      if (consecutiveErrors >= 5) {
        throw new Error(
          "Lost connection while waiting for confirmation. " +
          "Your transaction may still be processing — " +
          "check your balance before retrying.",
        );
      }
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(
    "Timed out waiting for confirmation. " +
    "Your transaction may still be processing — " +
    "check your balance before retrying.",
  );
}

async function fireAndPoll(
  fire: () => Promise<unknown>,
  check: () => Promise<boolean>,
  label: string,
) {
  const txP = fire().then(() => "tx" as const);
  const pollP = pollUntil(check, label).then(() => "poll" as const);
  const winner = await Promise.race([txP, pollP]);
  if (winner === "tx") {
    await pollP;
  } else {
    txP.catch((err) => {
      console.warn(`[AcceptModal] tx rejected after poll confirmed (${label}):`, err);
    });
  }
}

function computeCollateral(
  isBuy: boolean,
  amount: number,
  strike: number,
): { oTokenAmount: bigint; collateral: bigint; collateralAsset: Address } {
  if (isBuy) {
    const ethUnits = amount / strike;
    const oTokenAmount = parseUnits(ethUnits.toFixed(8), 8);
    const strikePrice8 = BigInt(Math.round(strike * 1e8));
    const collateral = (oTokenAmount * strikePrice8) / BigInt(1e10);
    return { oTokenAmount, collateral, collateralAsset: ADDRESSES.usdc };
  }
  const oTokenAmount = parseUnits(amount.toFixed(8), 8);
  const collateral = oTokenAmount * BigInt(1e10);
  return { oTokenAmount, collateral, collateralAsset: ADDRESSES.weth };
}

function readTokenBalance(token: Address, account: Address) {
  return publicClient.readContract({
    address: token, abi: ERC20_ABI,
    functionName: "balanceOf", args: [account],
  });
}

function encodeExecuteOrder(
  quote: PriceQuote,
  oTokenAmount: bigint,
  collateral: bigint,
): `0x${string}` {
  const quoteTuple = {
    oToken: quote.otoken_address as Address,
    bidPrice: BigInt(quote.bid_price_raw!),
    deadline: BigInt(quote.deadline!),
    quoteId: BigInt(quote.quote_id!),
    maxAmount: BigInt(quote.max_amount_raw!),
    makerNonce: BigInt(quote.maker_nonce!),
  };
  return encodeFunctionData({
    abi: BATCH_SETTLER_ABI,
    functionName: "executeOrder",
    args: [quoteTuple, quote.signature! as `0x${string}`, oTokenAmount, collateral],
  });
}

function buildOptimisticPosition(
  quote: PriceQuote,
  amount: number,
  isBuy: boolean,
  address: Address,
): Position {
  const optOTokenAmt = isBuy
    ? (amount / quote.strike) * 1e8
    : amount * 1e8;
  const optCollateral = isBuy ? amount * 1e6 : amount * 1e18;
  const optPremium = isBuy
    ? String(((quote.premium * amount) / quote.strike) * 1e6)
    : String(quote.premium * amount * 1e6);
  return {
    id: "opt-" + Date.now(),
    tx_hash: "",
    block_number: 0,
    user_address: address,
    otoken_address: quote.otoken_address!,
    amount: optOTokenAmt,
    premium: optPremium,
    collateral: optCollateral,
    vault_id: null as unknown as number,
    strike_price: quote.strike * 1e8,
    expiry: quote.expires_at,
    is_put: isBuy,
    is_settled: false,
    settled_at: null,
    settlement_tx_hash: null,
    indexed_at: new Date().toISOString(),
    settlement_type: null,
    delivered_asset: null,
    delivered_amount: null,
    delivery_tx_hash: null,
    is_itm: null,
    expiry_price: null,
    gross_premium: optPremium,
    net_premium: optPremium,
    protocol_fee: "0",
    outcome: null,
  };
}

export function AcceptModal({ quote, side, onClose, onAccepted, renderExtra, initialAmount, confirmOnly }: Props) {
  const { address, sendBatchTx, isConnected, login } = useWallet();
  const { usd, eth } = useBalances(address);
  const [step, setStep] = useState<TxStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [activePercent, setActivePercent] = useState<number | null>(null);

  const isBuy = side === "buy";
  const walletBalance = isBuy ? usd : eth;

  const maxAmount = isBuy
    ? quote.available_amount * quote.strike
    : quote.available_amount;

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

  const scaledPremium = isBuy
    ? (quote.premium * amount) / quote.strike
    : quote.premium * amount;

  const premiumDisplay = `$${scaledPremium.toFixed(0)}`;

  const commitDisplay = isBuy
    ? `$${amount.toLocaleString()}`
    : `${amount} ETH`;

  const loading = step !== "idle";
  const buttonLabel =
    step === "executing"
      ? "Executing order..."
      : step === "confirmed"
        ? "Done"
        : !isConnected
          ? "Connect wallet"
          : "Accept";

  const minAmount = isBuy ? 100 : 0.01;

  async function handleAccept() {
    if (!isConnected || !address) { login(); return; }

    if (!quote.otoken_address || !quote.signature || !quote.bid_price_raw
        || !quote.deadline || !quote.quote_id || quote.max_amount_raw == null
        || quote.maker_nonce == null) {
      setError("This option is not available on-chain yet.");
      return;
    }

    if (amount < minAmount) {
      const label = isBuy ? `$${minAmount}` : `${minAmount} ETH`;
      setError(`Minimum amount is ${label}.`);
      return;
    }
    if (amount > maxAmount) {
      const label = isBuy
        ? `$${maxAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
        : `${maxAmount.toFixed(2)} ETH`;
      setError(`Maximum available is ${label}.`);
      return;
    }

    setError(null);
    let currentStep: TxStep = "idle";
    const updateStep = (s: TxStep) => { currentStep = s; setStep(s); };

    try {
      const { oTokenAmount, collateral, collateralAsset } =
        computeCollateral(isBuy, amount, quote.strike);

      const balance = await readTokenBalance(collateralAsset, address);
      if (balance < collateral) {
        setError(`Insufficient ${isBuy ? "USD" : "ETH"} balance.`);
        return;
      }

      const executeData = encodeExecuteOrder(quote, oTokenAmount, collateral);
      const currentAllowance = await publicClient.readContract({
        address: collateralAsset, abi: ERC20_ABI,
        functionName: "allowance", args: [address, ADDRESSES.marginPool],
      });

      updateStep("executing");

      const balanceBefore = await readTokenBalance(collateralAsset, address);
      const balanceDecreased = async () => {
        const bal = await readTokenBalance(collateralAsset, address);
        return bal < balanceBefore;
      };

      if (currentAllowance < collateral) {
        const approveData = encodeFunctionData({
          abi: ERC20_ABI,
          functionName: "approve",
          args: [ADDRESSES.marginPool, maxUint256],
        });
        await fireAndPoll(
          () => sendBatchTx([
            { to: collateralAsset, data: approveData },
            { to: ADDRESSES.batchSettler, data: executeData },
          ]),
          balanceDecreased,
          "batch-approve-execute",
        );
      } else {
        await fireAndPoll(
          () => sendBatchTx([
            { to: ADDRESSES.batchSettler, data: executeData },
          ]),
          balanceDecreased,
          "executeOrder",
        );
      }

      updateStep("confirmed");
      onAccepted({ amount });
      window.dispatchEvent(new Event("balance:refetch"));

      const pos = buildOptimisticPosition(quote, amount, isBuy, address);
      try { saveOptimistic(pos); } catch (err) {
        console.warn("[AcceptModal] Could not save optimistic position:", err);
      }
    } catch (err: unknown) {
      console.error("[AcceptModal] Transaction failed:", err);
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("Timed out") || msg.includes("Lost connection")) {
        setError(msg);
      } else if (currentStep === "idle") {
        setError("Could not read on-chain data. Check your connection and try again.");
      } else {
        setError("Transaction failed. No funds were moved. Please try again.");
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
          <p className="text-lg font-semibold text-[var(--bone)]">
            {isBuy ? "Buy" : "Sell"} ETH at ${quote.strike.toLocaleString()}/ETH
          </p>
          {amount > 0 && (
            <div className="mt-1 flex items-baseline gap-3">
              <p className="text-2xl font-bold text-[var(--accent)] font-mono">
                {premiumDisplay}
              </p>
              <p className="text-sm font-semibold text-[var(--accent)] font-mono">
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
          className="w-full rounded-xl bg-[var(--accent)] py-3.5 text-sm font-semibold text-[var(--bg)] hover:bg-[var(--accent-hover)] disabled:opacity-40 transition-colors"
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}
