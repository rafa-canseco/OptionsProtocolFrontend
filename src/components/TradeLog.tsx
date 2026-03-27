"use client";

import { useState } from "react";
import Link from "next/link";
import type { Position } from "@/lib/api";
import { fmtUsd, fmtAsset } from "@/lib/utils";
import { CHAIN } from "@/lib/contracts";
import { resolvePositionAsset } from "@/lib/assets";

const EXPLORER_BASE = CHAIN.blockExplorers?.default.url ?? null;
const DEFAULT_VISIBLE = 5;

type DisplayItem =
  | { type: "single"; position: Position }
  | { type: "range"; positions: Position[]; groupId: string };

interface Props {
  items: DisplayItem[];
}

export function TradeLog({ items }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);

  const sorted = [...items].sort((a, b) => {
    const getTime = (item: DisplayItem) => {
      if (item.type === "range") {
        const p = item.positions[0];
        return p.settled_at ? new Date(p.settled_at).getTime() : new Date(p.indexed_at).getTime();
      }
      const p = item.position;
      return p.settled_at ? new Date(p.settled_at).getTime() : new Date(p.indexed_at).getTime();
    };
    return getTime(b) - getTime(a);
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
            <th className="text-right py-3 px-4 font-medium hidden sm:table-cell">Maturity</th>
            <th className="text-left py-3 px-4 font-medium">Outcome</th>
            <th className="text-right py-3 px-4 font-medium">Premium</th>
            <th className="text-right py-3 px-4 font-medium">Next Step</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((item) => {
            if (item.type === "range") {
              return (
                <RangeTradeRow
                  key={item.groupId}
                  positions={item.positions}
                  groupId={item.groupId}
                  isExpanded={expanded.has(item.groupId)}
                  onToggle={() => toggle(item.groupId)}
                />
              );
            }
            return (
              <TradeRow
                key={item.position.id}
                position={item.position}
                isExpanded={expanded.has(item.position.id)}
                onToggle={() => toggle(item.position.id)}
              />
            );
          })}
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

function RangeTradeRow({
  positions,
  groupId: _groupId,
  isExpanded,
  onToggle,
}: {
  positions: Position[];
  groupId: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const putLeg = positions.find((p) => p.is_put);
  const callLeg = positions.find((p) => !p.is_put);
  if (!putLeg || !callLeg) return null;

  const posAsset = resolvePositionAsset(putLeg.asset, putLeg.strike_price);
  const assetSymbol = posAsset.symbol;
  const earnBase = `/earn/${posAsset.slug}`;

  const putStrike = putLeg.strike_price / 1e8;
  const callStrike = callLeg.strike_price / 1e8;

  const putPremium = Number(putLeg.net_premium) / 1e6;
  const callPremium = Number(callLeg.net_premium) / 1e6;
  const totalPremium = putPremium + callPremium;

  const date = new Date(putLeg.indexed_at);
  const dateStr = `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;

  const indexedTime = date.getTime();
  const expiryDays = Math.max(1, Math.floor((putLeg.expiry * 1000 - indexedTime) / 86_400_000));

  const expiryPriceUsd = putLeg.expiry_price != null ? putLeg.expiry_price / 1e8 : null;

  const putItm = putLeg.is_itm === true;
  const callItm = callLeg.is_itm === true;
  const outcome = putItm || callItm ? "Assigned" : "Earned";

  const totalCols = 9;

  return (
    <>
      <tr
        onClick={onToggle}
        className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--surface)] cursor-pointer transition-colors"
      >
        <td className="py-3 px-2 text-center text-[var(--text-secondary)]">
          <span className={`inline-block transition-transform duration-200 text-xs ${isExpanded ? "rotate-90" : ""}`}>
            &#9654;
          </span>
        </td>
        <td className="py-3 px-4 font-mono text-[var(--text)]">{dateStr}</td>
        <td className="py-3 px-4 text-[var(--text)]">Range</td>
        <td className="py-3 px-4 text-right font-mono text-[var(--text)]">
          ${putStrike.toLocaleString()} — ${callStrike.toLocaleString()}
        </td>
        <td className="py-3 px-4 text-right font-mono text-[var(--text-secondary)] hidden sm:table-cell">
          {expiryDays}d
        </td>
        <td className="py-3 px-4 text-right font-mono text-[var(--text-secondary)] hidden sm:table-cell">
          {expiryPriceUsd != null
            ? `$${expiryPriceUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
            : "—"}
        </td>
        <td className="py-3 px-4">
          <span className="text-xs font-medium px-2 py-0.5 rounded-full text-[var(--accent)] bg-[var(--accent)]/10">
            {outcome}
          </span>
        </td>
        <td className="py-3 px-4 text-right font-mono text-[var(--accent)]">
          +${fmtUsd(totalPremium)}
        </td>
        <td className="py-3 px-4 text-right">
          <Link
            href={`${earnBase}?side=range`}
            onClick={(e) => e.stopPropagation()}
            className="text-xs font-medium text-[var(--accent)] hover:underline"
          >
            Set range &rarr;
          </Link>
        </td>
      </tr>

      {isExpanded && (
        <tr className="bg-[var(--surface)]">
          <td colSpan={totalCols} className="px-4 py-4">
            <div className="space-y-2 text-xs text-[var(--text-secondary)]">
              <div className="flex justify-between">
                <span>Lower (buy at ${putStrike.toLocaleString()}): {putItm ? "Assigned" : "OTM"}</span>
                <span className="font-mono text-[var(--accent)]">+${fmtUsd(putPremium)}</span>
              </div>
              <div className="flex justify-between">
                <span>Upper (sell at ${callStrike.toLocaleString()}): {callItm ? "Assigned" : "OTM"}</span>
                <span className="font-mono text-[var(--accent)]">+${fmtUsd(callPremium)}</span>
              </div>
              {EXPLORER_BASE && (
                <div className="flex gap-3">
                  {putLeg.tx_hash && (
                    <a href={`${EXPLORER_BASE}/tx/${putLeg.tx_hash}`} target="_blank" rel="noopener noreferrer" className="font-mono text-[var(--accent)] hover:underline">
                      Lower tx
                    </a>
                  )}
                  {callLeg.tx_hash && (
                    <a href={`${EXPLORER_BASE}/tx/${callLeg.tx_hash}`} target="_blank" rel="noopener noreferrer" className="font-mono text-[var(--accent)] hover:underline">
                      Upper tx
                    </a>
                  )}
                  {(putLeg.settlement_tx_hash ?? callLeg.settlement_tx_hash) && (
                    <a
                      href={`${EXPLORER_BASE}/tx/${(putLeg.settlement_tx_hash ?? callLeg.settlement_tx_hash)!}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[var(--accent)] hover:underline"
                    >
                      Settle tx
                    </a>
                  )}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function TradeRow({
  position: p,
  isExpanded,
  onToggle,
}: {
  position: Position;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const posAsset = resolvePositionAsset(p.asset, p.strike_price);
  const assetSymbol = posAsset.symbol;
  const earnBase = `/earn/${posAsset.slug}`;
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

  // Expanded detail — call collateral decimals: WETH=18, WBTC=8
  const collateralDecimals = posAsset.slug === "btc" ? 1e8 : 1e18;
  const committedDisplay = isBuy
    ? `$${(p.collateral / 1e6).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
    : `${fmtAsset(p.collateral / collateralDecimals)} ${assetSymbol}`;

  const totalCols = 9;

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

        {/* Maturity price */}
        <td className="py-3 px-4 text-right font-mono text-[var(--text-secondary)] hidden sm:table-cell">
          {expiryPriceUsd != null
            ? `$${expiryPriceUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
            : "—"}
        </td>

        {/* Outcome badge */}
        <td className="py-3 px-4">
          <span className="text-xs font-medium px-2 py-0.5 rounded-full text-[var(--accent)] bg-[var(--accent)]/10">
            {outcome}
          </span>
        </td>

        {/* Premium */}
        <td className="py-3 px-4 text-right font-mono text-[var(--accent)]">
          +${fmtUsd(premiumUsd)}
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
                    Cost basis: ${strike.toLocaleString()} {isBuy ? "−" : "+"} ${premiumPerEth.toLocaleString(undefined, { maximumFractionDigits: 0 })}/{assetSymbol} premium ={" "}
                    <span className="font-mono font-medium text-[var(--text)]">${costBasis.toLocaleString(undefined, { maximumFractionDigits: 0 })}/{assetSymbol}</span>
                  </p>
                  <p>
                    {isBuy ? "Bought" : "Sold"} {fmtAsset(ethAmount)} {assetSymbol}
                  </p>
                </>
              ) : (
                <>
                  <p>
                    Committed {committedDisplay} &rarr; Returned {committedDisplay} +{" "}
                    <span className="font-mono font-medium text-[var(--accent)]">${fmtUsd(premiumUsd)} earned</span>
                  </p>
                  {expiryPriceUsd != null && (
                    <p>Maturity price: ${expiryPriceUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}/{assetSymbol}</p>
                  )}
                </>
              )}

              {EXPLORER_BASE && (
                <div className="flex gap-3">
                  {p.tx_hash && (
                    <a href={`${EXPLORER_BASE}/tx/${p.tx_hash}`} target="_blank" rel="noopener noreferrer" className="font-mono text-[var(--accent)] hover:underline">
                      Open tx
                    </a>
                  )}
                  {p.settlement_tx_hash && (
                    <a href={`${EXPLORER_BASE}/tx/${p.settlement_tx_hash}`} target="_blank" rel="noopener noreferrer" className="font-mono text-[var(--accent)] hover:underline">
                      Settle tx
                    </a>
                  )}
                  {p.delivery_tx_hash && (
                    <a href={`${EXPLORER_BASE}/tx/${p.delivery_tx_hash}`} target="_blank" rel="noopener noreferrer" className="font-mono text-[var(--accent)] hover:underline">
                      Delivery tx
                    </a>
                  )}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
