"use client";

import { useState, useMemo } from "react";
import { useWallet } from "@/hooks/useWallet";
import { api, type PriceQuote } from "@/lib/api";

interface Props {
  quote: PriceQuote;
  side: "buy" | "sell";
  onClose: () => void;
  onAccepted: () => void;
}

function computeAPR(premium: number, strike: number, expiryDays: number): number {
  return (premium / strike) * (365 / expiryDays) * 100;
}

function untilDate(expiryDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + expiryDays);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function AcceptModal({ quote, side, onClose, onAccepted }: Props) {
  const { address, isConnected, login } = useWallet();
  const [loading, setLoading] = useState(false);
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

  // Min / Max
  const minAmount = isBuy ? 100 : 0.01;
  const maxAmount = isBuy ? quote.strike * 10 : 10;
  const minLabel = isBuy ? `$${minAmount.toLocaleString()}` : `${minAmount} ETH`;
  const maxLabel = isBuy ? `$${maxAmount.toLocaleString()}` : `${maxAmount} ETH`;

  const contextText = useMemo(() => {
    if (isBuy) {
      return `Choose the price you're happy to buy ETH at. If the price reaches $${quote.strike.toLocaleString()} by ${until}, you buy it. If it doesn't, your dollars come back. Either way, you keep the earnings.`;
    }
    return `Choose the price you're happy to sell ETH at. If the price reaches $${quote.strike.toLocaleString()} by ${until}, you sell it at that price. If it doesn't, you keep your ETH. Either way, you keep the earnings.`;
  }, [isBuy, quote.strike, until]);

  async function handleAccept() {
    if (!isConnected || !address) {
      login();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await api.acceptOrder({
        user_address: address,
        option_type: quote.option_type,
        strike: quote.strike,
        expiry_days: quote.expiry_days,
        premium: quote.premium,
        spot_at_lock: quote.spot,
        iv_at_lock: quote.iv,
      });
      onAccepted();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md bg-[var(--bg)] rounded-t-2xl sm:rounded-2xl border border-[var(--border)] p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Back button */}
        <button
          onClick={onClose}
          className="text-sm text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors"
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
          {loading ? "..." : !isConnected ? "Connect wallet" : "Accept"}
        </button>
      </div>
    </div>
  );
}
