"use client";

import { useState, useEffect, useRef } from "react";

function Sparkline({ prices }: { prices: number[] }) {
  if (prices.length < 2) return null;

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const w = 120;
  const h = 40;
  const padding = 4;

  const points = prices.map((p, i) => {
    const x = (i / (prices.length - 1)) * w;
    const y = padding + (1 - (p - min) / range) * (h - padding * 2);
    return `${x},${y}`;
  });

  const isUp = prices[prices.length - 1] >= prices[0];

  return (
    <svg width={w} height={h} className="opacity-40">
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={isUp ? "var(--accent)" : "var(--danger)"}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AnimatedNumber({ value, prefix = "" }: { value: number; prefix?: string }) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const from = prevRef.current;
    const to = value;
    prevRef.current = value;

    if (from === to) return;

    const duration = 400;
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);
      // ease-out quad
      const eased = 1 - (1 - t) * (1 - t);
      setDisplay(from + (to - from) * eased);
      if (t < 1) frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [value]);

  return (
    <span>
      {prefix}
      {display.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </span>
  );
}

export function LivePrice({ spot, className = "" }: { spot: number | undefined; className?: string }) {
  const [history, setHistory] = useState<number[]>([]);
  const prevSpot = useRef<number | undefined>(undefined);
  const [direction, setDirection] = useState<"up" | "down" | null>(null);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (spot === undefined) return;

    setHistory((prev) => {
      const next = [...prev, spot].slice(-20);
      return next;
    });

    if (prevSpot.current !== undefined && prevSpot.current !== spot) {
      setDirection(spot > prevSpot.current ? "up" : "down");
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 300);
      prevSpot.current = spot;
      return () => clearTimeout(t);
    }
    prevSpot.current = spot;
  }, [spot]);

  if (spot === undefined) {
    return <div className={`h-14 w-48 animate-pulse rounded-xl bg-[var(--surface)] ${className}`} />;
  }

  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <div>
        <p className={`text-4xl font-bold text-[var(--bone)] font-mono tabular-nums ${flash ? "price-flash" : ""}`}>
          <AnimatedNumber value={spot} prefix="$" />
        </p>
      </div>
      <Sparkline prices={history} />
    </div>
  );
}
