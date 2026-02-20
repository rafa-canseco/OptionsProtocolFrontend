"use client";

import type { Position } from "@/lib/api";

interface AssetRow {
  asset: string;
  qty: number;
  avgCostBasis: number;
  currentPrice: number;
  value: number;
  totalPnl: number;
  premiumEarned: number;
}

interface Props {
  positions: Position[];
  spot?: number;
}

export function PortfolioSummary({ positions, spot }: Props) {
  const premiumEarned = positions.reduce((sum, p) => sum + Number(p.net_premium) / 1e6, 0);

  // Aggregate assigned positions by asset to build portfolio rows
  const assetRows = buildAssetRows(positions, spot);
  const hasPortfolio = assetRows.length > 0 && assetRows.some((r) => r.qty > 0);

  // Fallback: 3-stat cards when net qty <= 0
  if (!hasPortfolio) {
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

  // Portfolio table
  const totals = assetRows.reduce(
    (acc, r) => ({
      value: acc.value + r.value,
      totalPnl: acc.totalPnl + r.totalPnl,
      premiumEarned: acc.premiumEarned + r.premiumEarned,
    }),
    { value: 0, totalPnl: 0, premiumEarned: 0 },
  );

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] text-[var(--text-secondary)] text-xs">
            <th className="text-left py-3 px-4 font-medium">Asset</th>
            <th className="text-right py-3 px-4 font-medium">Qty</th>
            <th className="text-right py-3 px-4 font-medium hidden sm:table-cell">Avg Cost</th>
            <th className="text-right py-3 px-4 font-medium hidden sm:table-cell">Price</th>
            <th className="text-right py-3 px-4 font-medium">Value</th>
            <th className="text-right py-3 px-4 font-medium">P&L</th>
            <th className="text-right py-3 px-4 font-medium hidden md:table-cell">Premium</th>
          </tr>
        </thead>
        <tbody>
          {assetRows.map((row) => (
            <tr key={row.asset} className="border-b border-[var(--border)] last:border-b-0">
              <td className="py-3 px-4 font-semibold text-[var(--text)]">{row.asset}</td>
              <td className="py-3 px-4 text-right font-mono text-[var(--text)]">
                {row.qty.toFixed(2)}
              </td>
              <td className="py-3 px-4 text-right font-mono text-[var(--text)] hidden sm:table-cell">
                ${row.avgCostBasis.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </td>
              <td className="py-3 px-4 text-right font-mono text-[var(--text)] hidden sm:table-cell">
                ${row.currentPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </td>
              <td className="py-3 px-4 text-right font-mono text-[var(--text)]">
                ${row.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </td>
              <td className={`py-3 px-4 text-right font-mono font-semibold ${row.totalPnl >= 0 ? "text-[var(--accent)]" : "text-[var(--danger)]"}`}>
                {row.totalPnl >= 0 ? "+" : ""}${row.totalPnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </td>
              <td className="py-3 px-4 text-right font-mono text-[var(--accent)] hidden md:table-cell">
                +${row.premiumEarned.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-[var(--border)] bg-[var(--surface)]">
            <td className="py-3 px-4 font-semibold text-[var(--text-secondary)] text-xs" colSpan={4}>
              <span className="sm:hidden">Total</span>
              <span className="hidden sm:inline">Total</span>
            </td>
            <td className="py-3 px-4 text-right font-mono font-semibold text-[var(--text)]">
              ${totals.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </td>
            <td className={`py-3 px-4 text-right font-mono font-semibold ${totals.totalPnl >= 0 ? "text-[var(--accent)]" : "text-[var(--danger)]"}`}>
              {totals.totalPnl >= 0 ? "+" : ""}${totals.totalPnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </td>
            <td className="py-3 px-4 text-right font-mono font-semibold text-[var(--accent)] hidden md:table-cell">
              +${totals.premiumEarned.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function buildAssetRows(positions: Position[], spot?: number): AssetRow[] {
  // For now only ETH. Aggregate assigned (ITM settled) positions.
  // Put assigned → user bought ETH (+qty)
  // Call assigned → user sold ETH (-qty)
  const assigned = positions.filter((p) => p.is_settled && (p.is_itm === true));

  let totalQty = 0;
  let totalCost = 0; // sum of (qty * costBasis) for weighted average

  for (const p of assigned) {
    const ethAmount = p.amount / 1e8;
    const strike = p.strike_price / 1e8;
    const premiumUsd = Number(p.net_premium) / 1e6;
    const premiumPerEth = ethAmount > 0 ? premiumUsd / ethAmount : 0;

    if (p.is_put) {
      // Bought ETH
      const costBasis = strike - premiumPerEth;
      totalQty += ethAmount;
      totalCost += ethAmount * costBasis;
    } else {
      // Sold ETH
      totalQty -= ethAmount;
      totalCost -= ethAmount * (strike + premiumPerEth);
    }
  }

  // Net qty <= 0 → no portfolio row
  if (totalQty <= 0) return [];

  const avgCostBasis = totalQty > 0 ? totalCost / totalQty : 0;
  const currentPrice = spot ?? 0;
  const value = totalQty * currentPrice;
  const totalPnl = totalQty * (currentPrice - avgCostBasis);

  // Premium earned across ALL positions (not just assigned)
  const premiumEarned = positions.reduce((sum, p) => sum + Number(p.net_premium) / 1e6, 0);

  return [
    {
      asset: "ETH",
      qty: totalQty,
      avgCostBasis,
      currentPrice,
      value,
      totalPnl,
      premiumEarned,
    },
  ];
}
