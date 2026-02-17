"use client";

import Link from "next/link";
import { useRef, useState, useCallback, useEffect, memo } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { TickingPrice } from "./TickingPrice";
import { CountUp } from "./CountUp";
import { StrikethroughLine } from "./StrikethroughLine";
import { CursorGlow } from "./CursorGlow";

const ACCENT = "#3B82F6";
const BUY_COLOR = "#22C55E";
const SELL_COLOR = "#EF4444";

/* ── Token logo SVGs (subtle, decorative) ── */

function EthLogo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className}>
      <path d="M16 2L6 16.2L16 22L26 16.2L16 2Z" fill="currentColor" opacity="0.7" />
      <path d="M6 18L16 30L26 18L16 24L6 18Z" fill="currentColor" opacity="0.4" />
    </svg>
  );
}

function UniLogo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className}>
      <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
      <path d="M12 10C12 10 11 16 11 19C11 22 13 24 16 24C19 24 21 22 21 19C21 16 20 10 20 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
      <circle cx="13.5" cy="13" r="1" fill="currentColor" opacity="0.6" />
      <circle cx="18.5" cy="13" r="1" fill="currentColor" opacity="0.6" />
    </svg>
  );
}

function AaveLogo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className}>
      <path d="M16 4L4 28H11L16 16L21 28H28L16 4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" opacity="0.5" />
    </svg>
  );
}

function LinkLogo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className}>
      <path d="M16 2L28 9V23L16 30L4 23V9L16 2Z" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
      <path d="M16 8L22 11.5V18.5L16 22L10 18.5V11.5L16 8Z" fill="currentColor" opacity="0.3" />
    </svg>
  );
}

function UsdcLogo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className}>
      <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
      <path d="M13 20C13 21.7 14.3 23 16 23C17.7 23 19 21.7 19 20C19 18.3 17.7 17 16 17C14.3 17 13 15.7 13 14C13 12.3 14.3 11 16 11C17.7 11 19 12.3 19 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      <line x1="16" y1="9" x2="16" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      <line x1="16" y1="23" x2="16" y2="25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

interface FloatingTokenProps {
  children: React.ReactNode;
  x: string;
  y: string;
  size: number;
  duration: number;
  delay?: number;
  drift: [number, number];
}

function FloatingToken({ children, x, y, size, duration, delay = 0, drift }: FloatingTokenProps) {
  return (
    <motion.div
      animate={{
        y: [drift[0], drift[1], drift[0]],
        rotate: [0, 5, -5, 0],
      }}
      transition={{
        duration,
        repeat: Infinity,
        ease: "easeInOut",
        delay,
      }}
      className="absolute hidden lg:block text-[#FAFAFA]"
      style={{ left: x, top: y, width: size, height: size, opacity: 0.18 }}
    >
      {children}
    </motion.div>
  );
}

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
          background: "radial-gradient(circle, rgba(59,130,246,0.07) 0%, transparent 70%)",
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
          background: "radial-gradient(circle, rgba(13,159,110,0.05) 0%, transparent 70%)",
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
          background: "radial-gradient(circle, rgba(59,130,246,0.04) 0%, transparent 70%)",
        }}
      />
    </div>
  );
}

function GridBackground() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0"
      style={{
        backgroundImage: `
          linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)
        `,
        backgroundSize: "80px 80px",
        maskImage: "radial-gradient(ellipse 80% 60% at 50% 50%, black 20%, transparent 100%)",
        WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 50%, black 20%, transparent 100%)",
      }}
    />
  );
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

const SPOT_BASE = 2621;
const BUY_STRIKE = 2400;
const SELL_STRIKE = 2800;
const BUY_PREMIUM_BASE = 61;
const SELL_PREMIUM_BASE = 42;

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

