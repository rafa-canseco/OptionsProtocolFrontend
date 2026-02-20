"use client";

import type { Position } from "@/lib/api";

interface Props {
  positions: Position[];
}

export function PortfolioSummary({ positions }: Props) {
  const premiumEarned = positions.reduce((sum, p) => sum + Number(p.net_premium) / 1e6, 0);

  const activeCapital = positions
    .filter((p) => !p.is_settled)
    .reduce((sum, p) => {
      if (p.is_put) return sum + p.collateral / 1e6;
      return sum + (p.collateral / 1e18) * (p.strike_price / 1e8);
    }, 0);

  const totalCapital = positions.reduce((sum, p) => {
    if (p.is_put) return sum + p.collateral / 1e6;
    return sum + (p.collateral / 1e18) * (p.strike_price / 1e8);
  }, 0);

  const totalWeightedApr = positions.reduce((sum, p) => {
    const capital = p.is_put
      ? p.collateral / 1e6
      : (p.collateral / 1e18) * (p.strike_price / 1e8);
    const premium = Number(p.net_premium) / 1e6;
    const indexedTime = new Date(p.indexed_at).getTime();
    const days = Math.max(1, Math.round((p.expiry * 1000 - indexedTime) / 86_400_000));
    const apr = capital > 0 ? (premium / capital) * (365 / days) * 100 : 0;
    return sum + apr * capital;
  }, 0);
  const avgApr = totalCapital > 0 ? totalWeightedApr / totalCapital : 0;

  return (
    <div className="grid grid-cols-3 gap-4 rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-5">
      <div>
        <p className="text-xs text-[var(--text-secondary)]">Total Earned</p>
        <p className="text-xl font-bold text-[var(--accent)]">${premiumEarned.toFixed(0)}</p>
      </div>
      <div>
        <p className="text-xs text-[var(--text-secondary)]">Active Capital</p>
        <p className="text-xl font-bold text-[var(--text)]">
          ${activeCapital.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </p>
      </div>
      <div>
        <p className="text-xs text-[var(--text-secondary)]">Avg APR</p>
        <p className="text-xl font-bold text-[var(--text)]">{Math.round(avgApr)}%</p>
      </div>
    </div>
  );
}
