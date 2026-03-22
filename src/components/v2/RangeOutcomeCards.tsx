"use client";

import { fmtUsd } from "@/lib/utils";

interface RangeOutcomeCardsProps {
  putStrike?: number;
  callStrike?: number;
  totalPremium?: number;
  putAmountUsd?: number;
  callAmountEth?: number;
  assetSymbol?: string;
}

export function RangeOutcomeCards({
  putStrike,
  callStrike,
  totalPremium,
  putAmountUsd,
  callAmountEth,
  assetSymbol = "ETH",
}: RangeOutcomeCardsProps) {
  const hasPremium = totalPremium !== undefined && totalPremium > 0;
  const hasStrikes = putStrike !== undefined && callStrike !== undefined;
  const premiumDisplay = hasPremium ? `+ keep $${fmtUsd(totalPremium)}` : "+ keep earnings";

  return (
    <div className="grid grid-cols-3 gap-2">
      {/* Below range — put assigned */}
      <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-3 space-y-1.5">
        <p className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
          {hasStrikes
            ? `If below $${putStrike.toLocaleString()}`
            : "If price drops"}
        </p>
        <p className="text-xs text-[var(--text-secondary)]">
          {hasStrikes
            ? `Buy ${assetSymbol} at $${putStrike.toLocaleString()}`
            : `Buy ${assetSymbol} at your price`}
        </p>
        <p className="text-xs font-bold text-[var(--accent)] font-mono">
          {premiumDisplay}
        </p>
      </div>

      {/* In range — both OTM, best case */}
      <div className="rounded-xl bg-[var(--accent)]/8 border border-[var(--accent)]/20 p-3 space-y-1.5 relative overflow-hidden">
        <div className="absolute -top-4 -right-4 w-14 h-14 rounded-full bg-[var(--accent)]/10 blur-xl" />
        <div className="relative">
          <p className="text-[10px] font-semibold text-[var(--accent)] uppercase tracking-wider">
            {hasStrikes
              ? `$${putStrike.toLocaleString()} – $${callStrike.toLocaleString()}`
              : "If price stays in range"}
          </p>
          <p className="text-xs text-[var(--text-secondary)]">
            No trade. All capital back.
          </p>
          <p className="text-xs font-bold text-[var(--accent)] font-mono">
            {premiumDisplay}
          </p>
        </div>
      </div>

      {/* Above range — call assigned */}
      <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-3 space-y-1.5">
        <p className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
          {hasStrikes
            ? `If above $${callStrike.toLocaleString()}`
            : "If price rises"}
        </p>
        <p className="text-xs text-[var(--text-secondary)]">
          {hasStrikes && callAmountEth
            ? `Sell ${callAmountEth.toFixed(2)} ${assetSymbol} at $${callStrike.toLocaleString()}`
            : `Sell ${assetSymbol} at your price`}
        </p>
        <p className="text-xs font-bold text-[var(--accent)] font-mono">
          {premiumDisplay}
        </p>
      </div>
    </div>
  );
}
