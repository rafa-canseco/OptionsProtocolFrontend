"use client";

import { useState } from "react";
import { useConnectWallet } from "@privy-io/react-auth";
import { useWalletSummary } from "@/hooks/useWalletSummary";
import { DepositModal } from "@/components/DepositModal";

export function ConnectButton() {
  const { isConnected, isReady } = useWalletSummary();
  const { connectWallet } = useConnectWallet();
  const [showDeposit, setShowDeposit] = useState(false);

  if (!isReady) {
    return (
      <div className="h-9 w-24 animate-pulse rounded-full bg-[var(--surface)]" />
    );
  }

  if (isConnected) {
    return (
      <>
        <button
          onClick={() => setShowDeposit(true)}
          className="rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-[var(--bg)] hover:bg-[var(--accent-hover)] transition-colors"
        >
          Deposit
        </button>

        {showDeposit && (
          <DepositModal onClose={() => setShowDeposit(false)} />
        )}
      </>
    );
  }

  return (
    <button
      onClick={connectWallet}
      className="rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-[var(--bg)] hover:bg-[var(--accent-hover)] transition-colors"
    >
      Connect
    </button>
  );
}
