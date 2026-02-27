"use client";

import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import { type Address } from "viem";
import { baseSepolia } from "viem/chains";
import { useEffect, useCallback } from "react";

export type BatchCall = {
  to: Address;
  data: `0x${string}`;
  value?: bigint;
};

export function useWallet() {
  const { login, logout, authenticated, ready } = usePrivy();
  const { wallets } = useWallets();
  const { client } = useSmartWallets();

  const embeddedWallet = wallets[0];
  const address = (client?.account?.address ??
    embeddedWallet?.address) as Address | undefined;

  // Ensure embedded wallet is on Base Sepolia
  useEffect(() => {
    if (!embeddedWallet) return;
    embeddedWallet.switchChain(baseSepolia.id).catch((err) => {
      console.error("[useWallet] Failed to switch chain:", err);
    });
  }, [embeddedWallet]);

  // Single sponsored tx — routes through smart wallet client when
  // available so the sender address is consistent with batch calls.
  const sendSponsoredTx = useCallback(
    (tx: {
      to: Address;
      data: `0x${string}`;
      value?: bigint;
    }): Promise<unknown> => {
      if (!client) {
        throw new Error("Smart wallet not ready");
      }
      console.log("[sendSponsoredTx] Firing tx via smart wallet:", {
        to: tx.to,
        data: tx.data.slice(0, 10),
      });
      return client
        .sendTransaction({
          calls: [
            {
              to: tx.to,
              data: tx.data,
              value: tx.value,
            },
          ],
        })
        .catch((err) => {
          console.error("[sendSponsoredTx] Error:", err);
          throw err;
        });
    },
    [client],
  );

  // Batch multiple calls into a single UserOperation
  const sendBatchTx = useCallback(
    (calls: BatchCall[]): Promise<unknown> => {
      if (!client) {
        throw new Error("Smart wallet not ready");
      }
      console.log(
        "[sendBatchTx] Firing batch with",
        calls.length,
        "calls:",
        calls.map((c) => ({ to: c.to, data: c.data.slice(0, 10) })),
      );
      return client
        .sendTransaction({
          calls: calls.map((c) => ({
            to: c.to,
            data: c.data,
            value: c.value,
          })),
        })
        .catch((err) => {
          console.error("[sendBatchTx] Error:", err);
          throw err;
        });
    },
    [client],
  );

  return {
    address,
    sendSponsoredTx,
    sendBatchTx,
    isConnected: authenticated && !!address,
    isReady: ready,
    login,
    logout,
  };
}
