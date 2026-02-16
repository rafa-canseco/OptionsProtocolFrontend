"use client";

import { usePrivy, useWallets } from "@privy-io/react-auth";
import { createWalletClient, custom, type WalletClient, type Address } from "viem";
import { baseSepolia } from "viem/chains";
import { useState, useEffect } from "react";

export function useWallet() {
  const { login, logout, authenticated, ready } = usePrivy();
  const { wallets } = useWallets();
  const [walletClient, setWalletClient] = useState<WalletClient | null>(null);

  const activeWallet = wallets[0];
  const address = activeWallet?.address as Address | undefined;

  useEffect(() => {
    if (!activeWallet) {
      setWalletClient(null);
      return;
    }
    let cancelled = false;
    activeWallet.getEthereumProvider().then((provider) => {
      if (cancelled) return;
      setWalletClient(
        createWalletClient({
          chain: baseSepolia,
          transport: custom(provider),
        })
      );
    }).catch((err) => {
      console.error("[useWallet] Failed to get Ethereum provider:", err);
      setWalletClient(null);
    });
    return () => { cancelled = true; };
  }, [activeWallet]);

  return {
    address,
    walletClient,
    isConnected: authenticated && !!address,
    isReady: ready,
    login,
    logout,
  };
}
