"use client";

import { useState } from "react";
import { useLogin } from "@privy-io/react-auth";
import { useWalletSummary } from "@/hooks/useWalletSummary";
import { DepositModal } from "@/components/DepositModal";
import { useAppPreferences } from "@/lib/preferences";

export function ConnectButton() {
  const { locale } = useAppPreferences();
  const { isConnected, isReady } = useWalletSummary();
  const { login } = useLogin();
  const [showDeposit, setShowDeposit] = useState(false);

  if (!isReady) {
    return <div className="h-11 w-24 animate-pulse rounded-full bg-[var(--surface)]" />;
  }

  return (
    <>
      <button
        type="button"
        onClick={isConnected ? () => setShowDeposit(true) : () => login()}
        className="min-h-11 rounded-full bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--bg)] transition-[background-color,transform] duration-150 hover:bg-[var(--accent-hover)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      >
        {isConnected
          ? locale === "es" ? "Depositar" : "Deposit"
          : locale === "es" ? "Conectar" : "Connect"}
      </button>
      {showDeposit ? <DepositModal onClose={() => setShowDeposit(false)} /> : null}
    </>
  );
}
