"use client";

import { useState, useEffect, useRef } from "react";

type Side = "buy" | "sell";

interface Scenario {
  side: Side;
  strike: number;
  premium: number;
}

const SCENARIOS: Scenario[] = [
  { side: "buy", strike: 2400, premium: 61 },
  { side: "buy", strike: 2200, premium: 85 },
  { side: "sell", strike: 2800, premium: 38 },
  { side: "sell", strike: 3000, premium: 27 },
  { side: "buy", strike: 2500, premium: 48 },
  { side: "sell", strike: 3200, premium: 18 },
];

export function TickingStrike({
  onScenarioChange,
}: {
  onScenarioChange?: (scenario: Scenario) => void;
}) {
  const [index, setIndex] = useState(0);
  const [display, setDisplay] = useState(SCENARIOS[0].strike);
  const prevRef = useRef(SCENARIOS[0].strike);
  const frameRef = useRef<number>(0);

  // Cycle through scenarios
  useEffect(() => {
    const id = setInterval(() => {
      setIndex((prev) => (prev + 1) % SCENARIOS.length);
    }, 3500);
    return () => clearInterval(id);
  }, []);

  // Notify parent when index changes (in a separate effect, not during render)
  useEffect(() => {
    onScenarioChange?.(SCENARIOS[index]);
  }, [index, onScenarioChange]);

  // Animate number transition
  useEffect(() => {
    const from = prevRef.current;
    const to = SCENARIOS[index].strike;
    prevRef.current = to;
    if (from === to) return;

    const duration = 500;
    const start = performance.now();

    const animate = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [index]);

  return <>${display.toLocaleString()}</>;
}

export type { Scenario };
