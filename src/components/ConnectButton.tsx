"use client";

import { useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import { useBalances } from "@/hooks/useBalances";
import { DepositModal } from "@/components/DepositModal";

export function ConnectButton() {
  const { address, isConnected, isAuthenticated, isReady, login } = useWallet();
  const { usd, loading: balancesLoading } = useBalances(address);
  const [showDeposit, setShowDeposit] = useState(false);

  if (!isReady) {
    return <div className="h-9 w-24 animate-pulse rounded-full bg-[var(--surface)]" />;
  }

  // Authenticated but smart wallet client still initializing
  if (isAuthenticated && !isConnected) {
    return <div className="h-9 w-28 animate-pulse rounded-full bg-[var(--surface)]" />;
  }

  if (isConnected && address) {
    const hasBalance = usd > 0;
    const balanceLabel = hasBalance
      ? `$${usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : "Deposit";

    return (
      <>
        <button
          onClick={() => setShowDeposit(true)}
          className="rounded-full border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text)] hover:border-[var(--text-secondary)] transition-colors flex items-center gap-1.5"
        >
          <img src="/base.svg" alt="Base" className="w-4 h-4" />
          {balancesLoading ? "..." : balanceLabel}
        </button>

        {showDeposit && (
          <DepositModal onClose={() => setShowDeposit(false)} />
        )}
      </>
    );
  }

  return (
    <button
      onClick={login}
      className="rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-[var(--bg)] hover:bg-[var(--accent-hover)] transition-colors"
    >
      Connect
    </button>
  );
}