function HeroSection({
  side,
  onSideChange,
  hasLoaded,
  onLoaded,
  spot,
  onSpotChange,
}: {
  side: "buy" | "sell";
  onSideChange: (s: "buy" | "sell") => void;
  hasLoaded: boolean;
  onLoaded: () => void;
  spot: number;
  onSpotChange: (p: number) => void;
}) {
  const strike = side === "buy" ? BUY_STRIKE : SELL_STRIKE;
  const premium = derivePremium(spot, side);
  const sideColor = side === "buy" ? BUY_COLOR : SELL_COLOR;

  // Mark loaded after initial counter finishes
  useEffect(() => {
    if (!hasLoaded) {
      const timer = setTimeout(onLoaded, 1400);
      return () => clearTimeout(timer);
    }
  }, [hasLoaded, onLoaded]);

  return (
    <section className="min-h-screen flex flex-col justify-center px-6 relative">
      {/* Floating token logos — left side */}
      <FloatingToken x="3%" y="15%" size={72} duration={12} drift={[-15, 15]}>
        <EthLogo className="w-full h-full" />
      </FloatingToken>
      <FloatingToken x="7%" y="50%" size={56} duration={16} delay={3} drift={[-10, 20]}>
        <UsdcLogo className="w-full h-full" />
      </FloatingToken>
      <FloatingToken x="5%" y="75%" size={48} duration={20} delay={7} drift={[-8, 16]}>
        <LinkLogo className="w-full h-full" />
      </FloatingToken>

      {/* Floating token logos — right side */}
      <FloatingToken x="87%" y="20%" size={64} duration={14} delay={1} drift={[-20, 10]}>
        <UniLogo className="w-full h-full" />
      </FloatingToken>
      <FloatingToken x="90%" y="55%" size={60} duration={18} delay={5} drift={[-12, 18]}>
        <AaveLogo className="w-full h-full" />
      </FloatingToken>
      <FloatingToken x="85%" y="80%" size={52} duration={15} delay={9} drift={[-14, 12]}>
        <UsdcLogo className="w-full h-full" />
      </FloatingToken>

      <div className="max-w-3xl mx-auto w-full space-y-10 relative z-10">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
        >
          <SideToggle side={side} onSideChange={onSideChange} />
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="text-[#71717A] text-[clamp(1rem,2.5vw,1.4rem)]"
        >
          {side === "buy"
            ? "Set the price you'd buy ETH at. Earn while you wait."
            : "Set the price you'd sell ETH at. Earn while you hold."}
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-[#71717A] text-[clamp(1.2rem,3vw,1.8rem)]"
        >
          ETH is <TickingPrice base={SPOT_BASE} className="text-[#FAFAFA] font-bold" onPriceChange={onSpotChange} />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="text-[clamp(2.5rem,8vw,7rem)] leading-[0.95] font-light text-[#FAFAFA] tracking-tight"
        >
          Would you{" "}
          <AnimatePresence mode="wait">
            <motion.span
              key={side}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="inline-block font-medium"
              style={{ color: sideColor }}
            >
              {side} it
            </motion.span>
          </AnimatePresence>
          <br />
          at{" "}
          <AnimatePresence mode="wait">
            <motion.span
              key={strike}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="inline-block"
              style={{ color: sideColor }}
            >
              ${strike.toLocaleString()}
            </motion.span>
          </AnimatePresence>
          ?
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.2 }}
        >
          <p className="text-[clamp(1.3rem,3vw,2rem)] font-light text-[#71717A]">
            Get{" "}
            <span className="font-bold" style={{ color: sideColor }}>
              {hasLoaded ? <AnimatedPremium value={premium} /> : <CountUp target={side === "buy" ? BUY_PREMIUM_BASE : SELL_PREMIUM_BASE} duration={1200} />}
            </span>
            {" "}upfront.
          </p>
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
          ↓
        </motion.span>
      </motion.div>
    </section>
  );
}

