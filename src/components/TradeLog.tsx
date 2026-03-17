"use client";

import { useState } from "react";
import Link from "next/link";
import type { Position } from "@/lib/api";
import { fmtUsd } from "@/lib/utils";
import { CHAIN } from "@/lib/contracts";

const EXPLORER_BASE = CHAIN.blockExplorers?.default.url ?? null;
const DEFAULT_VISIBLE = 5;

interface Props {
  positions: Position[];
  earnBase?: string;
}

export function TradeLog({ positions, earnBase = "/earn/eth" }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);

  const sorted = [...positions].sort((a, b) => {
    const tA = a.settled_at ? new Date(a.settled_at).getTime() : new Date(a.indexed_at).getTime();
    const tB = b.settled_at ? new Date(b.settled_at).getTime() : new Date(b.indexed_at).getTime();
    return tB - tA;
  });

  const visible = showAll ? sorted : sorted.slice(0, DEFAULT_VISIBLE);
  const hasMore = sorted.length > DEFAULT_VISIBLE;

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] text-[var(--text-secondary)] text-xs">
            <th className="text-left py-3 px-4 font-medium w-6"></th>
            <th className="text-left py-3 px-4 font-medium">Date</th>
            <th className="text-left py-3 px-4 font-medium">Type</th>
            <th className="text-right py-3 px-4 font-medium">Strike</th>
            <th className="text-right py-3 px-4 font-medium hidden sm:table-cell">Expiry</th>
            <th className="text-left py-3 px-4 font-medium">Outcome</th>
            <th className="text-right py-3 px-4 font-medium">Premium</th>
            <th className="text-right py-3 px-4 font-medium">Next Step</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((p) => (
            <TradeRow
              key={p.id}
              position={p}
              earnBase={earnBase}
              isExpanded={expanded.has(p.id)}
              onToggle={() => toggle(p.id)}
            />
          ))}
        </tbody>
      </table>

      {hasMore && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="w-full py-3 text-sm font-medium text-[var(--accent)] hover:bg-[var(--surface)] transition-colors border-t border-[var(--border)]"
        >
          Show all ({sorted.length})
        </button>
      )}
    </div>
  );
}

function TradeRow({
  position: p,
  earnBase,
  isExpanded,
  onToggle,
}: {
  position: Position;
  earnBase: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const isBuy = p.is_put;
  const isItm = p.is_itm === true;
  const strike = p.strike_price / 1e8;
  const premiumUsd = Number(p.net_premium) / 1e6;
  const ethAmount = p.amount / 1e8;
  const premiumPerEth = ethAmount > 0 ? premiumUsd / ethAmount : 0;

  // Date
  const date = new Date(p.indexed_at);
  const dateStr = `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;

  // Type
  const type = isBuy ? "Sell put" : "Sell call";

  // Expiry duration
  const indexedTime = date.getTime();
  const expiryDays = Math.max(1, Math.floor((p.expiry * 1000 - indexedTime) / 86_400_000));

  // Outcome
  const outcome = isItm ? "Assigned" : "Expired";

  // Cost basis + settlement price (for expanded detail)
  const costBasis = isBuy ? strike - premiumPerEth : strike + premiumPerEth;
  const expiryPriceUsd = p.expiry_price != null ? p.expiry_price / 1e8 : null;

  // Next step link
  let nextLabel: string;
  let nextSide: string;
  if (isItm) {
    nextLabel = isBuy ? "Sell call" : "Buy put";
    nextSide = isBuy ? "sell" : "buy";
  } else {
    nextLabel = "Earn again";
    nextSide = isBuy ? "buy" : "sell";
  }

  // Expanded detail
  const committedDisplay = isBuy
    ? `$${(p.collateral / 1e6).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
    : `${(p.collateral / 1e18).toFixed(2)} ETH`;

  const totalCols = 8;

  return (
    <>
      <tr
        onClick={onToggle}
        className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--surface)] cursor-pointer transition-colors"
      >
        {/* Chevron */}
        <td className="py-3 px-2 text-center text-[var(--text-secondary)]">
          <span className={`inline-block transition-transform duration-200 text-xs ${isExpanded ? "rotate-90" : ""}`}>
            &#9654;
          </span>
        </td>

        {/* Date */}
        <td className="py-3 px-4 font-mono text-[var(--text)]">{dateStr}</td>

        {/* Type */}
        <td className="py-3 px-4 text-[var(--text)]">{type}</td>

        {/* Strike */}
        <td className="py-3 px-4 text-right font-mono text-[var(--text)]">
          ${strike.toLocaleString()}
        </td>

        {/* Expiry */}
        <td className="py-3 px-4 text-right font-mono text-[var(--text-secondary)] hidden sm:table-cell">
          {expiryDays}d
        </td>

        {/* Outcome badge */}
        <td className="py-3 px-4">
          <span className="text-xs font-medium px-2 py-0.5 rounded-full text-[var(--accent)] bg-[var(--accent)]/10">
            {outcome}
          </span>
        </td>

        {/* Premium */}
        <td className="py-3 px-4 text-right font-mono text-[var(--accent)]">
          +${premiumUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </td>

        {/* Next Step */}
        <td className="py-3 px-4 text-right">
          <Link
            href={`${earnBase}?side=${nextSide}`}
            onClick={(e) => e.stopPropagation()}
            className="text-xs font-medium text-[var(--accent)] hover:underline"
          >
            {nextLabel} &rarr;
          </Link>
        </td>
      </tr>

      {/* Expanded detail */}
      {isExpanded && (
        <tr className="bg-[var(--surface)]">
          <td colSpan={totalCols} className="px-4 py-4">
            <div className="space-y-2 text-xs text-[var(--text-secondary)]">
              {isItm ? (
                <>
                  <p>
                    Cost basis: ${strike.toLocaleString()} {isBuy ? "−" : "+"} ${premiumPerEth.toLocaleString(undefined, { maximumFractionDigits: 0 })}/ETH premium ={" "}
                    <span className="font-mono font-medium text-[var(--text)]">${costBasis.toLocaleString(undefined, { maximumFractionDigits: 0 })}/ETH</span>
                  </p>
                  <p>
                    {isBuy ? "Bought" : "Sold"} {ethAmount.toFixed(2)} ETH
                    {expiryPriceUsd != null && (
                      <> · Settled at ${expiryPriceUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}/ETH</>
                    )}
                  </p>
                </>
              ) : (
                <p>
                  Committed {committedDisplay} &rarr; Returned {committedDisplay} +{" "}
                  <span className="font-mono font-medium text-[var(--accent)]">${fmtUsd(premiumUsd)} earned</span>
                </p>
              )}

              {p.tx_hash && EXPLORER_BASE && (
                <p>
                  TX:{" "}
                  <a
                    href={`${EXPLORER_BASE}/tx/${p.tx_hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-[var(--accent)] hover:underline"
                  >
                    {p.tx_hash.slice(0, 10)}...{p.tx_hash.slice(-6)}
                  </a>
                </p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
