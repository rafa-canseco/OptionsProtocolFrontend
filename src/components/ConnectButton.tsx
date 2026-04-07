"use client";

import { useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import { useBalances } from "@/hooks/useBalances";
import { useSpot } from "@/hooks/useSpot";
import { DepositModal } from "@/components/DepositModal";

export function ConnectButton() {
  const { address, isConnected, isReady, connectWallet } = useWallet();
  const { usd, eth, weth, wbtc, loading: balancesLoading } = useBalances(address);
  const { spot: ethSpot } = useSpot("eth");
  const { spot: btcSpot } = useSpot("btc");
  const [showDeposit, setShowDeposit] = useState(false);

  if (!isReady) {
    return <div className="h-9 w-24 animate-pulse rounded-full bg-[var(--surface)]" />;
  }

  if (isConnected) {
    const totalUsd = usd
      + (eth + weth) * (ethSpot ?? 0)
      + wbtc * (btcSpot ?? 0);
    const hasBalance = totalUsd > 0;
    const balanceLabel = hasBalance
      ? `$${totalUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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
      onClick={connectWallet}
      className="rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-[var(--bg)] hover:bg-[var(--accent-hover)] transition-colors"
    >
      Connect
    </button>
  );
}
