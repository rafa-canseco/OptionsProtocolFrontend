"use client";

import { useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import { useBalances } from "@/hooks/useBalances";
import { useSpot } from "@/hooks/useSpot";
import { toUsd } from "@/lib/pricing";
import { DepositModal } from "@/components/DepositModal";

export function ConnectButton() {
  const { address, isConnected, isReady, connectWallet } = useWallet();
  const { usd, eth, weth, wbtc, loading: balancesLoading } = useBalances(address);
  const { spot: ethSpot, loading: ethSpotLoading } = useSpot("eth");
  const { spot: btcSpot, loading: btcSpotLoading } = useSpot("btc");
  const [showDeposit, setShowDeposit] = useState(false);

  if (!isReady) {
    return <div className="h-9 w-24 animate-pulse rounded-full bg-[var(--surface)]" />;
  }

  if (isConnected) {
    const totalUsd = toUsd(usd, "usdc", ethSpot, btcSpot)
      + toUsd(eth + weth, "eth", ethSpot, btcSpot)
      + toUsd(wbtc, "btc", ethSpot, btcSpot);
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
          {(balancesLoading || ethSpotLoading || btcSpotLoading) ? "..." : balanceLabel}
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
