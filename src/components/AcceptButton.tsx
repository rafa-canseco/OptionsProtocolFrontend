"use client";

import { useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import { api, type PriceQuote } from "@/lib/api";

export function AcceptButton({ quote }: { quote: PriceQuote }) {
  const { address, isConnected, login } = useWallet();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<"success" | "error" | null>(null);

  const expired = quote.expires_at < Date.now() / 1000;

  async function handleAccept() {
    if (!isConnected || !address) {
      login();
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      await api.acceptOrder({
        user_address: address,
        option_type: quote.option_type,
        strike: quote.strike,
        expiry_days: quote.expiry_days,
        premium: quote.premium,
        spot_at_lock: quote.spot,
        iv_at_lock: quote.iv,
      });
      setResult("success");
      setTimeout(() => setResult(null), 3000);
    } catch {
      setResult("error");
      setTimeout(() => setResult(null), 3000);
    } finally {
      setLoading(false);
    }
  }

  if (result === "success") {
    return (
      <span className="rounded-lg bg-green-900/50 px-4 py-2 text-sm text-green-400">
        Accepted
      </span>
    );
  }

  if (result === "error") {
    return (
      <span className="rounded-lg bg-red-900/50 px-4 py-2 text-sm text-red-400">
        Failed
      </span>
    );
  }

  return (
    <button
      onClick={handleAccept}
      disabled={loading || expired}
      className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-black hover:bg-[var(--accent-dim)] disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {loading ? "..." : !isConnected ? "Connect" : expired ? "Expired" : "Accept"}
    </button>
  );
}
