"use client";

import { useState } from "react";
import type { Address } from "viem";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function useFaucet(address: Address | undefined, onComplete?: () => void) {
  const [minting, setMinting] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function mint() {
    if (!address) {
      console.warn("[useFaucet] mint called without address");
      return;
    }
    setMinting(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/faucet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });

      if (!res.ok) {
        let detail: string | undefined;
        try {
          const body = await res.json();
          detail = body.detail;
        } catch {
          const text = await res.text().catch(() => "");
          console.error("[useFaucet] Non-JSON error response:", text);
        }
        throw new Error(detail || `Faucet error (${res.status})`);
      }

      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 5000);
      window.dispatchEvent(new Event("balance:refetch"));
      await onComplete?.();
    } catch (err) {
      console.error("[useFaucet] Mint failed:", err);
      setError(err instanceof Error ? err.message : "Failed to get test tokens. Try again.");
    } finally {
      setMinting(false);
    }
  }

  return { mint, minting, showNotification, error };
}
