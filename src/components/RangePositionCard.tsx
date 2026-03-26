"use client";

import { useState } from "react";
import Link from "next/link";
import type { Position } from "@/lib/api";
import { fmtUsd, buildCalendarUrl } from "@/lib/utils";
import { CHAIN } from "@/lib/contracts";
import { ExpiryCountdown } from "./ExpiryCountdown";
import type { YieldMetric } from "./YieldToggle";

const EXPLORER = CHAIN.blockExplorers?.default.url ?? null;

interface Props {
  positions: Position[];
  spot?: number;
  earnBase?: string;
  optimistic?: boolean;
  yieldMetric?: YieldMetric;
  assetSymbol?: string;
  assetSlug?: string;
}

export function RangePositionCard({
  positions,
  spot,
  earnBase = "/earn/eth",
  optimistic,
  yieldMetric = "apr",
  assetSymbol = "ETH",
  assetSlug = "eth",
}: Props) {
  const [expanded, setExpanded] = useState(false);

  const putLeg = positions.find((p) => p.is_put);
  const callLeg = positions.find((p) => !p.is_put);
  if (!putLeg || !callLeg) return null;

  const putStrike = putLeg.strike_price / 1e8;
  const callStrike = callLeg.strike_price / 1e8;
  const isActive = !putLeg.is_settled && !callLeg.is_settled;
  const isSettled = putLeg.is_settled && callLeg.is_settled;

  // Combined premium
  const putPremium = Number(putLeg.net_premium) / 1e6;
  const callPremium = Number(callLeg.net_premium) / 1e6;
  const totalPremium = putPremium + callPremium;

  // Combined committed capital (both sides in USD)
  const isBtc = assetSlug === "btc";
  const callDec = isBtc ? 1e8 : 1e18;
  const putCommittedUsd = putLeg.collateral / 1e6;
  const callCommittedUsd = (callLeg.collateral / callDec) * callStrike;
  const totalCommittedUsd = putCommittedUsd + callCommittedUsd;

  // ROI / APR
  const indexedTime = new Date(putLeg.indexed_at).getTime();
  const expiryTime = putLeg.expiry * 1000;
  const totalDays = Math.max(
    1,
    Math.floor((expiryTime - indexedTime) / 86_400_000),
  );
  const returnPct =
    totalCommittedUsd > 0
      ? (totalPremium / totalCommittedUsd) * 100
      : 0;
  const apr =
    totalCommittedUsd > 0
      ? (totalPremium / totalCommittedUsd) * (365 / totalDays) * 100
      : 0;
  const yieldValue = yieldMetric === "apr" ? apr : returnPct;
  const yieldLabel = yieldMetric === "apr" ? "APR" : "ROI";

  // Settled state
  const putItm = putLeg.is_itm ?? false;
  const callItm = callLeg.is_itm ?? false;

  // Distance to range bounds
  const putDistPct = spot
    ? ((putStrike - spot) / spot) * 100
    : null;
  const callDistPct = spot
    ? ((callStrike - spot) / spot) * 100
    : null;

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-5 space-y-3">
      {/* ── ACTIVE RANGE ── */}
      {isActive && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[var(--accent)] bg-[var(--accent)]/10 px-2 py-0.5 rounded-full">
                Range
              </span>
              <p className="text-base font-semibold text-[var(--bone)]">
                <span className="font-mono">
                  ${putStrike.toLocaleString()}
                </span>
                {" — "}
                <span className="font-mono">
                  ${callStrike.toLocaleString()}
                </span>
              </p>
            </div>
            {optimistic && (
              <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)]">
                <span className="h-2 w-2 rounded-full bg-[var(--accent)] animate-pulse" />
                Confirming...
              </span>
            )}
          </div>

          <p className="text-lg font-bold text-[var(--bone)]">
            <ExpiryCountdown expiryTimestamp={putLeg.expiry} />
          </p>

          <p className="text-base font-bold font-mono text-[var(--accent)]">
            ${fmtUsd(totalPremium)} earned
            <span className="text-sm font-normal text-[var(--text-secondary)] ml-2">
              {yieldValue < 10
                ? yieldValue.toFixed(1)
                : Math.round(yieldValue)}
              % {yieldLabel}
            </span>
          </p>

          {/* Range bar */}
          {spot != null && (
            <div className="space-y-1">
              <div className="relative h-2 rounded-full bg-[var(--surface)] overflow-hidden">
                <RangeBar
                  putStrike={putStrike}
                  callStrike={callStrike}
                  spot={spot}
                />
              </div>
              <div className="flex justify-between text-xs text-[var(--text-secondary)] font-mono">
                <span>
                  ${putStrike.toLocaleString()}
                  {putDistPct != null && (
                    <span className="ml-1">
                      ({putDistPct > 0 ? "+" : ""}
                      {putDistPct.toFixed(1)}%)
                    </span>
                  )}
                </span>
                <span>
                  ${callStrike.toLocaleString()}
                  {callDistPct != null && (
                    <span className="ml-1">
                      (+{callDistPct!.toFixed(1)}%)
                    </span>
                  )}
                </span>
              </div>
            </div>
          )}

          <p className="text-xs text-[var(--text-secondary)]">
            Committed ${totalCommittedUsd.toLocaleString(undefined, {
              maximumFractionDigits: 0,
            })}
          </p>

          {/* Expandable leg details */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors cursor-pointer"
          >
            {expanded ? "Hide details ▴" : "Show details ▾"}
          </button>

          {expanded && (
            <div className="space-y-2 text-xs text-[var(--text-secondary)] border-t border-[var(--border)] pt-2">
              <div className="flex justify-between">
                <span>
                  Lower (buy at ${putStrike.toLocaleString()})
                </span>
                <span className="font-mono text-[var(--accent)]">
                  ${fmtUsd(putPremium)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>
                  Upper (sell at ${callStrike.toLocaleString()})
                </span>
                <span className="font-mono text-[var(--accent)]">
                  ${fmtUsd(callPremium)}
                </span>
              </div>
              {EXPLORER && (
                <div className="flex gap-3">
                  {putLeg.tx_hash && (
                    <a
                      href={`${EXPLORER}/tx/${putLeg.tx_hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--accent)] hover:underline"
                    >
                      Lower tx
                    </a>
                  )}
                  {callLeg.tx_hash && (
                    <a
                      href={`${EXPLORER}/tx/${callLeg.tx_hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--accent)] hover:underline"
                    >
                      Upper tx
                    </a>
                  )}
                </div>
              )}
            </div>
          )}

          <a
            href={buildCalendarUrl(
              putLeg,
              assetSymbol,
              assetSlug,
              `b1nary: ${assetSymbol} range expiry ($${putStrike.toLocaleString("en-US")}–$${callStrike.toLocaleString("en-US")})`,
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors"
          >
            📅 Add to calendar
          </a>
        </>
      )}

      {/* ── SETTLED RANGE ── */}
      {isSettled && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[var(--accent)] bg-[var(--accent)]/10 px-2 py-0.5 rounded-full">
                Range
              </span>
              <p className="text-base font-semibold text-[var(--bone)]">
                <span className="font-mono">
                  ${putStrike.toLocaleString()}
                </span>
                {" — "}
                <span className="font-mono">
                  ${callStrike.toLocaleString()}
                </span>
              </p>
            </div>
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                !putItm && !callItm
                  ? "text-[var(--accent)] bg-[var(--accent)]/10"
                  : "text-amber-400 bg-amber-400/10"
              }`}
            >
              {!putItm && !callItm
                ? "Earned"
                : "Assigned"}
            </span>
          </div>

          {/* Outcome message */}
          {!putItm && !callItm && (
            <p className="text-sm text-[var(--text)]">
              Stayed in range. Everything returned +{" "}
              <span className="text-[var(--accent)] font-semibold font-mono">
                ${fmtUsd(totalPremium)} earned
              </span>
            </p>
          )}
          {putItm && (
            <p className="text-sm text-[var(--text)]">
              Price dropped below range. You bought {assetSymbol} at{" "}
              <span className="font-mono">
                ${putStrike.toLocaleString()}
              </span>
            </p>
          )}
          {callItm && (
            <p className="text-sm text-[var(--text)]">
              Price rose above range. You sold {assetSymbol} at{" "}
              <span className="font-mono">
                ${callStrike.toLocaleString()}
              </span>
            </p>
          )}

          <p className="text-xs text-[var(--text-secondary)]">
            {returnPct.toFixed(1)}% in {totalDays}d ·{" "}
            {yieldValue < 10
              ? yieldValue.toFixed(1)
              : Math.round(yieldValue)}
            % {yieldLabel}
          </p>

          {/* Expandable leg details */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors cursor-pointer"
          >
            {expanded ? "Hide details ▴" : "Show details ▾"}
          </button>

          {expanded && (
            <div className="space-y-2 text-xs text-[var(--text-secondary)] border-t border-[var(--border)] pt-2">
              <div className="flex justify-between">
                <span>
                  Lower: {putItm ? "Assigned" : "OTM"} — buy at $
                  {putStrike.toLocaleString()}
                </span>
                <span className="font-mono text-[var(--accent)]">
                  ${fmtUsd(putPremium)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>
                  Upper: {callItm ? "Assigned" : "OTM"} — sell at $
                  {callStrike.toLocaleString()}
                </span>
                <span className="font-mono text-[var(--accent)]">
                  ${fmtUsd(callPremium)}
                </span>
              </div>
              {EXPLORER && (
                <div className="flex gap-3">
                  {putLeg.tx_hash && (
                    <a
                      href={`${EXPLORER}/tx/${putLeg.tx_hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--accent)] hover:underline"
                    >
                      Lower tx
                    </a>
                  )}
                  {callLeg.tx_hash && (
                    <a
                      href={`${EXPLORER}/tx/${callLeg.tx_hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--accent)] hover:underline"
                    >
                      Upper tx
                    </a>
                  )}
                </div>
              )}
            </div>
          )}

          <Link
            href={`${earnBase}?side=range`}
            className="block w-full text-center rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 py-3 text-sm font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/20 transition-colors"
          >
            Set another range
          </Link>
        </div>
      )}
    </div>
  );
}

function RangeBar({
  putStrike,
  callStrike,
  spot,
}: {
  putStrike: number;
  callStrike: number;
  spot: number;
}) {
  const margin = (callStrike - putStrike) * 0.3;
  const min = putStrike - margin;
  const max = callStrike + margin;
  const range = max - min || 1;
  const leftPct = ((putStrike - min) / range) * 100;
  const rightPct = ((callStrike - min) / range) * 100;
  const spotPct = Math.max(0, Math.min(100, ((spot - min) / range) * 100));
  const inRange = spot >= putStrike && spot <= callStrike;

  return (
    <>
      {/* Range zone */}
      <div
        className="absolute top-0 bottom-0 bg-[var(--accent)]/20 rounded-full"
        style={{ left: `${leftPct}%`, width: `${rightPct - leftPct}%` }}
      />
      {/* Spot marker */}
      <div
        className={`absolute top-[-2px] w-1.5 h-[calc(100%+4px)] rounded-full ${
          inRange ? "bg-[var(--accent)]" : "bg-[var(--text-secondary)]"
        }`}
        style={{ left: `${spotPct}%`, transform: "translateX(-50%)" }}
      />
    </>
  );
}
