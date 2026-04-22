"use client";

import { useRef, useState } from "react";
import { motion, useInView } from "framer-motion";

type Side = "buy" | "sell";

type ConditionRow = { label: string; value: string; hint?: string };

type CommitRow = { label: string; value: string; hint?: string };

type Outcome = {
  condition: string;
  lines: string[];
  total: string;
};

type OutcomePair = { hit: Outcome; miss: Outcome };

type SideExample = {
  conditions: ConditionRow[];
  commit: CommitRow[];
  outcomes: OutcomePair;
};

const BUY: SideExample = {
  conditions: [
    { label: "Asset", value: "TSLAx" },
    { label: "Strike", value: "$320", hint: "price you'd buy at" },
    { label: "Amount to commit", value: "$320 USDC" },
    { label: "Expiry", value: "7d" },
  ],
  commit: [
    { label: "Locked", value: "$320 USDC for 7d" },
    { label: "Premium", value: "+$49 upfront" },
    { label: "Yield", value: "Locked collateral keeps earning until expiry." },
  ],
  outcomes: {
    hit: {
      condition: "TSLAx closes ≤ $320",
      lines: ["Buy 1 TSLAx @ $320.", "Keep the +$49 premium."],
      total: "Effective cost: $271/share",
    },
    miss: {
      condition: "TSLAx closes > $320",
      lines: ["Your $320 USDC back.", "Keep the +$49 premium."],
      total: "Total: $369 USDC",
    },
  },
};

const SELL: SideExample = {
  conditions: [
    { label: "Asset", value: "TSLAx" },
    { label: "Strike", value: "$380", hint: "price you'd sell at" },
    { label: "Amount to commit", value: "1 TSLAx" },
    { label: "Expiry", value: "7d" },
  ],
  commit: [
    { label: "Locked", value: "1 TSLAx for 7d" },
    { label: "Premium", value: "+$37 upfront" },
    { label: "Yield", value: "Locked collateral keeps earning until expiry." },
  ],
  outcomes: {
    hit: {
      condition: "TSLAx closes ≥ $380",
      lines: ["Sell 1 TSLAx @ $380 → $380 USDC received.", "Plus the +$37 premium."],
      total: "Total: $417 USDC",
    },
    miss: {
      condition: "TSLAx closes < $380",
      lines: ["Your 1 TSLAx back.", "Plus the +$37 premium."],
      total: "Asset + $37 earned",
    },
  },
};

function SideToggle({ side, onSideChange }: { side: Side; onSideChange: (s: Side) => void }) {
  return (
    <div className="inline-flex gap-1 p-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-xs">
      <button
        type="button"
        onClick={() => onSideChange("buy")}
        aria-pressed={side === "buy"}
        className={`px-4 py-2 rounded-lg font-mono transition-all ${
          side === "buy"
            ? "bg-[var(--accent)] text-[var(--bg)] font-medium shadow-[0_0_20px_rgba(34,211,238,0.3)]"
            : "text-[var(--text-secondary)] hover:text-[var(--text)]"
        }`}
      >
        I have USD
      </button>
      <button
        type="button"
        onClick={() => onSideChange("sell")}
        aria-pressed={side === "sell"}
        className={`px-4 py-2 rounded-lg font-mono transition-all ${
          side === "sell"
            ? "bg-[var(--accent)] text-[var(--bg)] font-medium shadow-[0_0_20px_rgba(34,211,238,0.3)]"
            : "text-[var(--text-secondary)] hover:text-[var(--text)]"
        }`}
      >
        I have the asset
      </button>
    </div>
  );
}

function StepCard({
  number,
  title,
  children,
  wide = false,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <article
      className={`relative overflow-hidden rounded-2xl px-5 pt-5 pb-5 flex flex-col gap-3 border border-[var(--accent)]/20 bg-gradient-to-b from-[var(--accent)]/[0.04] to-transparent ${
        wide ? "md:col-span-2" : ""
      }`}
    >
      <span
        aria-hidden="true"
        className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--accent)]/60 to-transparent"
      />
      <div className="font-mono text-[11px] tracking-[0.2em] text-[var(--accent)]">
        {number}
      </div>
      <h3 className="text-[var(--bone)] text-[17px] font-medium tracking-tight leading-[1.2]">
        {title}
      </h3>
      {children}
    </article>
  );
}

function ConditionsList({ rows }: { rows: ConditionRow[] }) {
  return (
    <dl className="rounded-lg bg-white/[0.03] p-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[12px] font-mono">
      {rows.map((row) => (
        <div key={row.label} className="contents">
          <dt className="text-[var(--accent)]">{row.label}</dt>
          <dd className="text-[#c4c9d2]">
            {row.value}
            {row.hint ? (
              <span className="text-[var(--text-secondary)] opacity-70">
                {"  ·  "}
                {row.hint}
              </span>
            ) : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function CommitList({ rows }: { rows: CommitRow[] }) {
  return (
    <dl className="rounded-lg bg-white/[0.03] p-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[12px] font-mono">
      {rows.map((row) => (
        <div key={row.label} className="contents">
          <dt className="text-[var(--accent)]">{row.label}</dt>
          <dd className="text-[#c4c9d2]">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function OutcomeGrid({ outcomes }: { outcomes: OutcomePair }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
      {[outcomes.hit, outcomes.miss].map((out, i) => (
        <div
          key={i}
          className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3.5"
        >
          <div className="font-mono text-[10px] tracking-[0.15em] uppercase text-[var(--text-secondary)] mb-1.5">
            {out.condition}
          </div>
          {out.lines.map((line, j) => (
            <p key={j} className="text-[13px] text-[var(--text)] leading-[1.5]">
              {line}
            </p>
          ))}
          <p className="mt-1.5 font-mono text-[13px] font-semibold text-[var(--accent)]">
            {out.total}
          </p>
        </div>
      ))}
    </div>
  );
}

export function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-15%" });
  const [side, setSide] = useState<Side>("buy");
  const data = side === "buy" ? BUY : SELL;

  return (
    <section ref={ref} className="py-24 px-6 relative z-[3]">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
          className="flex flex-col gap-3 mb-8"
        >
          <h2 className="text-[clamp(2rem,5vw,3.5rem)] font-light text-[var(--bone)] tracking-tight leading-[1.1]">
            How it works.
          </h2>
          <p className="text-[var(--text-secondary)] text-base font-mono">
            Follow the example: 1 TSLAx @ $320, 7-day.
          </p>
          <SideToggle side={side} onSideChange={setSide} />
        </motion.div>

        <motion.div
          key={side}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-3"
        >
          <StepCard number="01" title="Pick your conditions.">
            <ConditionsList rows={data.conditions} />
          </StepCard>
          <StepCard number="02" title="Commit & get paid.">
            <CommitList rows={data.commit} />
          </StepCard>
          <StepCard number="03" title="Expiry resolves. One of two." wide>
            <OutcomeGrid outcomes={data.outcomes} />
          </StepCard>
        </motion.div>
      </div>
    </section>
  );
}