function OutcomesSection({ side, spot }: { side: "buy" | "sell"; spot: number }) {
  const strike = side === "buy" ? BUY_STRIKE : SELL_STRIKE;
  const premium = derivePremium(spot, side);
  const sideColor = side === "buy" ? BUY_COLOR : SELL_COLOR;

  return (
    <section className="min-h-screen flex items-center justify-center px-6 relative">
      {/* Floating tokens — both sides */}
      <FloatingToken x="4%" y="25%" size={60} duration={15} delay={2} drift={[-12, 12]}>
        <LinkLogo className="w-full h-full" />
      </FloatingToken>
      <FloatingToken x="6%" y="65%" size={48} duration={18} delay={6} drift={[-10, 16]}>
        <AaveLogo className="w-full h-full" />
      </FloatingToken>
      <FloatingToken x="88%" y="30%" size={64} duration={13} delay={4} drift={[-18, 14]}>
        <EthLogo className="w-full h-full" />
      </FloatingToken>
      <FloatingToken x="91%" y="70%" size={52} duration={17} delay={8} drift={[-14, 10]}>
        <UniLogo className="w-full h-full" />
      </FloatingToken>

      <div className="max-w-3xl w-full space-y-16">
        <AnimatePresence mode="wait">
          <motion.div
            key={side}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-16"
          >
            <FadeBlock>
              <p className="text-[#71717A] text-lg mb-3">
                If ETH hits ${strike.toLocaleString()}
              </p>
              <p className="text-[clamp(1.5rem,5vw,3rem)] font-light text-[#FAFAFA] leading-tight">
                {side === "buy"
                  ? `You buy ETH @ $${strike.toLocaleString()}.`
                  : `You sell @ $${strike.toLocaleString()}.`}
              </p>
              <p className="text-[clamp(1.2rem,3vw,2rem)] font-light text-[#71717A] mt-2">
                And keep the{" "}
                <span className="font-bold" style={{ color: sideColor }}>${premium}</span>.
              </p>
            </FadeBlock>

            <FadeBlock delay={0.2}>
              <p className="text-[#71717A] text-lg mb-3">If it doesn&apos;t</p>
              <p className="text-[clamp(1.5rem,5vw,3rem)] font-light text-[#FAFAFA] leading-tight">
                {side === "buy"
                  ? `$${strike.toLocaleString()} back`
                  : "Your ETH comes back"}{" "}
                + keep the{" "}
                <span className="font-bold" style={{ color: sideColor }}>${premium}</span>.
              </p>
            </FadeBlock>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}

const HowItWorksSection = memo(function HowItWorksSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-20%" });

  const steps = [
    { title: "Pick your price", desc: "Choose what you'd buy or sell ETH at." },
    { title: "Get paid now", desc: "Earn a premium upfront, deposited immediately." },
    { title: "Friday settles", desc: "Trade happens at your price, or your money comes back. Either way, you earned." },
  ];

  return (
    <section ref={ref} className="min-h-screen flex items-center justify-center px-6 relative">
      <FloatingToken x="4%" y="20%" size={58} duration={14} delay={3} drift={[-12, 14]}>
        <UsdcLogo className="w-full h-full" />
      </FloatingToken>
      <FloatingToken x="7%" y="60%" size={52} duration={19} delay={7} drift={[-10, 18]}>
        <EthLogo className="w-full h-full" />
      </FloatingToken>
      <FloatingToken x="89%" y="25%" size={64} duration={16} delay={1} drift={[-16, 12]}>
        <LinkLogo className="w-full h-full" />
      </FloatingToken>
      <FloatingToken x="91%" y="65%" size={48} duration={13} delay={5} drift={[-14, 10]}>
        <AaveLogo className="w-full h-full" />
      </FloatingToken>

      <div className="max-w-3xl w-full space-y-12">
        {steps.map((step, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.5, delay: i * 0.3, ease: "easeOut" }}
          >
            <p className="text-[clamp(1.5rem,4vw,2.5rem)] font-light text-[#FAFAFA] leading-relaxed">
              <span className="text-[#52525B] mr-3">{i + 1}.</span>
              {step.title}
            </p>
            <p className="text-[clamp(1.1rem,2.5vw,1.5rem)] text-[#71717A] font-light mt-2 ml-10">
              {step.desc}
            </p>
          </motion.div>
        ))}
      </div>
    </section>
  );
});

