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

  // Sponsored transaction sender — wraps Privy's sendTransaction with sponsor: true.
  // Privy's sendTransaction resolves asynchronously after relay, but timing is
  // unpredictable, so callers should poll on-chain state for confirmation while
  // racing this promise to catch immediate rejections (user cancel, sponsorship fail).
  const sendSponsoredTx = useCallback(
    (tx: { to: Address; data: `0x${string}`; value?: bigint }): Promise<unknown> => {
      console.log("[sendSponsoredTx] Firing tx:", { to: tx.to, data: tx.data.slice(0, 10) });
      return sendTransaction(
        {
          to: tx.to,
          data: tx.data,
          value: tx.value ? `0x${tx.value.toString(16)}` : undefined,
          chainId: baseSepolia.id,
        },
        { sponsor: true },
      ).catch((err) => {
        console.error("[sendSponsoredTx] Error:", err);
        throw err;
      });
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
