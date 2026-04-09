"use client";

import { useState } from "react";
import type { Address } from "viem";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface FaucetOpts {
  address: Address | undefined;
  solanaAddress: string | undefined;
  onComplete?: () => void;
}

export function useFaucet({ address, solanaAddress, onComplete }: FaucetOpts) {
  const [minting, setMinting] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function callFaucet(
    url: string,
    body: Record<string, string>,
  ): Promise<void> {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      let detail: string | undefined;
      try {
        const data = await res.json();
        detail = data.detail;
      } catch {
        /* non-JSON response */
      }
      throw new Error(detail || `Faucet error (${res.status})`);
    }
  }

  async function mint() {
    if (!address) {
      console.warn("[useFaucet] mint called without address");
      return;
    }
    setMinting(true);
    setError(null);

    const results: string[] = [];

    try {
      const baseFaucet = callFaucet(
        `${API_BASE}/faucet`,
        { address },
      ).then(() => {
        results.push("100,000 USDC, 50 ETH, and 2 BTC on Base");
      });

      const solanaFaucet = solanaAddress
        ? callFaucet(
            `${API_BASE}/faucet/solana`,
            { address: solanaAddress },
          ).then(() => {
            results.push("10,000 USDC and 0.1 SOL on Solana");
          })
        : null;

      // Settle both — don't let one failure block the other
      const settled = await Promise.allSettled(
        [baseFaucet, solanaFaucet].filter(Boolean),
      );

      const failures = settled.filter((r) => r.status === "rejected");
      if (failures.length === settled.length) {
        // All failed — surface the first error
        const reason = (failures[0] as PromiseRejectedResult).reason;
        throw reason instanceof Error ? reason : new Error(String(reason));
      }

      const msg = results.length > 0
        ? `You received ${results.join("; ")}.`
        : "Faucet claimed.";
      setNotification(msg);
      setTimeout(() => setNotification(null), 5000);
      window.dispatchEvent(new Event("balance:refetch"));
      await onComplete?.();
    } catch (err) {
      console.error("[useFaucet] Mint failed:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to get test tokens. Try again.",
      );
    } finally {
      setMinting(false);
    }
  }

  return { mint, minting, notification, error };
}
