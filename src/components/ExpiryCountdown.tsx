"use client";

import { useState, useEffect } from "react";

export function ExpiryCountdown({ createdAt, expiryDays }: { createdAt: string; expiryDays: number }) {
  const [label, setLabel] = useState("");

  useEffect(() => {
    const expiryMs = new Date(createdAt).getTime() + expiryDays * 86_400_000;

    const tick = () => {
      const remaining = expiryMs - Date.now();
      if (remaining <= 0) {
        setLabel("Expired");
        return;
      }
      const days = Math.floor(remaining / 86_400_000);
      const hours = Math.floor((remaining % 86_400_000) / 3_600_000);
      if (days > 0) {
        setLabel(`${days}d ${hours}h`);
      } else {
        const mins = Math.floor((remaining % 3_600_000) / 60_000);
        setLabel(`${hours}h ${mins}m`);
      }
    };

    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [createdAt, expiryDays]);

  return <>{label}</>;
}