const RealYieldSection = memo(function RealYieldSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-25%" });

  return (
    <section ref={ref} className="min-h-screen flex items-center justify-center px-6 relative">
      {/* Floating tokens — both sides */}
      <FloatingToken x="3%" y="20%" size={68} duration={17} delay={1} drift={[-16, 16]}>
        <AaveLogo className="w-full h-full" />
      </FloatingToken>
      <FloatingToken x="6%" y="60%" size={52} duration={14} delay={6} drift={[-10, 14]}>
        <UsdcLogo className="w-full h-full" />
      </FloatingToken>
      <FloatingToken x="87%" y="20%" size={60} duration={12} delay={3} drift={[-14, 12]}>
        <UniLogo className="w-full h-full" />
      </FloatingToken>
      <FloatingToken x="91%" y="60%" size={56} duration={19} delay={7} drift={[-8, 18]}>
        <LinkLogo className="w-full h-full" />
      </FloatingToken>

      <div className="max-w-3xl w-full space-y-10">
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
          className="text-[clamp(2rem,6vw,4.5rem)] font-light text-[#FAFAFA] tracking-tight"
        >
          Real yield.
        </motion.p>

        <div className="space-y-4 text-[clamp(1.2rem,3vw,2rem)]">
          <div><StrikethroughLine delay={0.3}>Not a token.</StrikethroughLine></div>
          <div><StrikethroughLine delay={0.7}>Not staking rewards.</StrikethroughLine></div>
          <div><StrikethroughLine delay={1.1}>Not points.</StrikethroughLine></div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 15 }}
          transition={{ duration: 0.6, delay: 2 }}
          className="space-y-1"
        >
          <p className="text-[clamp(1.2rem,3vw,2rem)] font-light" style={{ color: ACCENT }}>
            Real market activity.
          </p>
          <p className="text-[clamp(1.2rem,3vw,2rem)] text-[#FAFAFA] font-light">
            Paid upfront.
          </p>
        </motion.div>
      </div>
    </section>
  );
});

const UseCasesSection = memo(function UseCasesSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-20%" });

  const cases = [
    { title: "Want to buy ETH cheaper?", desc: "Set your price below market. Earn while you wait for the dip." },
    { title: "Already holding ETH?", desc: "Set a sell target above market. Earn while you hold." },
    { title: "Just want yield?", desc: "Repeat every week. No token, no lock-up." },
  ];

  return (
    <section ref={ref} className="min-h-screen flex items-center justify-center px-6 relative">
      <FloatingToken x="5%" y="25%" size={60} duration={16} delay={2} drift={[-12, 14]}>
        <EthLogo className="w-full h-full" />
      </FloatingToken>
      <FloatingToken x="88%" y="35%" size={56} duration={14} delay={5} drift={[-10, 16]}>
        <UsdcLogo className="w-full h-full" />
      </FloatingToken>

      <div className="max-w-3xl w-full space-y-12">
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
          className="text-[clamp(2rem,6vw,4.5rem)] font-light text-[#FAFAFA] tracking-tight"
        >
          Who is this for?
        </motion.p>

        <div className="space-y-8">
          {cases.map((c, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ duration: 0.5, delay: 0.3 + i * 0.2, ease: "easeOut" }}
              className="rounded-2xl border border-[#27272A] bg-[#18181B]/50 p-8"
            >
              <p className="text-[clamp(1.3rem,3vw,2rem)] font-light text-[#FAFAFA]">
                {c.title}
              </p>
              <p className="text-[clamp(1rem,2.5vw,1.3rem)] text-[#71717A] font-light mt-2">
                {c.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
});

/* ── Loop frame types ── */
type LoopFrame = {
  text: string;
  accent?: boolean;
  counter?: number;
  pulse?: boolean;
  secondary?: boolean;
  slow?: boolean; // 2.5s instead of 2s
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

  // Reset to frame 0 when side changes
  useEffect(() => {
    setFrameIndex(0);
  }, [side]);

  // Variable timing: 2.5s for "slow" frames, 2s for all others
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
      <FloatingToken x="3%" y="20%" size={66} duration={15} delay={2} drift={[-14, 16]}>
        <EthLogo className="w-full h-full" />
      </FloatingToken>
      <FloatingToken x="7%" y="65%" size={50} duration={18} delay={8} drift={[-10, 18]}>
        <UsdcLogo className="w-full h-full" />
      </FloatingToken>
      <FloatingToken x="88%" y="25%" size={58} duration={13} delay={6} drift={[-10, 14]}>
        <UniLogo className="w-full h-full" />
      </FloatingToken>
      <FloatingToken x="91%" y="60%" size={54} duration={16} delay={4} drift={[-16, 12]}>
        <LinkLogo className="w-full h-full" />
      </FloatingToken>

      <div className="max-w-3xl w-full space-y-16">
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
          className="text-[clamp(2rem,6vw,4.5rem)] font-light text-[#FAFAFA] tracking-tight"
        >
          Every outcome earns.
        </motion.p>

        {/* Animated frame sequence */}
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
                    <>Earn <LoopCounter target={frame.counter} /> ✓</>
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
      </div>
    </section>
  );
});

