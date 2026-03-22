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
  const premiumText = hasPremium ? `$${fmtUsd(totalPremium)} earned` : "keep earnings";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
      {/* Below range — end up holding ETH */}
      <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-4 space-y-2">
        <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
          {hasStrikes
            ? `Below $${putStrike.toLocaleString()}`
            : "If price drops"}
        </p>
        <p className="text-sm text-[var(--text)]">
          You end up holding {assetSymbol}
        </p>
        <p className="text-xs text-[var(--text-secondary)]">
          {hasStrikes
            ? `Bought at $${putStrike.toLocaleString()}`
            : `Bought at your lower price`}
        </p>
        <p className="text-sm font-bold text-[var(--accent)] font-mono">
          + {premiumText}
        </p>
      </div>

      {/* In range — best case, everything back */}
      <div className="rounded-xl bg-[var(--accent)]/8 border border-[var(--accent)]/20 p-4 space-y-2 relative overflow-hidden">
        <div className="absolute -top-4 -right-4 w-14 h-14 rounded-full bg-[var(--accent)]/10 blur-xl" />
        <div className="relative">
          <p className="text-xs font-semibold text-[var(--accent)] uppercase tracking-wider">
            {hasStrikes
              ? `$${putStrike.toLocaleString()} – $${callStrike.toLocaleString()}`
              : "Stays in range"}
          </p>
          <p className="text-sm text-[var(--text)]">
            Everything back
          </p>
          <p className="text-xs text-[var(--text-secondary)]">
            No trade happened
          </p>
          <p className="text-sm font-bold text-[var(--accent)] font-mono">
            + {premiumText}
          </p>
        </div>
      </div>

      {/* Above range — end up holding USDC */}
      <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-4 space-y-2">
        <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
          {hasStrikes
            ? `Above $${callStrike.toLocaleString()}`
            : "If price rises"}
        </p>
        <p className="text-sm text-[var(--text)]">
          You end up holding USDC
        </p>
        <p className="text-xs text-[var(--text-secondary)]">
          {hasStrikes
            ? `Sold ${assetSymbol} at $${callStrike.toLocaleString()}`
            : `Sold at your upper price`}
        </p>
        <p className="text-sm font-bold text-[var(--accent)] font-mono">
          + {premiumText}
        </p>
      </div>
    </div>
  );
}
