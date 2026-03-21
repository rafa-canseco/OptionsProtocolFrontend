"use client";

import { fmtUsd } from "@/lib/utils";

interface OutcomeCardsProps {
  side: "buy" | "sell";
  amount?: number;
  strike?: number;
  premium?: number;
  assetSymbol?: string;
}

export function OutcomeCards({
  side,
  amount,
  strike,
  premium,
  assetSymbol = "ETH",
}: OutcomeCardsProps) {
  const isBuy = side === "buy";
  const hasAmount = amount !== undefined && amount > 0;
  const hasStrike = strike !== undefined && strike > 0;
  const hasPremium = premium !== undefined && premium > 0;

  const otmDescription = hasStrike
    ? isBuy
      ? `Price stays above $${strike.toLocaleString()}`
      : `Price stays below $${strike.toLocaleString()}`
    : isBuy
      ? "Price stays above your strike"
      : "Price stays below your strike";

  const otmCommit = hasAmount
    ? isBuy
      ? `$${amount.toLocaleString()} back`
      : `${amount} ${assetSymbol} back`
    : "Your capital back";

  const otmEarnings = hasPremium
    ? `+ keep $${fmtUsd(premium)}`
    : "+ keep earnings";

  const itmDescription = hasStrike
    ? isBuy
      ? `Price drops below $${strike.toLocaleString()}`
      : `Price rises above $${strike.toLocaleString()}`
    : "Price hits your target";

  const itmAction = hasStrike && hasAmount
    ? isBuy
      ? `Buy ${(amount / strike).toFixed(2)} ${assetSymbol} at $${strike.toLocaleString()}`
      : `You sell your ${assetSymbol} for $${fmtUsd(amount * strike)} @ $${strike.toLocaleString()}/${assetSymbol}`
    : hasAmount
      ? isBuy
        ? `Buy ${assetSymbol} at your strike price`
        : `Sell ${amount} ${assetSymbol} at your strike price`
      : isBuy
        ? `Buy ${assetSymbol} at your price`
        : `Sell ${assetSymbol} at your price`;

  const itmEarnings = otmEarnings;

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* OTM outcome — collateral back + keep premium */}
      <div className="rounded-xl bg-[var(--accent)]/8 border border-[var(--accent)]/20 p-4 space-y-2 relative overflow-hidden">
        <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-[var(--accent)]/10 blur-xl" />
        <div className="relative">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-5 h-5 rounded-full bg-[var(--accent)]/20 flex items-center justify-center">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path
                  d="M2 5.5L4 7.5L8 3"
                  stroke="var(--accent)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <p className="text-[10px] font-semibold text-[var(--accent)] uppercase tracking-wider">
              {otmDescription}
            </p>
          </div>
          <p className="text-sm font-semibold text-[var(--text)] mt-1.5">
            {otmCommit}
          </p>
          <p className="text-sm font-bold text-[var(--accent)] font-mono">
            {otmEarnings}
          </p>
        </div>
      </div>

      {/* ITM outcome — order fills + keep premium */}
      <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-4 space-y-2">
        <div className="flex items-center gap-1.5 mb-1">
          <div className="w-5 h-5 rounded-full bg-[var(--border)] flex items-center justify-center">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path
                d="M3 5H7"
                stroke="var(--text-secondary)"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <path
                d="M5 3L7 5L5 7"
                stroke="var(--text-secondary)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <p className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
            {itmDescription}
          </p>
        </div>
        <p className="text-sm font-semibold text-[var(--text)] mt-1.5">
          {itmAction}
        </p>
        <p className="text-sm font-bold text-[var(--accent)] font-mono">
          {itmEarnings}
        </p>
      </div>
    </div>
  );
}