const PromiseSection = memo(function PromiseSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-25%" });

  return (
    <section ref={ref} className="min-h-screen flex items-center justify-center px-6">
      <motion.p
        initial={{ opacity: 0 }}
        animate={inView ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 1.5, ease: "easeOut" }}
        className="text-[clamp(4rem,12vw,10rem)] font-light text-[#FAFAFA] leading-[0.95] tracking-tight text-center max-w-5xl"
      >
        There&apos;s no exit
        <br />
        that isn&apos;t earning.
      </motion.p>
    </section>
  );
});

const CTASection = memo(function CTASection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-20%" });

  return (
    <section ref={ref} className="min-h-screen flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
        transition={{ duration: 0.8 }}
        className="max-w-3xl w-full text-center space-y-10"
      >
        <h2 className="text-[clamp(2.5rem,8vw,6rem)] font-light text-[#FAFAFA] leading-[0.95] tracking-tight">
          Set your price.
          <br />
          Get paid.
        </h2>

        <div className="space-y-6">
          <Link
            href="/earn"
            className="inline-block rounded-xl px-10 py-4 text-base font-semibold text-white hover:opacity-90 transition-opacity"
            style={{ backgroundColor: ACCENT }}
          >
            Launch app
          </Link>

          <div className="flex max-w-md mx-auto gap-3">
            <input
              type="email"
              placeholder="Enter your email"
              className="flex-1 rounded-xl bg-[#18181B] border border-[#27272A] px-4 py-3 text-sm text-[#FAFAFA] placeholder:text-[#52525B] focus:outline-none focus:border-[#3B82F6] transition-colors"
            />
            <button
              type="submit"
              className="rounded-xl px-6 py-3 text-sm font-semibold text-[#71717A] border border-[#27272A] hover:text-[#FAFAFA] hover:border-[#52525B] transition-colors whitespace-nowrap"
            >
              Join waitlist
            </button>
          </div>
          <p className="text-xs text-[#52525B]">or join the waitlist for early access</p>
        </div>
      </motion.div>
    </section>
  );
});

export function LandingPage() {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [hasLoaded, setHasLoaded] = useState(false);
  const [spot, setSpot] = useState(SPOT_BASE);

  const handleLoaded = useCallback(() => setHasLoaded(true), []);
  const handleSpotChange = useCallback((p: number) => setSpot(p), []);

  return (
    <div className="bg-[#0A0A0A] relative overflow-hidden">
      <GridBackground />
      <FloatingOrbs />
      <CursorGlow />

      <header className="fixed top-0 left-0 right-0 z-50 px-6 py-5 flex items-center justify-between">
        <span className="text-[#FAFAFA] text-lg font-bold tracking-tight">loot</span>
        <Link
          href="/earn"
          className="rounded-lg px-4 py-2 text-sm font-medium text-[#FAFAFA] border border-[#27272A] hover:border-[#52525B] hover:bg-[#18181B] transition-all"
        >
          Launch app →
        </Link>
      </header>

      <HeroSection side={side} onSideChange={setSide} hasLoaded={hasLoaded} onLoaded={handleLoaded} spot={spot} onSpotChange={handleSpotChange} />
      <OutcomesSection side={side} spot={spot} />
      <HowItWorksSection />
      <RealYieldSection />
      <UseCasesSection />
      <LoopSection side={side} />
      <PromiseSection />
      <CTASection />
    </div>
  );
}
