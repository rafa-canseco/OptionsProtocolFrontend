"use client";

import { usePrivy, useWallets, useSendTransaction } from "@privy-io/react-auth";
import { type Address } from "viem";
import { baseSepolia } from "viem/chains";
import { useEffect, useCallback } from "react";

export function useWallet() {
  const { login, logout, authenticated, ready } = usePrivy();
  const { wallets } = useWallets();
  const { sendTransaction } = useSendTransaction();

  const activeWallet = wallets[0];
  const address = activeWallet?.address as Address | undefined;

  // Ensure wallet is on Base Sepolia
  useEffect(() => {
    if (!activeWallet) return;
    activeWallet.switchChain(baseSepolia.id).catch((err) => {
      console.error("[useWallet] Failed to switch chain:", err);
    });
  }, [activeWallet]);

  // Sponsored transaction sender — wraps Privy's sendTransaction with sponsor: true
  // Fire-and-forget: Privy's sendTransaction never resolves its promise,
  // so we don't await it. Callers must poll on-chain state instead.
  const sendSponsoredTx = useCallback(
    (tx: { to: Address; data: `0x${string}`; value?: bigint }) => {
      console.log("[sendSponsoredTx] Firing tx:", { to: tx.to, data: tx.data.slice(0, 10) });
      sendTransaction(
        {
          to: tx.to,
          data: tx.data,
          value: tx.value ? `0x${tx.value.toString(16)}` : undefined,
          chainId: baseSepolia.id,
        },
        { sponsor: true },
      ).then((r) => console.log("[sendSponsoredTx] Resolved:", r))
       .catch((e) => console.error("[sendSponsoredTx] Error:", e));
    },
    [sendTransaction],
  );

  return {
    address,
    sendSponsoredTx,
    isConnected: authenticated && !!address,
    isReady: ready,
    login,
    logout,
  };
}
