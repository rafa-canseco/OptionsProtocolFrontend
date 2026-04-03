"use client";

import { useState } from "react";
import type { YieldPosition } from "@/lib/api";
import { ASSETS } from "@/lib/assets";

const ASSET_DECIMALS: Record<string, number> = {
  usdc: 6,
  eth: 18,
  btc: 8,
};

const INITIAL_SHOW = 5;

function assetLabel(slug: string): string {
  if (slug === "usdc") return "USDC";
  return ASSETS[slug]?.wrappedSymbol ?? slug.toUpperCase();
}

function fmtCollateral(raw: number, asset: string): string {
  const decimals = ASSET_DECIMALS[asset] ?? 18;
  const val = raw / 10 ** decimals;
  if (asset === "usdc") return `$${val.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  return val.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: asset === "btc" ? 6 : 4,
  });
}

function fmtDuration(start: string, end: string | null): string {
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  const days = Math.max(1, Math.round((e - s) / 86_400_000));
  return `${days}d`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

interface Props {
  positions: YieldPosition[];
}

export function YieldPositionsTable({ positions }: Props) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? positions : positions.slice(0, INITIAL_SHOW);
  const hasMore = positions.length > INITIAL_SHOW;

  if (positions.length === 0) return null;

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] overflow-hidden">
      <div className="px-5 py-3 border-b border-[var(--border)]">
        <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
          Yield-generating positions
        </h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[var(--text-secondary)] text-xs uppercase tracking-wider">
              <th className="text-left px-5 py-2.5 font-medium">Asset</th>
              <th className="text-left px-5 py-2.5 font-medium hidden sm:table-cell">
                Vault
              </th>
              <th className="text-right px-5 py-2.5 font-medium">
                Collateral
              </th>
              <th className="text-right px-5 py-2.5 font-medium hidden sm:table-cell">
                Deposited
              </th>
              <th className="text-right px-5 py-2.5 font-medium">Duration</th>
              <th className="text-right px-5 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((pos) => (
              <tr
                key={pos.id}
                className="border-t border-[var(--border)] hover:bg-[var(--surface)] transition-colors"
              >
                <td className="px-5 py-3 text-[var(--text)] font-medium">
                  {assetLabel(pos.asset)}
                </td>
                <td className="px-5 py-3 text-[var(--text-secondary)] font-mono hidden sm:table-cell">
                  #{pos.vault_id}
                </td>
                <td className="px-5 py-3 text-right text-[var(--text)] font-mono">
                  {fmtCollateral(pos.collateral_amount, pos.asset)}
                </td>
                <td className="px-5 py-3 text-right text-[var(--text-secondary)] hidden sm:table-cell">
                  {fmtDate(pos.deposited_at)}
                </td>
                <td className="px-5 py-3 text-right text-[var(--text-secondary)] font-mono">
                  {fmtDuration(pos.deposited_at, pos.settled_at)}
                </td>
                <td className="px-5 py-3 text-right">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        pos.is_active
                          ? "bg-[var(--accent)]"
                          : "bg-[var(--text-secondary)]"
                      }`}
                    />
                    <span
                      className={`text-xs ${
                        pos.is_active
                          ? "text-[var(--accent)]"
                          : "text-[var(--text-secondary)]"
                      }`}
                    >
                      {pos.is_active ? "Active" : "Settled"}
                    </span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hasMore && !showAll && (
        <div className="px-5 py-3 border-t border-[var(--border)]">
          <button
            onClick={() => setShowAll(true)}
            className="text-xs text-[var(--accent)] hover:underline"
          >
            Show all {positions.length} positions
          </button>
        </div>
      )}
    </div>
  );
}
