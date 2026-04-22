"use client";

import { useRef, useState } from "react";
import { motion, useInView } from "framer-motion";

type Side = "buy" | "sell";

type Condition = { label: string; value: string };

type StepData = {
  title: string;
  conditions?: Condition[];
  lines?: { label?: string; value: string }[];
};

type Outcome = {
  condition: string;
  lines: string[];
  earn: string;
};

type OutcomePair = { hit: Outcome; miss: Outcome };

const BUY: { steps: [StepData, StepData, StepData]; outcomes: OutcomePair } = {
  steps: [
    {
      title: "Pick your conditions.",
      conditions: [
        { label: "Amount", value: "1" },
        { label: "Asset", value: "TSLAx" },
        { label: "Strike", value: "$320" },
        { label: "Expiry", value: "7d" },
      ],
    },
    {
      title: "Commit collateral.",
      lines: [
        { label: "Locked:", value: "$320 USDC" },
        { value: "Generating yield until expiry." },
      ],
    },
    {
      title: "Get paid upfront.",
      lines: [
        { label: "You receive:", value: "+$49" },
        { value: "The moment you commit." },
      ],
    },
  ],
  outcomes: {
    hit: {
      condition: "TSLAx closes ≤ $320",
      lines: ["Buy 1 TSLAx @ $320.", "You already got +$49."],
      earn: "Effective cost: $271/share",
    },
    miss: {
      condition: "TSLAx closes > $320",
      lines: ["Your $320 USDC comes back.", "You already got +$49."],
      earn: "+$49 earned, no trade",
    },
  },
};

const SELL: { steps: [StepData, StepData, StepData]; outcomes: OutcomePair } = {
  steps: [
    {
      title: "Pick your conditions.",
      conditions: [
        { label: "Amount", value: "1" },
        { label: "Asset", value: "TSLAx" },
        { label: "Strike", value: "$380" },
        { label: "Expiry", value: "7d" },
      ],
    },
    {
      title: "Commit collateral.",
      lines: [
        { label: "Locked:", value: "1 TSLAx" },
        { value: "Generating yield until expiry." },
      ],
    },
    {
      title: "Get paid upfront.",
      lines: [
        { label: "You receive:", value: "+$37" },
        { value: "The moment you commit." },
      ],
    },
  ],
  outcomes: {
    hit: {
      condition: "TSLAx closes ≥ $380",
      lines: ["Sell 1 TSLAx @ $380.", "You already got +$37."],
      earn: "Effective price: $417/share",
    },
    miss: {
      condition: "TSLAx closes < $380",
      lines: ["Your TSLAx comes back.", "You already got +$37."],
      earn: "+$37 earned, no trade",
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
            ? "bg-gradient-to-b from-[var(--accent)] to-[#0891b2] text-[var(--bg)] font-medium shadow-[0_0_20px_rgba(34,211,238,0.35)]"
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
            ? "bg-gradient-to-b from-[var(--accent)] to-[#0891b2] text-[var(--bg)] font-medium shadow-[0_0_20px_rgba(34,211,238,0.35)]"
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
  step,
  variant = "accent",
}: {
  number: string;
  step: StepData;
  variant?: "accent" | "purple" | "pink";
}) {
  const colorMap = {
    accent: {
      tint: "rgba(34,211,238,0.04)",
      border: "rgba(34,211,238,0.22)",
      line: "rgba(34,211,238,0.6)",
      n: "var(--accent)",
    },
    purple: {
      tint: "rgba(168,85,247,0.04)",
      border: "rgba(168,85,247,0.22)",
      line: "rgba(168,85,247,0.6)",
      n: "#c084fc",
    },
    pink: {
      tint: "rgba(236,72,153,0.04)",
      border: "rgba(236,72,153,0.22)",
      line: "rgba(236,72,153,0.6)",
      n: "#f472b6",
    },
  } as const;
  const c = colorMap[variant];

  return (
    <article
      className="relative overflow-hidden rounded-2xl px-5 pt-5 pb-5 flex flex-col gap-3"
      style={{
        background: `linear-gradient(180deg, ${c.tint} 0%, transparent 70%)`,
        border: `1px solid ${c.border}`,
      }}
    >
      <span
        aria-hidden="true"
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${c.line}, transparent)`,
        }}
      />
      <div
        className="font-mono text-[11px] tracking-[0.2em]"
        style={{ color: c.n }}
      >
        {number}
      </div>
      <h3 className="text-[var(--bone)] text-[17px] font-medium tracking-tight leading-[1.2]">
        {step.title}
      </h3>
      {step.conditions ? (
        <dl className="rounded-lg bg-white/[0.03] p-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[12px] font-mono">
          {step.conditions.map((c) => (
            <div key={c.label} className="contents">
              <dt className="text-[#fb923c]">{c.label}</dt>
              <dd className="text-[#c4c9d2]">{c.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {step.lines ? (
        <div className="rounded-lg bg-white/[0.03] p-3 space-y-1.5 text-[12px] font-mono leading-[1.55]">
          {step.lines.map((line, i) => (
            <p key={i} className="text-[#c4c9d2]">
              {line.label ? (
                <span className="text-[#fb923c]">{line.label} </span>
              ) : null}
              {line.value}
            </p>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function ResolutionCard({ outcomes }: { outcomes: OutcomePair }) {
  return (
    <article
      className="relative overflow-hidden rounded-2xl px-5 pt-5 pb-5 flex flex-col gap-3 col-span-1 sm:col-span-2 lg:col-span-3"
      style={{
        background:
          "linear-gradient(180deg, rgba(251,146,60,0.05) 0%, transparent 70%)",
        border: "1px solid rgba(251,146,60,0.22)",
      }}
    >
      <span
        aria-hidden="true"
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(251,146,60,0.6), transparent)",
        }}
      />
      <div className="font-mono text-[11px] tracking-[0.2em] text-[#fb923c]">
        04 · RESOLUTION
      </div>
      <h3 className="text-[var(--bone)] text-[17px] font-medium tracking-tight leading-[1.2]">
        Expiry resolves. One of two.
      </h3>
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
              {out.earn}
            </p>
          </div>
        ))}
      </div>
    </article>
  );
}

export function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-15%" });
  const [side, setSide] = useState<Side>("buy");
  const data = side === "buy" ? BUY : SELL;

  return (
    <section ref={ref} className="py-24 px-6 relative z-[3]">
      <div className="max-w-6xl mx-auto">
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
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
        >
          <StepCard number="01" step={data.steps[0]} variant="accent" />
          <StepCard number="02" step={data.steps[1]} variant="purple" />
          <StepCard number="03" step={data.steps[2]} variant="pink" />
          <ResolutionCard outcomes={data.outcomes} />
        </motion.div>
      </div>
    </section>
  );
}
