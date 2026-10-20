"use client";

import { useState, useEffect } from "react";

interface Props {
  createdAt?: string;
  expiryDays?: number;
  expiryTimestamp?: number;
  pending?: boolean;
}

export function ExpiryCountdown({
  createdAt,
  expiryDays,
  expiryTimestamp,
  pending = false,
}: Props) {
  const [label, setLabel] = useState("");

  useEffect(() => {
    if (pending) {
      setLabel("Expiry pending reconciliation");
      return;
    }
    const expiryMs = expiryTimestamp
      ? expiryTimestamp * 1000
      : createdAt && expiryDays
        ? new Date(createdAt).getTime() + expiryDays * 86_400_000
        : NaN;

    if (Number.isNaN(expiryMs)) {
      setLabel("—");
      return;
    }

    const tick = () => {
      const remaining = expiryMs - Date.now();
      if (remaining <= 0) {
        setLabel("Expired");
        return;
      }
      const totalMinutes = Math.ceil(remaining / 60_000);
      const days = Math.floor(totalMinutes / 1_440);
      const hours = Math.floor((totalMinutes % 1_440) / 60);
      if (days > 0) {
        setLabel(`Settlement in ${days}d ${hours}h`);
      } else {
        const mins = totalMinutes % 60;
        setLabel(`Settlement in ${hours}h ${mins}m`);
      }
    };

    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [createdAt, expiryDays, expiryTimestamp, pending]);

  return <>{label}</>;
}
