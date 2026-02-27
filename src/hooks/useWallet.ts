"use client";

import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import { type Address } from "viem";
import { baseSepolia } from "viem/chains";
import { useState, useEffect, useCallback } from "react";

export type BatchCall = {
  to: Address;
  data: `0x${string}`;
  value?: bigint;
};

export function useWallet() {
  const { login, logout, authenticated, ready } = usePrivy();
  const { wallets } = useWallets();
  const { client } = useSmartWallets();
  const [chainError, setChainError] = useState<string | null>(null);

  const embeddedWallet = wallets[0];
  const address = (client?.account?.address ??
    embeddedWallet?.address) as Address | undefined;

  useEffect(() => {
    if (!embeddedWallet) return;
    embeddedWallet.switchChain(baseSepolia.id)
      .then(() => setChainError(null))
      .catch((err) => {
        console.error("[useWallet] Failed to switch chain:", err);
        setChainError("Failed to switch to Base Sepolia. Transactions will fail.");
      });
  }, [embeddedWallet]);

  const sendBatchTx = useCallback(
    (calls: BatchCall[]): Promise<unknown> => {
      if (!client) {
        throw new Error("Smart wallet not ready");
      }
      if (calls.length === 0) {
        throw new Error("sendBatchTx requires at least one call");
      }
      console.log(
        "[sendBatchTx] Firing batch with",
        calls.length,
        "calls:",
        calls.map((c) => ({ to: c.to, data: c.data.slice(0, 10) })),
      );
      return client
        .sendTransaction(
          {
            calls: calls.map((c) => ({
              to: c.to,
              data: c.data,
              value: c.value,
            })),
          },
          { uiOptions: { showWalletUIs: false } },
        )
        .catch((err) => {
          console.error("[sendBatchTx] Error:", err);
          throw err;
        });
    },
    [client],
  );

  return {
    address,
    sendBatchTx,
    chainError,
    isConnected: authenticated && !!address,
    isReady: ready,
    login,
    logout,
  };
}
