"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { TickingPrice } from "@/components/landing/TickingPrice";
import { PriceSlider } from "@/components/landing/PriceSlider";
import { BackgroundEffects } from "@/components/landing/BackgroundEffects";
import type { WeeklyReport } from "@/lib/api";

const SPOT_BASE = 2621;

/* Hardcoded mock for when backend has no data yet */
const MOCK_REPORT: WeeklyReport = {
  week_start: "2026-02-09",
  week_end: "2026-02-14",
  total_users: 84,
  total_positions: 127,
  total_simulated_premium: 4820,
  total_assignments: 11,
  eth_open: 2680,
  eth_close: 2618,
  eth_high: 2745,
  eth_low: 2590,
  narrative_data: {},
};

function SocialProofBanner({ report }: { report: WeeklyReport }) {
  const ethChange = ((report.eth_close - report.eth_open) / report.eth_open) * 100;
  const ethDown = ethChange < 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.4 }}
      className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/60 backdrop-blur-sm px-4 py-2.5 text-sm text-[var(--text-secondary)]"
    >
      {ethDown ? (
        <>
          Last week ETH dropped{" "}
          <span className="text-red-400 font-mono font-medium">
            {ethChange.toFixed(1)}%
          </span>
          .{" "}
          <span className="text-[var(--text)] font-medium">
            {report.total_users} people
          </span>{" "}
          on b1nary{" "}
          <span className="text-[var(--accent)] font-medium">still earned</span>.
        </>
      ) : (
        <>
          Last week{" "}
          <span className="text-[var(--text)] font-medium">
            {report.total_users} people
          </span>{" "}
          set a price on b1nary.{" "}
          ETH went up{" "}
          <span className="text-emerald-400 font-mono font-medium">
            +{ethChange.toFixed(1)}%
          </span>
          .{" "}
          <span className="text-[var(--accent)] font-medium">They earned too</span>.
        </>
      )}
    </motion.div>
  );
}

export default function TryPage() {
  const [spot, setSpot] = useState(SPOT_BASE);
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const handleSpotChange = useCallback((p: number) => setSpot(p), []);

  useEffect(() => {
    let cancelled = false;
    import("@/lib/api")
      .then(({ api }) => api.getWeeklyReport())
      .then((data) => {
        if (!cancelled) setReport(data ?? MOCK_REPORT);
      })
      .catch(() => {
        if (!cancelled) setReport(MOCK_REPORT);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="bg-[var(--bg)] min-h-screen relative overflow-hidden">
      {/* Background — same as landing page */}
      <BackgroundEffects />

      {/* Header */}
      <header className="relative z-[3] px-6 py-5 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold tracking-tight font-mono">
          <span className="text-[var(--bone)]">b</span>
          <span className="text-[var(--accent)]">1</span>
          <span className="text-[var(--bone)]">nary</span>
        </Link>
        <Link
          href="/earn"
          className="rounded-lg px-4 py-2 text-sm font-medium border text-[var(--accent)] border-[var(--accent)]/30 hover:border-[var(--accent)]/60 transition-all"
        >
          Open app
        </Link>
      </header>

      {/* Main content */}
      <main className="relative z-[3] max-w-3xl mx-auto px-6 py-12 sm:py-20 space-y-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="space-y-3"
        >
          <h1 className="text-[clamp(1.8rem,5vw,3rem)] font-light text-[var(--bone)] tracking-tight">
            Pick a price. See what you&apos;d earn.
          </h1>
          <p className="text-[var(--text-secondary)] text-lg">
            ETH is{" "}
            <TickingPrice
              base={SPOT_BASE}
              className="text-[var(--text)] font-bold font-mono"
              onPriceChange={handleSpotChange}
            />
            {" "}right now. What price would you buy it at?
          </p>
        </motion.div>

        {/* Social proof */}
        {report && <SocialProofBanner report={report} />}

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <PriceSlider spot={spot} />
        </motion.div>
      </main>
    </div>
  );
}
