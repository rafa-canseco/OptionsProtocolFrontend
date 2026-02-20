"use client";

import Link from "next/link";
import { useRef, useState, useCallback, useEffect, memo } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { TickingPrice } from "./TickingPrice";
import { CountUp } from "./CountUp";
import { CursorGlow } from "./CursorGlow";

const ACCENT = "#D4A847";
const BUY_COLOR = "#22C55E";
const SELL_COLOR = "#EF4444";

const SPOT_BASE = 2621;
const BUY_STRIKE = 2400;
const SELL_STRIKE = 2800;
const BUY_PREMIUM_BASE = 61;
const SELL_PREMIUM_BASE = 42;

/* ── Shared helpers ── */

function FloatingOrbs() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <motion.div
        animate={{
          x: [0, 80, -40, 60, 0],
          y: [0, -60, 40, -30, 0],
          scale: [1, 1.2, 0.9, 1.1, 1],
        }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(212,168,71,0.06) 0%, transparent 70%)",
        }}
      />
      <motion.div
        animate={{
          x: [0, -60, 30, -50, 0],
          y: [0, 50, -40, 20, 0],
          scale: [1, 0.9, 1.15, 0.95, 1],
        }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
        className="absolute top-1/3 -left-48 w-[600px] h-[600px] rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(13,159,110,0.04) 0%, transparent 70%)",
        }}
      />
      <motion.div
        animate={{
          x: [0, 40, -60, 20, 0],
          y: [0, -30, 50, -60, 0],
          scale: [1, 1.1, 0.85, 1.05, 1],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(212,168,71,0.03) 0%, transparent 70%)",
        }}
      />
    </div>
  );
}

function FadeBlock({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-20%" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ duration: 0.7, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function derivePremium(spot: number, side: "buy" | "sell"): number {
  if (!Number.isFinite(spot)) return side === "buy" ? BUY_PREMIUM_BASE : SELL_PREMIUM_BASE;

  let raw: number;
  if (side === "buy") {
    const denom = SPOT_BASE - BUY_STRIKE;
    if (denom === 0) return BUY_PREMIUM_BASE;
    const dist = (spot - BUY_STRIKE) / denom;
    raw = BUY_PREMIUM_BASE * (2 - dist);
  } else {
    const denom = SELL_STRIKE - SPOT_BASE;
    if (denom === 0) return SELL_PREMIUM_BASE;
    const dist = (SELL_STRIKE - spot) / denom;
    raw = SELL_PREMIUM_BASE * (2 - dist);
  }
  const base = side === "buy" ? BUY_PREMIUM_BASE : SELL_PREMIUM_BASE;
  return Math.round(Math.max(1, Math.min(raw, base * 3)));
}

function AnimatedPremium({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  const frameRef = useRef<number>(0);

  if (value !== prevRef.current) {
    const from = prevRef.current;
    const to = value;
    prevRef.current = value;

    const duration = 500;
    const start = performance.now();

    const animate = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) frameRef.current = requestAnimationFrame(animate);
    };

    cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(animate);
  }

  return <>${display}</>;
}

/* ── Section 1: Income Hero ── */

