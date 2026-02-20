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
      {/* OTM outcome — collateral back + keep premium */}
      <div className="rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 p-3.5 space-y-1.5">
        <p className="text-xs font-medium text-[var(--accent)]">
          {isBuy ? `Price stays above $${strike.toLocaleString()}` : `Price stays below $${strike.toLocaleString()}`}
        </p>
        <p className="text-sm font-semibold text-[var(--text)]">
          {commitDisplay} back
        </p>
        <p className="text-sm font-bold text-[var(--accent)]">
          + keep {earnings}
        </p>
      </div>

      {/* ITM outcome — order fills + keep premium */}
      <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-3.5 space-y-1.5">
        <p className="text-xs font-medium text-[var(--text-secondary)]">
          {isBuy ? `Price drops below $${strike.toLocaleString()}` : `Price rises above $${strike.toLocaleString()}`}
        </p>
        <p className="text-sm font-semibold text-[var(--text)]">
          {isBuy ? `Buy ${ethEquiv} ETH` : `Sell ${amount} ETH`} at ${strike.toLocaleString()}
        </p>
        <p className="text-sm font-bold text-[var(--accent)]">
          + keep {earnings}
        </p>
      </div>
    </div>
  );
}
