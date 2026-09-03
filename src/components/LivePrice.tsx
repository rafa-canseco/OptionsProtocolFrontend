"use client";

import { useEffect, useRef, useState } from "react";

export function LivePrice({ spot, className = "" }: { spot: number | undefined; className?: string }) {
  const previousSpot = useRef(spot);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (spot === undefined || previousSpot.current === spot) return;
    previousSpot.current = spot;
    setFlash(true);
    const timeout = window.setTimeout(() => setFlash(false), 180);
    return () => window.clearTimeout(timeout);
  }, [spot]);

  if (spot === undefined) {
    return <div className={`h-14 w-48 animate-pulse rounded-xl bg-[var(--surface)] ${className}`} />;
  }

  return (
    <div className={className}>
      <p className={`text-2xl font-bold tabular-nums text-[var(--bone)] sm:text-4xl font-mono ${flash ? "price-flash" : ""}`}>
        ${spot.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
    </div>
  );
}
