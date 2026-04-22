"use client";

import { useRef, useState } from "react";
import { motion, useInView } from "framer-motion";

type Side = "buy" | "sell";

type Example = {
  title: string;
  body: string;
  exampleLabel: string;
  exampleValue: string;
};

const STEP_BODIES = {
  pick: "Choose a buy or sell price, size, and expiry. Further from spot = safer, lower premium.",
  commit:
    "To buy, stablecoins are locked. To sell, the asset is locked. 100% backed. No margin, no liquidation.",
  premium:
    "A market maker pays immediately for the right to trade at that price. Yours regardless of outcome.",
  wait: "7 days later the closing price settles it.",
} as const;

const BUY_EXAMPLE: { steps: [Example, Example, Example]; outcomes: OutcomePair } = {
  steps: [
    {
      title: "Pick your price.",
      body: STEP_BODIES.pick,
      exampleLabel: "You:",
      exampleValue: '"I\'ll buy 1 TSLAx at $320. 7-day expiry."',
    },
    {
      title: "Commit your collateral.",
      body: STEP_BODIES.commit,
      exampleLabel: "Locked:",
      exampleValue: "$320 USDC",
    },
    {
      title: "Get paid the premium upfront.",
      body: STEP_BODIES.premium,
      exampleLabel: "You receive:",
      exampleValue: "+$49 the moment you commit.",
    },
  ],
  outcomes: {
    hit: {
      condition: "TSLAx closes ≤ $320",
      lines: ["You buy 1 TSLAx at $320.", "You already got +$49."],
      earn: "Effective cost: $271/share",
    },
    miss: {
      condition: "TSLAx closes > $320",
      lines: ["Your $320 USDC comes back.", "You already got +$49."],
      earn: "Net: +$49 earned, no trade",
    },
  },
};

const SELL_EXAMPLE: { steps: [Example, Example, Example]; outcomes: OutcomePair } = {
  steps: [
    {
      title: "Pick your price.",
      body: STEP_BODIES.pick,
      exampleLabel: "You:",
      exampleValue: '"I\'ll sell 1 TSLAx at $380. 7-day expiry."',
    },
    {
      title: "Commit your collateral.",
      body: STEP_BODIES.commit,
      exampleLabel: "Locked:",
      exampleValue: "1 TSLAx",
    },
    {
      title: "Get paid the premium upfront.",
      body: STEP_BODIES.premium,
      exampleLabel: "You receive:",
      exampleValue: "+$37 the moment you commit.",
    },
  ],
  outcomes: {
    hit: {
      condition: "TSLAx closes ≥ $380",
      lines: ["You sell 1 TSLAx at $380.", "You already got +$37."],
      earn: "Effective price: $417/share",
    },
    miss: {
      condition: "TSLAx closes < $380",
      lines: ["Your TSLAx comes back.", "You already got +$37."],
      earn: "Net: +$37 earned, no trade",
    },
  },
};

type Outcome = {
  condition: string;
  lines: string[];
  earn: string;
};

type OutcomePair = { hit: Outcome; miss: Outcome };

function SideToggle({ side, onSideChange }: { side: Side; onSideChange: (s: Side) => void }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1 flex w-fit">
      <button
        type="button"
        onClick={() => onSideChange("buy")}
        aria-pressed={side === "buy"}
        className={`px-5 py-3 text-sm font-medium rounded-lg transition-all ${
          side === "buy"
            ? "bg-[var(--border)] text-[var(--accent)] shadow-sm"
            : "text-[var(--text-secondary)] hover:text-[var(--text)]"
        }`}
      >
        I have USD
      </button>
      <button
        type="button"
        onClick={() => onSideChange("sell")}
        aria-pressed={side === "sell"}
        className={`px-5 py-3 text-sm font-medium rounded-lg transition-all ${
          side === "sell"
            ? "bg-[var(--border)] text-[var(--accent)] shadow-sm"
            : "text-[var(--text-secondary)] hover:text-[var(--text)]"
        }`}
      >
        I have the asset
      </button>
    </div>
  );
}

function StepRow({
  number,
  title,
  body,
  children,
}: {
  number: number;
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[32px_1fr] gap-4 py-3 relative items-start">
      <div className="w-6 h-6 mt-0.5 rounded-full bg-[var(--bg)] border-[1.5px] border-[var(--accent)] text-[var(--accent)] font-mono text-[11px] flex items-center justify-center -ml-[5px] z-[1]">
        {number}
      </div>
      <div>
        <h3 className="text-[var(--bone)] text-[15px] font-medium mb-1">{title}</h3>
        <p className="text-[var(--text-secondary)] text-xs leading-[1.55]">{body}</p>
        {children}
      </div>
    </div>
  );
}

function ExampleCallout({ label, value }: { label: string; value: string }) {
  return (
    <p className="mt-2 px-3 py-2.5 bg-[var(--accent)]/5 border-l-2 border-[var(--accent)]/40 rounded-r-md text-xs text-[var(--text-secondary)] leading-[1.5]">
      <strong className="text-[var(--text)] font-mono font-medium">{label}</strong>{" "}
      {value}
    </p>
  );
}

function OutcomeGrid({ outcomes }: { outcomes: OutcomePair }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-3">
      {[outcomes.hit, outcomes.miss].map((outcome, i) => (
        <div
          key={i}
          className="p-3.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg"
        >
          <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--text-secondary)] mb-1.5">
            {outcome.condition}
          </div>
          {outcome.lines.map((line, j) => (
            <p key={j} className="text-xs text-[var(--text)] leading-[1.5] mb-1">
              {line}
            </p>
          ))}
          <p className="text-xs font-mono font-semibold text-[var(--accent)] mt-1.5">
            {outcome.earn}
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
  const example = side === "buy" ? BUY_EXAMPLE : SELL_EXAMPLE;

  return (
    <section ref={ref} className="py-24 px-6 relative z-[3]">
      <div className="max-w-4xl mx-auto space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-[clamp(2rem,5vw,3.5rem)] font-light text-[var(--bone)] tracking-tight leading-[1.1]">
            How it works.
          </h2>
          <p className="mt-3 text-[var(--text-secondary)] text-base">
            Walk through a concrete example.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
        >
          <SideToggle side={side} onSideChange={setSide} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="relative pl-[18px]"
        >
          <div
            aria-hidden="true"
            className="absolute left-[13px] top-[20px] bottom-[20px] w-px bg-gradient-to-b from-[var(--accent)]/40 to-[var(--accent)]/10"
          />

          <motion.div
            key={side}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            {example.steps.map((step, i) => (
              <StepRow key={i} number={i + 1} title={step.title} body={step.body}>
                <ExampleCallout label={step.exampleLabel} value={step.exampleValue} />
              </StepRow>
            ))}

            <StepRow
              number={4}
              title="Wait for expiry. One of two things happens."
              body={STEP_BODIES.wait}
            >
              <OutcomeGrid outcomes={example.outcomes} />
            </StepRow>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
