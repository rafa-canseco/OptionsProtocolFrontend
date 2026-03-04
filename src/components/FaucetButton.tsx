"use client";

import { useFaucet } from "@/hooks/useFaucet";
import type { BatchCall } from "@/hooks/useWallet";
import type { Address } from "viem";

type Props = {
  address: Address;
  sendBatchTx: (calls: BatchCall[]) => Promise<unknown>;
  refetch: () => void;
};

export function FaucetButton({ address, sendBatchTx, refetch }: Props) {
  const { mint, minting, showNotification, error } = useFaucet(address, sendBatchTx, refetch);

  return (
    <>
      <button
        onClick={mint}
        disabled={minting}
        className="rounded-full bg-[var(--accent)] px-4 py-1.5 text-xs font-semibold text-[var(--bg)] hover:bg-[var(--accent-hover)] disabled:opacity-40 transition-colors"
      >
        {minting ? "Getting funds..." : "Get Test Money"}
      </button>

      {showNotification && (
        <div className="mx-6 mt-2 rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 px-4 py-2.5 text-sm text-[var(--accent)] animate-fade-in-up">
          You received 100,000 USD and 50 ETH test tokens.
        </div>
      )}

      {error && (
        <div className="mx-6 mt-2 rounded-xl bg-[var(--danger)]/10 border border-[var(--danger)]/20 px-4 py-2.5 text-sm text-[var(--danger)]">
          {error}
        </div>
      )}
    </>
  );
}
