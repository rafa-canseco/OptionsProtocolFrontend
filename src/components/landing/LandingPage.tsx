"use client";

import Link from "next/link";
import { useRef, useState, useCallback, useEffect, useMemo, memo } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { TickingPrice } from "./TickingPrice";
import { BackgroundEffects } from "./BackgroundEffects";
import { useWallet } from "@/hooks/useWallet";
import { api } from "@/lib/api";

const WORDMARK_FONT = "'Fira Code', monospace";
const TARGET = "b1nary";
const BINARY_CHARS = "01";

const FALLBACK_SPOT = 2621;

function deriveStrikes(spot: number) {
  const buy = Math.round((spot * 0.92) / 100) * 100;
  const sell = Math.round((spot * 1.08) / 100) * 100;
  return { buyStrike: buy, sellStrike: sell };
}

function useLiveSpot(): number {
  const [spot, setSpot] = useState(FALLBACK_SPOT);

  useEffect(() => {
    let cancelled = false;
    api.getPrices()
      .then((prices) => {
        if (cancelled || prices.length === 0) return;
        setSpot(Math.round(prices[0].spot));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return spot;
}

/* ── Binary scramble hook ── */
function useBinaryReveal(trigger: boolean, duration = 2000) {
  const [display, setDisplay] = useState("      ");
  const frameRef = useRef<number>(0);
  const startRef = useRef<number>(0);

  const animate = useCallback(() => {
    const elapsed = performance.now() - startRef.current;
    const progress = Math.min(elapsed / duration, 1);
    const result = TARGET.split("").map((char, i) => {
      const charProgress = (progress - i * 0.1) / 0.4;
      if (charProgress >= 1) return char;
      return BINARY_CHARS[Math.floor(Math.random() * 2)];
    });
    setDisplay(result.join(""));
    if (progress < 1) frameRef.current = requestAnimationFrame(animate);
    else setDisplay(TARGET);
  }, [duration]);

  useEffect(() => {
    if (!trigger) {
      setDisplay(TARGET.split("").map(() => BINARY_CHARS[Math.floor(Math.random() * 2)]).join(""));
      return;
    }
    startRef.current = performance.now();
    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [trigger, animate]);

  return display;
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

function derivePremium(spot: number, side: "buy" | "sell", buyStrike: number, sellStrike: number): number {
  const basePremiumBuy = Math.round(buyStrike * 0.025);
  const basePremiumSell = Math.round(sellStrike * 0.015);

  if (!Number.isFinite(spot)) return side === "buy" ? basePremiumBuy : basePremiumSell;

  if (side === "buy") {
    const dist = Math.max(0, (spot - buyStrike) / spot);
    return Math.round(Math.max(1, basePremiumBuy * (1 + dist)));
  } else {
    const dist = Math.max(0, (sellStrike - spot) / spot);
    return Math.round(Math.max(1, basePremiumSell * (1 + dist)));
  }
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

/* ── Header logo with binary scramble ── */

function HeaderLogo() {
  const [trigger, setTrigger] = useState(false);
  const display = useBinaryReveal(trigger, 1500);

  useEffect(() => {
    // Start scramble after a short delay on mount
    const timer = setTimeout(() => setTrigger(true), 300);
    return () => clearTimeout(timer);
  }, []);

  const renderChars = display.split("").map((char, i) => {
    const isResolved = char === TARGET[i];
    const isCyanOne = isResolved && char === "1";
    return (
      <span
        key={i}
        style={{
          color: isCyanOne ? "var(--accent)" : isResolved ? "var(--bone)" : "var(--accent)",
          opacity: isResolved ? 1 : 0.5,
          filter: isCyanOne ? "drop-shadow(0 0 8px rgba(34,211,238,0.4))" : "none",
          transition: isResolved ? "opacity 0.3s" : undefined,
        }}
      >
        {char}
      </span>
    );
  });

  return (
    <span
      className="text-2xl font-bold tracking-tight select-none"
      style={{ fontFamily: WORDMARK_FONT }}
    >
      {renderChars}
    </span>
  );
}

/* ── Section 1: Income Hero ── */

function HeroSection() {
  return (
    <section className="min-h-screen flex flex-col justify-center px-6 relative z-[3]">
      <div className="max-w-4xl mx-auto w-full space-y-8">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="text-[clamp(1.8rem,5vw,3.5rem)] leading-[1.1] tracking-tight text-[var(--bone)] font-light"
        >
          Your crypto is sitting there.
          <br />
          <span className="text-[var(--accent)]">Make it pay you.</span>
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="space-y-2"
        >
          <p className="text-[clamp(1.2rem,3vw,1.6rem)] text-[var(--text-secondary)] font-light leading-relaxed">
            Pick a price you&apos;d buy or sell ETH at.
            <br />
            Get paid <span className="font-semibold text-[var(--accent)]">upfront</span>, no matter what happens.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.1 }}
          className="flex flex-wrap gap-4 pt-2"
        >
          <Link
            href="/earn"
            className="rounded-xl px-8 py-3.5 text-base font-semibold bg-[var(--accent)] text-[var(--bg)] hover:bg-[var(--accent-hover)] transition-colors"
          >
            Try the beta
          </Link>
          <a
            href="#mechanism"
            className="rounded-xl px-8 py-3.5 text-base font-medium text-[var(--text-secondary)] border border-[var(--border)] hover:text-[var(--text)] hover:border-[var(--text-secondary)] transition-colors"
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
          className="text-[var(--text-secondary)] text-2xl block"
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
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1 flex w-fit">
      <button
        onClick={() => onSideChange("buy")}
        className={`px-5 py-2 text-sm font-medium rounded-lg transition-all ${
          side === "buy"
            ? "bg-[var(--border)] text-[var(--accent)] shadow-sm"
            : "text-[var(--text-secondary)] hover:text-[var(--text)]"
        }`}
      >
        I&apos;d buy
      </button>
      <button
        onClick={() => onSideChange("sell")}
        className={`px-5 py-2 text-sm font-medium rounded-lg transition-all ${
          side === "sell"
            ? "bg-[var(--border)] text-[var(--danger)] shadow-sm"
            : "text-[var(--text-secondary)] hover:text-[var(--text)]"
        }`}
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
  spotBase,
  onSpotChange,
  buyStrike,
  sellStrike,
}: {
  side: "buy" | "sell";
  onSideChange: (s: "buy" | "sell") => void;
  spot: number;
  spotBase: number;
  onSpotChange: (p: number) => void;
  buyStrike: number;
  sellStrike: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });
  const strike = side === "buy" ? buyStrike : sellStrike;
  const premium = derivePremium(spot, side, buyStrike, sellStrike);

  return (
    <section id="mechanism" ref={ref} className="min-h-screen flex items-center justify-center px-6 relative z-[3]">
      <div className="max-w-3xl w-full space-y-10">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
          className="text-[clamp(2rem,6vw,4rem)] font-light text-[var(--bone)] tracking-tight"
        >
          Here&apos;s how it works.
        </motion.h2>

        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="space-y-6"
        >
          <div className="flex items-center gap-6 flex-wrap">
            <p className="text-[var(--text-secondary)] text-lg">
              ETH is <TickingPrice base={spotBase} className="text-[var(--text)] font-bold font-mono" onPriceChange={onSpotChange} />
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
              className="text-[clamp(1.1rem,2.5vw,1.5rem)] text-[var(--text-secondary)]"
            >
              You set: <span className="text-[var(--text)]">{side === "buy" ? "Buy" : "Sell"} ETH at ${strike.toLocaleString()}</span>
              <br />
              You receive: <span className="font-semibold text-[var(--accent)]"><AnimatedPremium value={premium} /></span> upfront
            </motion.p>
          </AnimatePresence>
        </motion.div>

        {/* Outcome card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={side}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.4 }}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/60 p-8 space-y-6"
          >
            <div className="space-y-1">
              <p className="text-[var(--text-secondary)] text-sm uppercase tracking-wider">When time&apos;s up, ETH is {side === "buy" ? "below" : "above"} ${strike.toLocaleString()}</p>
              <p className="text-[clamp(1.2rem,3vw,1.6rem)] text-[var(--text)] font-light">
                {side === "buy"
                  ? `You buy ETH at $${strike.toLocaleString()}.`
                  : `You sell ETH at $${strike.toLocaleString()}.`}
              </p>
              <p className="text-[var(--text-secondary)]">
                + keep the <span className="font-semibold text-[var(--accent)]">${premium}</span>.
              </p>
            </div>

            <div className="border-t border-[var(--border)]" />

            <div className="space-y-1">
              <p className="text-[var(--text-secondary)] text-sm uppercase tracking-wider">When time&apos;s up, it {side === "buy" ? "didn't drop" : "didn't rise"}</p>
              <p className="text-[clamp(1.2rem,3vw,1.6rem)] text-[var(--text)] font-light">
                {side === "buy"
                  ? `Your $${strike.toLocaleString()} comes back.`
                  : "Your ETH comes back."}
              </p>
              <p className="text-[var(--text-secondary)]">
                + keep the <span className="font-semibold text-[var(--accent)]">${premium}</span>.
              </p>
            </div>

            <div className="border-t border-[var(--border)]" />

            <p className="text-[clamp(1.1rem,2.5vw,1.4rem)] font-medium text-[var(--accent)]">
              Either way: +${premium} earned.
            </p>
          </motion.div>
        </AnimatePresence>

        <WalletCTA />

        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="text-[var(--text-secondary)] opacity-60 text-base"
        >
          Your money is locked until the end. Only the closing price matters, not what happens in between.
        </motion.p>
      </div>
    </section>
  );
}

/* ── Wallet CTA ── */

function WalletCTA() {
  const { isConnected, login } = useWallet();

  if (isConnected) {
    return (
      <Link
        href="/earn"
        className="inline-block rounded-xl px-8 py-3.5 text-base font-semibold bg-[var(--accent)] text-[var(--bg)] hover:bg-[var(--accent-hover)] transition-colors"
      >
        Start earning &rarr;
      </Link>
    );
  }

  return (
    <button
      onClick={login}
      className="rounded-xl px-8 py-3.5 text-base font-semibold bg-[var(--accent)] text-[var(--bg)] hover:bg-[var(--accent-hover)] transition-colors"
    >
      Connect wallet to start
    </button>
  );
}

/* ── Section 2b: Yield Source ── */

function YieldSourceSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-20%" });

  return (
    <section ref={ref} className="py-32 flex items-center justify-center px-6 relative z-[3]">
      <div className="max-w-3xl w-full space-y-10">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
          className="text-[clamp(2rem,6vw,4rem)] font-light text-[var(--bone)] tracking-tight"
        >
          Where does the money come from?
        </motion.h2>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 15 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="space-y-6"
        >
          <p className="text-[clamp(1.1rem,2.5vw,1.5rem)] text-[var(--text-secondary)]">
            From the market. You set a price, someone pays to lock it in.
          </p>
          <p className="text-[clamp(1.1rem,2.5vw,1.5rem)] text-[var(--text-secondary)]">
            Price not reached? You collect and your money comes back untouched.
            <br />
            Price reached? You buy or sell at the price you chose. And you still collect.
          </p>
          <p className="text-[clamp(1.1rem,2.5vw,1.5rem)] text-[var(--text)]">
            You pick the price. You pick the amount. And you get paid upfront, every time.
          </p>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="text-[clamp(1.1rem,2.5vw,1.4rem)] font-medium text-[var(--accent)]"
        >
          Not token rewards. Not incentives. It&apos;s what the market pays for a guaranteed price.
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

function buildLoopFrames(
  side: "buy" | "sell",
  buyStrike: number,
  sellStrike: number,
  buyPremium: number,
  sellPremium: number,
): LoopFrame[] {
  const bs = `$${buyStrike.toLocaleString()}`;
  const ss = `$${sellStrike.toLocaleString()}`;
  const bp = buyPremium;
  const sp = sellPremium;

  if (side === "buy") return [
    { text: `Buy ETH @ ${bs}` },
    { text: `Earn $${bp} ✓`, accent: true, counter: bp },
    { text: `Price didn't hit.\n${bs} back.`, secondary: true },
    { text: "Earn again →", accent: true, pulse: true },
    { text: `Buy ETH @ ${bs}` },
    { text: `Earn $${bp} ✓`, accent: true, counter: bp },
    { text: `Price hit.\nYou bought ETH @ ${bs}.`, secondary: true },
    { text: "You now have ETH.\nSet a sell price.", slow: true },
    { text: `Sell ETH @ ${ss}` },
    { text: `Earn $${sp} ✓`, accent: true, counter: sp },
    { text: "Earn again →", accent: true, pulse: true },
  ];

  return [
    { text: `Sell ETH @ ${ss}` },
    { text: `Earn $${sp} ✓`, accent: true, counter: sp },
    { text: "Price didn't hit.\nYour ETH comes back.", secondary: true },
    { text: "Earn again →", accent: true, pulse: true },
    { text: `Sell ETH @ ${ss}` },
    { text: `Earn $${sp} ✓`, accent: true, counter: sp },
    { text: `Price hit.\nYou sold ETH @ ${ss}.`, secondary: true },
    { text: "You now have dollars.\nSet a buy price.", slow: true },
    { text: `Buy ETH @ ${bs}` },
    { text: `Earn $${bp} ✓`, accent: true, counter: bp },
    { text: "Earn again →", accent: true, pulse: true },
  ];
}

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

const LoopSection = memo(function LoopSection({
  side,
  buyStrike,
  sellStrike,
  spotBase,
}: {
  side: "buy" | "sell";
  buyStrike: number;
  sellStrike: number;
  spotBase: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-20%" });
  const [frameIndex, setFrameIndex] = useState(0);
  const buyPremium = derivePremium(spotBase, "buy", buyStrike, sellStrike);
  const sellPremium = derivePremium(spotBase, "sell", buyStrike, sellStrike);
  const frames = useMemo(
    () => buildLoopFrames(side, buyStrike, sellStrike, buyPremium, sellPremium),
    [side, buyStrike, sellStrike, buyPremium, sellPremium],
  );

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
    <section ref={ref} className="min-h-screen flex items-center justify-center px-6 relative z-[3]">
      <div className="max-w-3xl w-full space-y-12">
        <FadeBlock>
          <h2 className="text-[clamp(2rem,6vw,4rem)] font-light text-[var(--bone)] tracking-tight">
            Every outcome earns.
          </h2>
        </FadeBlock>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/50 p-10 min-h-[160px] flex items-center justify-center">
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
                      ? "font-semibold text-[var(--accent)]"
                      : frame.secondary
                        ? "text-[var(--text-secondary)] font-light"
                        : "text-[var(--text)] font-light"
                  }`}
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
          <p className="text-center text-[var(--text-secondary)] text-lg">
            Real earnings. Paid upfront. Every cycle.
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
    <section ref={ref} className="min-h-screen flex items-center justify-center px-6 relative z-[3]">
      <div className="max-w-3xl w-full space-y-12">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
          className="text-[clamp(2rem,6vw,4rem)] font-light text-[var(--bone)] tracking-tight"
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
              className="flex items-center justify-between py-4 border-b border-[var(--border)]"
            >
              <span className="text-[var(--text-secondary)] text-base sm:text-lg">{item.name}</span>
              <div className="flex items-center gap-4">
                <span className="text-[var(--text-secondary)] text-base sm:text-lg font-light">{item.apr}</span>
                <div className="hidden sm:flex items-center gap-2 text-sm">
                  {item.pros.map((p) => (
                    <span key={p} className="text-[var(--text-secondary)] opacity-60">{"✓"} {p}</span>
                  ))}
                  {item.cons.map((c) => (
                    <span key={c} className="text-[var(--text-secondary)] opacity-50">{"✗"} {c}</span>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}

          {/* b1nary row — highlighted */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 15 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="flex items-center justify-between py-5 rounded-xl px-4 -mx-4 bg-[var(--accent)]/6 border-b border-[var(--accent)]/15"
          >
            <span className="text-[var(--bone)] text-base sm:text-lg font-medium font-mono">b<span className="text-[var(--accent)]">1</span>nary</span>
            <div className="flex items-center gap-4">
              <span className="text-lg sm:text-xl font-semibold text-[var(--accent)]">15–60%</span>
              <div className="hidden sm:flex items-center gap-2 text-sm text-[var(--accent)]">
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
  { label: "Backed", value: "100%" },
  { label: "Margin calls", value: "None" },
  { label: "Contracts", value: "Verified" },
];

const SocialProofSection = memo(function SocialProofSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-20%" });

  return (
    <section ref={ref} className="py-32 flex items-center justify-center px-6 relative z-[3]">
      <div className="max-w-3xl w-full space-y-12">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
          className="text-[clamp(1.5rem,4vw,2.5rem)] font-light text-[var(--text)] tracking-tight text-center"
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
              <p className="text-2xl sm:text-3xl font-semibold text-[var(--bone)] font-mono">{stat.value}</p>
              <p className="text-sm text-[var(--text-secondary)] opacity-60 mt-1">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="text-center text-[var(--text-secondary)] opacity-50 text-sm"
        >
          Smart contracts verified on BaseScan · Open source
        </motion.p>
      </div>
    </section>
  );
});

/* ── Section 6: Agent-Native ── */

function AgentNativeSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });

  return (
    <section ref={ref} className="py-32 flex items-center justify-center px-6 relative z-[3]">
      <div className="max-w-3xl w-full space-y-8">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
          className="text-[clamp(1.5rem,4vw,2.5rem)] font-light text-[var(--bone)] tracking-tight"
        >
          Built for humans and their agents.
        </motion.h2>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 15 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="space-y-4"
        >
          <p className="text-[clamp(1.1rem,2.5vw,1.4rem)] text-[var(--text-secondary)]">
            Humans use the app. Agents use the API.
            <br />
            Same contracts. Same settlement. Same earnings.
          </p>
          <p className="text-[var(--text-secondary)] text-base opacity-60">
            The protocol is permissionless. Anyone (or anything) can read prices, evaluate, and execute.
          </p>
        </motion.div>
      </div>
    </section>
  );
}

/* ── Section 7: CTA ── */

function CTASection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-20%" });

  return (
    <section ref={ref} className="min-h-[70vh] flex items-center justify-center px-6 relative z-[3]">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
        transition={{ duration: 0.8 }}
        className="max-w-3xl w-full text-center space-y-10"
      >
        <h2 className="text-[clamp(2.5rem,8vw,6rem)] text-[var(--bone)] leading-[0.95] tracking-tight font-light">
          Set your price.
          <br />
          Get paid.
        </h2>

        <Link
          href="/earn"
          className="inline-block rounded-xl px-10 py-4 text-base font-semibold bg-[var(--accent)] text-[var(--bg)] hover:bg-[var(--accent-hover)] transition-colors"
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
  const spotBase = useLiveSpot();
  const [spot, setSpot] = useState(spotBase);
  const { buyStrike, sellStrike } = useMemo(() => deriveStrikes(spotBase), [spotBase]);

  useEffect(() => { setSpot(spotBase); }, [spotBase]);

  const handleSpotChange = useCallback((p: number) => setSpot(p), []);

  return (
    <div className="bg-[var(--bg)] relative overflow-hidden">
      {/* Global background layers */}
      <BackgroundEffects />

      <header className="fixed top-0 left-0 right-0 z-50 px-6 py-5 flex items-center justify-between">
        <HeaderLogo />
        <Link
          href="/earn"
          className="rounded-lg px-4 py-2 text-sm font-medium border text-[var(--accent)] border-[var(--accent)]/30 hover:border-[var(--accent)]/60 transition-all"
        >
          Try the beta &rarr;
        </Link>
      </header>

      <main>
        <HeroSection />
        <MechanismSection side={side} onSideChange={setSide} spot={spot} spotBase={spotBase} onSpotChange={handleSpotChange} buyStrike={buyStrike} sellStrike={sellStrike} />
        <YieldSourceSection />
        <LoopSection side={side} buyStrike={buyStrike} sellStrike={sellStrike} spotBase={spotBase} />
        <ComparisonSection />
        <SocialProofSection />
        <AgentNativeSection />
        <CTASection />
      </main>
    </div>
  );
}
