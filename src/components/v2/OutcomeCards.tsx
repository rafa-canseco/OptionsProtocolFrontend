"use client";

export function OutcomeCards({
  strike,
  premium,
  side,
  amount,
}: {
  strike: number;
  premium: number;
  side: "buy" | "sell";
  amount: number;
}) {
  const isBuy = side === "buy";
  const earnings = `$${Math.round(premium).toLocaleString()}`;
  const commitDisplay = isBuy ? `$${amount.toLocaleString()}` : `${amount} ETH`;
  const ethEquiv = isBuy ? (amount / strike).toFixed(2) : String(amount);

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* OTM outcome — collateral back + keep premium (the "good" one) */}
      <div className="rounded-xl bg-[var(--accent)]/8 border border-[var(--accent)]/20 p-4 space-y-2 relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-[var(--accent)]/10 blur-xl" />
        <div className="relative">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-5 h-5 rounded-full bg-[var(--accent)]/20 flex items-center justify-center">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 5.5L4 7.5L8 3" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <p className="text-[10px] font-semibold text-[var(--accent)] uppercase tracking-wider">
              Most likely
            </p>
          </div>
          <p className="text-xs text-[var(--text-secondary)]">
            {isBuy ? `Price stays above $${strike.toLocaleString()}` : `Price stays below $${strike.toLocaleString()}`}
          </p>
          <p className="text-sm font-semibold text-[var(--text)] mt-1.5">
            {commitDisplay} back
          </p>
          <p className="text-sm font-bold text-[var(--accent)] font-display">
            + keep {earnings}
          </p>
        </div>
      </div>

      {/* ITM outcome — order fills + keep premium */}
      <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-4 space-y-2">
        <div className="flex items-center gap-1.5 mb-1">
          <div className="w-5 h-5 rounded-full bg-[var(--border)] flex items-center justify-center">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M3 5H7" stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M5 3L7 5L5 7" stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <p className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
            If price moves
          </p>
        </div>
        <p className="text-xs text-[var(--text-secondary)]">
          {isBuy ? `Price drops below $${strike.toLocaleString()}` : `Price rises above $${strike.toLocaleString()}`}
        </p>
        <p className="text-sm font-semibold text-[var(--text)] mt-1.5">
          {isBuy ? `Buy ${ethEquiv} ETH` : `Sell ${amount} ETH`} at ${strike.toLocaleString()}
        </p>
        <p className="text-sm font-bold text-[var(--accent)] font-display">
          + keep {earnings}
        </p>
      </div>
    </div>
  );
}
