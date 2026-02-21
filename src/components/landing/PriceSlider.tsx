"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSimulate, weekLabel } from "@/hooks/useSimulate";
import { useSliderAnalytics } from "@/hooks/useSliderAnalytics";
import { SimulationResult } from "./SimulationResult";

const STRIKE_INTERVAL = 100; // $100 increments

/** Compute discrete strikes from spot: spot - 20% to spot - 2%, rounded to $100 */
function generateStrikes(spot: number): number[] {
  const low = Math.ceil((spot * 0.8) / STRIKE_INTERVAL) * STRIKE_INTERVAL;
  const high = Math.floor((spot * 0.98) / STRIKE_INTERVAL) * STRIKE_INTERVAL;
  const strikes: number[] = [];
  for (let s = low; s <= high; s += STRIKE_INTERVAL) {
    strikes.push(s);
  }
  return strikes;
}

/** Find the default strike (~10% OTM) */
function defaultStrike(strikes: number[], spot: number): number {
  const target = spot * 0.9;
  return strikes.reduce((best, s) =>
    Math.abs(s - target) < Math.abs(best - target) ? s : best,
  );
}

export function PriceSlider({ spot }: { spot: number }) {
  const strikes = useMemo(() => generateStrikes(spot), [spot]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const side: "buy" | "sell" = "buy"; // slider is buy-side only for landing page
  const { trackSliderUse } = useSliderAnalytics();
  const sliderRef = useRef<HTMLInputElement>(null);

  // Set default strike on mount / when strikes change
  useEffect(() => {
    if (strikes.length === 0) return;
    const def = defaultStrike(strikes, spot);
    const idx = strikes.indexOf(def);
    setSelectedIdx(idx >= 0 ? idx : Math.floor(strikes.length / 2));
  }, [strikes, spot]);

  const selectedStrike = selectedIdx !== null ? strikes[selectedIdx] : null;
  const { result, loading } = useSimulate(selectedStrike, side, spot);

  const handleChange = useCallback(
    (idx: number) => {
      setSelectedIdx(idx);
      if (strikes[idx]) {
        trackSliderUse(strikes[idx], side);
      }
    },
    [strikes, side, trackSliderUse],
  );

  if (strikes.length === 0) return null;

  const discountPct = selectedStrike ? Math.round(((spot - selectedStrike) / spot) * 100) : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <p className="text-[var(--text-secondary)] text-lg">
          ETH is{" "}
          <span className="text-[var(--text)] font-bold font-mono">
            ${spot.toLocaleString()}
          </span>
        </p>
        <h3 className="text-[clamp(1.3rem,3vw,2rem)] text-[var(--bone)] font-light">
          I&apos;d buy ETH at{" "}
          <AnimatePresence mode="wait">
            <motion.span
              key={selectedStrike}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.15 }}
              className="text-[var(--accent)] font-semibold font-mono"
            >
              ${selectedStrike?.toLocaleString() ?? "—"}
            </motion.span>
          </AnimatePresence>
          {selectedStrike && (
            <span className="text-[var(--text-secondary)] text-base font-normal ml-2">
              ({discountPct}% below)
            </span>
          )}
        </h3>
      </div>

      {/* Desktop slider */}
      <div className="hidden sm:block space-y-3">
        <input
          ref={sliderRef}
          type="range"
          min={0}
          max={strikes.length - 1}
          value={selectedIdx ?? 0}
          onChange={(e) => handleChange(Number(e.target.value))}
          className="w-full accent-[var(--accent)] cursor-pointer"
          style={{ height: "8px" }}
        />
        <div className="flex justify-between text-xs text-[var(--text-secondary)] font-mono">
          <span>${strikes[0].toLocaleString()}</span>
          <span>${strikes[strikes.length - 1].toLocaleString()}</span>
        </div>
      </div>

      {/* Mobile tappable pills */}
      <div className="sm:hidden">
        <div className="flex flex-wrap gap-2 justify-center">
          {strikes.map((strike, idx) => {
            const isSelected = idx === selectedIdx;
            return (
              <button
                key={strike}
                onClick={() => handleChange(idx)}
                className={`px-3 py-2 rounded-lg text-sm font-mono transition-all min-w-[72px] ${
                  isSelected
                    ? "bg-[var(--accent)] text-[var(--bg)] font-semibold shadow-lg shadow-[var(--accent)]/20"
                    : "bg-[var(--surface)] text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--accent)]/40"
                }`}
              >
                ${strike.toLocaleString()}
              </button>
            );
          })}
        </div>
      </div>

      {/* Results */}
      <AnimatePresence mode="wait">
        {result && selectedStrike && (
          <motion.div
            key={selectedStrike}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
          >
            <SimulationResult
              result={result}
              strike={selectedStrike}
              side={side}
              loading={loading}
              weekLabel={weekLabel()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