function HeroSection() {
  return (
    <section className="min-h-screen flex flex-col justify-center px-6 relative">
      <div className="max-w-3xl mx-auto w-full space-y-8 relative z-10">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-[clamp(2.8rem,8vw,6rem)] leading-[1.05] tracking-tight text-[#FAFAFA]"
          style={{ fontFamily: "'Instrument Serif', serif" }}
        >
          Your crypto is sitting there.
          <br />
          <span style={{ color: ACCENT }}>Make it pay you.</span>
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="space-y-2"
        >
          <p className="text-[clamp(1.5rem,4vw,2.5rem)] text-[#FAFAFA] font-light">
            Earn up to <span className="font-semibold" style={{ color: ACCENT }}>15% APR</span>
          </p>
          <p className="text-[clamp(1rem,2.5vw,1.3rem)] text-[#71717A]">
            Without selling your ETH.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="flex flex-wrap gap-4 pt-2"
        >
          <Link
            href="/earn"
            className="rounded-xl px-8 py-3.5 text-base font-semibold text-[#0A0A0A] hover:opacity-90 transition-opacity"
            style={{ backgroundColor: ACCENT }}
          >
            Try the beta
          </Link>
          <a
            href="#mechanism"
            className="rounded-xl px-8 py-3.5 text-base font-medium text-[#71717A] border border-[#27272A] hover:text-[#FAFAFA] hover:border-[#52525B] transition-colors"
          >
            See how it works &darr;
          </a>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 2 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2"
      >
        <motion.span
          animate={{ y: [-6, 6, -6] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          className="text-[#71717A] text-2xl block"
        >
          &darr;
        </motion.span>
      </motion.div>
    </section>
  );
}

/* ── Section 2: The Mechanism ── */

function SideToggle({ side, onSideChange }: { side: "buy" | "sell"; onSideChange: (s: "buy" | "sell") => void }) {
  return (
    <div className="rounded-xl border border-[#27272A] bg-[#18181B] p-1 flex w-fit">
      <button
        onClick={() => onSideChange("buy")}
        className={`px-5 py-2 text-sm font-medium rounded-lg transition-all ${
          side === "buy"
            ? "shadow-sm"
            : "text-[#71717A] hover:text-[#FAFAFA]"
        }`}
        style={side === "buy" ? { backgroundColor: "#27272A", color: BUY_COLOR } : undefined}
      >
        I&apos;d buy
      </button>
      <button
        onClick={() => onSideChange("sell")}
        className={`px-5 py-2 text-sm font-medium rounded-lg transition-all ${
          side === "sell"
            ? "shadow-sm"
            : "text-[#71717A] hover:text-[#FAFAFA]"
        }`}
        style={side === "sell" ? { backgroundColor: "#27272A", color: SELL_COLOR } : undefined}
      >
        I&apos;d sell
      </button>
    </div>
  );
}

function MechanismSection({
  side,
  onSideChange,
  spot,
  onSpotChange,
}: {
  side: "buy" | "sell";
  onSideChange: (s: "buy" | "sell") => void;
  spot: number;
  onSpotChange: (p: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-20%" });
  const strike = side === "buy" ? BUY_STRIKE : SELL_STRIKE;
  const premium = derivePremium(spot, side);
  const sideColor = side === "buy" ? BUY_COLOR : SELL_COLOR;

  return (
    <section id="mechanism" ref={ref} className="min-h-screen flex items-center justify-center px-6 relative">
      <div className="max-w-3xl w-full space-y-10">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
          className="text-[clamp(2rem,6vw,4rem)] font-light text-[#FAFAFA] tracking-tight"
          style={{ fontFamily: "'Instrument Serif', serif" }}
        >
          Here&apos;s how it works.
        </motion.h2>

        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="space-y-6"
        >
          <div className="flex items-center gap-6 flex-wrap">
            <p className="text-[#71717A] text-lg">
              ETH is <TickingPrice base={SPOT_BASE} className="text-[#FAFAFA] font-bold" onPriceChange={onSpotChange} />
            </p>
            <SideToggle side={side} onSideChange={onSideChange} />
          </div>

          <AnimatePresence mode="wait">
            <motion.p
              key={side}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="text-[clamp(1.1rem,2.5vw,1.5rem)] text-[#A1A1AA]"
            >
              You set: <span className="text-[#FAFAFA]">{side === "buy" ? "Buy" : "Sell"} ETH at ${strike.toLocaleString()}</span>
              <br />
              You receive: <span className="font-semibold" style={{ color: sideColor }}><AnimatedPremium value={premium} /></span> upfront
            </motion.p>
          </AnimatePresence>
        </motion.div>

        {/* Outcome card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={side}
            initial={{ opacity: 0, y: 15 }}
            animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 15 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="rounded-2xl border border-[#27272A] bg-[#18181B]/60 p-8 space-y-6"
          >
            <div className="space-y-1">
              <p className="text-[#71717A] text-sm uppercase tracking-wider">If ETH {side === "buy" ? "drops" : "rises"} to ${strike.toLocaleString()}</p>
              <p className="text-[clamp(1.2rem,3vw,1.6rem)] text-[#FAFAFA] font-light">
                {side === "buy"
                  ? `You buy ETH at $${strike.toLocaleString()}.`
                  : `You sell ETH at $${strike.toLocaleString()}.`}
              </p>
              <p className="text-[#A1A1AA]">
                + keep the <span className="font-semibold" style={{ color: sideColor }}>${premium}</span>.
              </p>
            </div>

            <div className="border-t border-[#27272A]" />

            <div className="space-y-1">
              <p className="text-[#71717A] text-sm uppercase tracking-wider">If it doesn&apos;t</p>
              <p className="text-[clamp(1.2rem,3vw,1.6rem)] text-[#FAFAFA] font-light">
                {side === "buy"
                  ? `Your $${strike.toLocaleString()} comes back.`
                  : "Your ETH comes back."}
              </p>
              <p className="text-[#A1A1AA]">
                + keep the <span className="font-semibold" style={{ color: sideColor }}>${premium}</span>.
              </p>
            </div>

            <div className="border-t border-[#27272A]" />

            <p className="text-[clamp(1.1rem,2.5vw,1.4rem)] font-medium" style={{ color: sideColor }}>
              Either way: +${premium} earned.
            </p>
          </motion.div>
        </AnimatePresence>

        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="text-[#52525B] text-base"
        >
          Settles automatically at expiry. Choose your timeline.
        </motion.p>
      </div>
    </section>
  );
}

/* ── Section 3: The Loop ── */

type LoopFrame = {
  text: string;
  accent?: boolean;
  counter?: number;
  pulse?: boolean;
  secondary?: boolean;
  slow?: boolean;
};

const BUY_LOOP: LoopFrame[] = [
  { text: "Buy ETH @ $2,400" },
  { text: "Earn $61 ✓", accent: true, counter: 61 },
  { text: "Price didn't hit.\n$2,400 back.", secondary: true },
  { text: "Earn again →", accent: true, pulse: true },
  { text: "Buy ETH @ $2,400" },
  { text: "Earn $61 ✓", accent: true, counter: 61 },
  { text: "Price hit.\nYou bought ETH @ $2,400.", secondary: true },
  { text: "You now have ETH.\nSet a sell price.", slow: true },
  { text: "Sell ETH @ $2,800" },
  { text: "Earn $42 ✓", accent: true, counter: 42 },
  { text: "Earn again →", accent: true, pulse: true },
];

const SELL_LOOP: LoopFrame[] = [
  { text: "Sell ETH @ $2,800" },
  { text: "Earn $42 ✓", accent: true, counter: 42 },
  { text: "Price didn't hit.\nYour ETH comes back.", secondary: true },
  { text: "Earn again →", accent: true, pulse: true },
  { text: "Sell ETH @ $2,800" },
  { text: "Earn $42 ✓", accent: true, counter: 42 },
  { text: "Price hit.\nYou sold ETH @ $2,800.", secondary: true },
  { text: "You now have dollars.\nSet a buy price.", slow: true },
  { text: "Buy ETH @ $2,400" },
  { text: "Earn $61 ✓", accent: true, counter: 61 },
  { text: "Earn again →", accent: true, pulse: true },
];

function LoopCounter({ target }: { target: number }) {
  const [val, setVal] = useState(0);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const start = performance.now();
    const duration = 800;

    const animate = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(target * eased));
      if (t < 1) frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target]);

  return <>${val}</>;
}

const LoopSection = memo(function LoopSection({ side }: { side: "buy" | "sell" }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-20%" });
  const [frameIndex, setFrameIndex] = useState(0);
  const frames = side === "buy" ? BUY_LOOP : SELL_LOOP;
  const sideColor = side === "buy" ? BUY_COLOR : SELL_COLOR;

  useEffect(() => {
    setFrameIndex(0);
  }, [side]);

  useEffect(() => {
    if (!inView) return;
    const duration = frames[frameIndex]?.slow ? 2500 : 2000;
    const timer = setTimeout(() => {
      setFrameIndex((prev) => (prev + 1) % frames.length);
    }, duration);
    return () => clearTimeout(timer);
  }, [inView, frameIndex, frames]);

  const frame = frames[frameIndex];

  return (
    <section ref={ref} className="min-h-screen flex items-center justify-center px-6 relative">
      <div className="max-w-3xl w-full space-y-12">
        <FadeBlock>
          <h2
            className="text-[clamp(2rem,6vw,4rem)] font-light text-[#FAFAFA] tracking-tight"
            style={{ fontFamily: "'Instrument Serif', serif" }}
          >
            Every outcome earns.
          </h2>
          <p className="text-[#71717A] text-lg mt-2" style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic" }}>
            There&apos;s no exit that isn&apos;t earning.
          </p>
        </FadeBlock>

        <div className="rounded-2xl border border-[#27272A] bg-[#18181B]/50 p-10 min-h-[160px] flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${side}-${frameIndex}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.4 }}
              className="text-center space-y-1"
            >
              {frame.text.split("\n").map((line, i) => (
                <p
                  key={i}
                  className={`text-[clamp(1.3rem,3.5vw,2.2rem)] leading-relaxed ${
                    frame.accent
                      ? "font-semibold"
                      : frame.secondary
                        ? "text-[#71717A] font-light"
                        : "text-[#FAFAFA] font-light"
                  }`}
                  style={frame.accent ? { color: sideColor } : undefined}
                >
                  {frame.counter && i === 0 ? (
                    <>Earn <LoopCounter target={frame.counter} /> {"✓"}</>
                  ) : frame.pulse ? (
                    <motion.span
                      animate={{ opacity: [0.7, 1, 0.7] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                    >
                      {line}
                    </motion.span>
                  ) : (
                    line
                  )}
                </p>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>

        <FadeBlock delay={0.2}>
          <p className="text-center text-[#A1A1AA] text-lg">
            Real premium. Paid upfront. Every cycle.
          </p>
        </FadeBlock>
      </div>
    </section>
  );
});

/* ── Section 4: Comparison ── */

const COMPARISONS = [
  { name: "Savings account", apr: "~4%", pros: ["Safe"], cons: ["Not crypto"] },
  { name: "Staking ETH", apr: "~3.5%", pros: ["Passive"], cons: ["Low yield"] },
  { name: "Lending (Aave)", apr: "~2%", pros: ["DeFi"], cons: ["Lower yield"] },
];

const ComparisonSection = memo(function ComparisonSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-20%" });

  return (
    <section ref={ref} className="min-h-screen flex items-center justify-center px-6 relative">
      <div className="max-w-3xl w-full space-y-12">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
          className="text-[clamp(2rem,6vw,4rem)] font-light text-[#FAFAFA] tracking-tight"
          style={{ fontFamily: "'Instrument Serif', serif" }}
        >
          How does this compare?
        </motion.h2>

        <div className="space-y-3">
          {COMPARISONS.map((item, i) => (
            <motion.div
              key={item.name}
              initial={{ opacity: 0, y: 15 }}
              animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 15 }}
              transition={{ duration: 0.4, delay: 0.2 + i * 0.1 }}
              className="flex items-center justify-between py-4 border-b border-[#1E1E22]"
            >
              <span className="text-[#71717A] text-base sm:text-lg">{item.name}</span>
              <div className="flex items-center gap-4">
                <span className="text-[#A1A1AA] text-base sm:text-lg font-light">{item.apr}</span>
                <div className="hidden sm:flex items-center gap-2 text-sm">
                  {item.pros.map((p) => (
                    <span key={p} className="text-[#52525B]">{"✓"} {p}</span>
                  ))}
                  {item.cons.map((c) => (
                    <span key={c} className="text-[#3F3F46]">{"✗"} {c}</span>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}

          {/* Loot row — highlighted */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 15 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="flex items-center justify-between py-5 rounded-xl px-4 -mx-4"
            style={{ backgroundColor: "rgba(212,168,71,0.06)", borderBottom: "1px solid rgba(212,168,71,0.15)" }}
          >
            <span className="text-[#FAFAFA] text-base sm:text-lg font-medium">Loot</span>
            <div className="flex items-center gap-4">
              <span className="text-lg sm:text-xl font-semibold" style={{ color: ACCENT }}>Higher yield</span>
              <div className="hidden sm:flex items-center gap-2 text-sm" style={{ color: ACCENT }}>
                <span>{"✓"} Passive</span>
                <span>{"✓"} Paid upfront</span>
                <span>{"✓"} Keep your crypto</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
});

/* ── Section 5: Social Proof ── */

const STATS = [
  { label: "Built on", value: "Base" },
  { label: "Collateral", value: "100%" },
  { label: "Margin calls", value: "None" },
  { label: "Contracts", value: "Verified" },
];

const SocialProofSection = memo(function SocialProofSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-20%" });

  return (
    <section ref={ref} className="py-32 flex items-center justify-center px-6 relative">
      <div className="max-w-3xl w-full space-y-12">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
          className="text-[clamp(1.5rem,4vw,2.5rem)] font-light text-[#FAFAFA] tracking-tight text-center"
          style={{ fontFamily: "'Instrument Serif', serif" }}
        >
          Fully collateralized. No margin. No liquidations.
        </motion.h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          {STATS.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 15 }}
              animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 15 }}
              transition={{ duration: 0.4, delay: 0.2 + i * 0.1 }}
              className="text-center"
            >
              <p className="text-2xl sm:text-3xl font-semibold text-[#FAFAFA]">{stat.value}</p>
              <p className="text-sm text-[#52525B] mt-1">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="text-center text-[#3F3F46] text-sm"
        >
          Smart contracts verified on BaseScan · Open source
        </motion.p>
      </div>
    </section>
  );
});

/* ── Section 6: CTA ── */

function CTASection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-20%" });

  return (
    <section ref={ref} className="min-h-[70vh] flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
        transition={{ duration: 0.8 }}
        className="max-w-3xl w-full text-center space-y-10"
      >
        <h2
          className="text-[clamp(2.5rem,8vw,6rem)] text-[#FAFAFA] leading-[0.95] tracking-tight"
          style={{ fontFamily: "'Instrument Serif', serif" }}
        >
          Set your price.
          <br />
          Get paid.
        </h2>

        <Link
          href="/earn"
          className="inline-block rounded-xl px-10 py-4 text-base font-semibold text-[#0A0A0A] hover:opacity-90 transition-opacity"
          style={{ backgroundColor: ACCENT }}
        >
          Start earning &rarr;
        </Link>
      </motion.div>
    </section>
  );
}

/* ── Main ── */

export function LandingPage() {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [spot, setSpot] = useState(SPOT_BASE);

  const handleSpotChange = useCallback((p: number) => setSpot(p), []);

  return (
    <div className="bg-[#0A0A0A] relative overflow-hidden">
      <FloatingOrbs />
      <CursorGlow />

      <header className="fixed top-0 left-0 right-0 z-50 px-6 py-5 flex items-center justify-between">
        <span className="text-[#FAFAFA] text-lg font-bold tracking-tight">loot</span>
        <Link
          href="/earn"
          className="rounded-lg px-4 py-2 text-sm font-medium border transition-all"
          style={{ color: ACCENT, borderColor: "rgba(212,168,71,0.3)" }}
        >
          Try the beta &rarr;
        </Link>
      </header>

      <HeroSection />
      <MechanismSection side={side} onSideChange={setSide} spot={spot} onSpotChange={handleSpotChange} />
      <LoopSection side={side} />
      <ComparisonSection />
      <SocialProofSection />
      <CTASection />
    </div>
  );
}
