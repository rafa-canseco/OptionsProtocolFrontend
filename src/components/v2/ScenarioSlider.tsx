"use client";

import { useState } from "react";

interface ScenarioSliderProps {
  spot: number;
  side: "buy" | "sell";
  amount?: number;
  strike?: number;
  premium?: number;
}

export function ScenarioSlider({
  spot,
  side,
  amount,
  strike,
  premium,
}: ScenarioSliderProps) {
  const isBuy = side === "buy";
  const hasAmount = amount !== undefined && amount > 0;
  const hasStrike = strike !== undefined && strike > 0;
  const hasPremium = premium !== undefined && premium > 0;

  const rangeMin = Math.round(spot * 0.8);
  const rangeMax = Math.round(spot * 1.2);
  const [scenarioPrice, setScenarioPrice] = useState(Math.round(spot));

  const isOTM = hasStrike
    ? isBuy
      ? scenarioPrice >= strike
      : scenarioPrice <= strike
    : null;

  const pctFromSpot = ((scenarioPrice - spot) / spot) * 100;
  const pctLabel = pctFromSpot >= 0
    ? `+${pctFromSpot.toFixed(1)}%`
    : `${pctFromSpot.toFixed(1)}%`;

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-5 space-y-5">
      <div>
        <p className="text-xs text-[var(--text-secondary)] mb-1">
          If ETH is this price at expiry...
        </p>
        <div className="flex items-baseline gap-2">
          <p className="text-2xl font-bold text-[var(--text)] font-mono">
            ${scenarioPrice.toLocaleString()}
          </p>
          <span className={`text-sm font-mono font-medium ${
            pctFromSpot > 0
              ? "text-green-400"
              : pctFromSpot < 0
                ? "text-red-400"
                : "text-[var(--text-secondary)]"
          }`}>
            {pctLabel}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <input
          type="range"
          min={rangeMin}
          max={rangeMax}
          step={1}
          value={scenarioPrice}
          onChange={(e) => setScenarioPrice(Number(e.target.value))}
          className="w-full accent-[var(--accent)] h-1.5 rounded-full appearance-none bg-[var(--surface)] cursor-pointer"
        />
        <div className="flex justify-between text-[10px] text-[var(--text-secondary)] font-mono">
          <span>${rangeMin.toLocaleString()}</span>
          <span className="text-[var(--text)]">
            ${spot.toLocaleString()} now
          </span>
          <span>${rangeMax.toLocaleString()}</span>
        </div>
        {hasStrike && (
          <div className="relative h-1">
            <div
              className="absolute -top-3 text-[9px] font-mono text-[var(--accent)] font-medium whitespace-nowrap"
              style={{
                left: `${((strike - rangeMin) / (rangeMax - rangeMin)) * 100}%`,
                transform: "translateX(-50%)",
              }}
            >
              strike ${strike.toLocaleString()}
            </div>
          </div>
        )}
      </div>

      {/* Outcome based on slider position */}
      <div className="space-y-3 pt-1">
        {hasStrike ? (
          isOTM ? (
            <OTMOutcome
              isBuy={isBuy}
              strike={strike}
              amount={amount}
              premium={premium}
              hasAmount={hasAmount}
              hasPremium={hasPremium}
            />
          ) : (
            <ITMOutcome
              isBuy={isBuy}
              strike={strike}
              amount={amount}
              premium={premium}
              hasAmount={hasAmount}
              hasPremium={hasPremium}
            />
          )
        ) : (
          <div className="text-sm text-[var(--text-secondary)] text-center py-3">
            Select a strike price to see outcomes
          </div>
        )}
      </div>
    </div>
  );
}

function OTMOutcome({
  isBuy,
  strike,
  amount,
  premium,
  hasAmount,
  hasPremium,
}: {
  isBuy: boolean;
  strike: number;
  amount?: number;
  premium?: number;
  hasAmount: boolean;
  hasPremium: boolean;
}) {
  return (
    <div className="rounded-xl bg-[var(--accent)]/8 border border-[var(--accent)]/20 p-4 space-y-1.5 transition-all duration-200">
      <div className="flex items-center gap-1.5">
        <div className="w-5 h-5 rounded-full bg-[var(--accent)]/20 flex items-center justify-center">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path
              d="M2 5.5L4 7.5L8 3"
              stroke="var(--accent)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <p className="text-xs font-semibold text-[var(--accent)]">
          Most likely — price {isBuy ? "stays above" : "stays below"} ${strike.toLocaleString()}
        </p>
      </div>
      <p className="text-sm font-semibold text-[var(--text)]">
        {hasAmount
          ? isBuy
            ? `$${amount!.toLocaleString()} back`
            : `${amount} ETH back`
          : "Your capital back"}
      </p>
      <p className="text-sm font-bold text-[var(--accent)] font-mono">
        {hasPremium
          ? `+ keep $${Math.round(premium!).toLocaleString()}`
          : "+ keep earnings"}
      </p>
    </div>
  );
}

function ITMOutcome({
  isBuy,
  strike,
  amount,
  premium,
  hasAmount,
  hasPremium,
}: {
  isBuy: boolean;
  strike: number;
  amount?: number;
  premium?: number;
  hasAmount: boolean;
  hasPremium: boolean;
}) {
  return (
    <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-4 space-y-1.5 transition-all duration-200">
      <div className="flex items-center gap-1.5">
        <div className="w-5 h-5 rounded-full bg-[var(--border)] flex items-center justify-center">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M3 5H7" stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M5 3L7 5L5 7" stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="text-xs font-semibold text-[var(--text-secondary)]">
          Order fills — price {isBuy ? "drops below" : "rises above"} ${strike.toLocaleString()}
        </p>
      </div>
      <p className="text-sm font-semibold text-[var(--text)]">
        {hasAmount
          ? isBuy
            ? `Buy ${(amount! / strike).toFixed(2)} ETH at $${strike.toLocaleString()}`
            : `Sell ${amount} ETH at $${strike.toLocaleString()}`
          : isBuy
            ? `Buy ETH at $${strike.toLocaleString()}`
            : `Sell ETH at $${strike.toLocaleString()}`}
      </p>
      <p className="text-sm font-bold text-[var(--accent)] font-mono">
        {hasPremium
          ? `+ keep $${Math.round(premium!).toLocaleString()}`
          : "+ keep earnings"}
      </p>
    </div>
  );
}
