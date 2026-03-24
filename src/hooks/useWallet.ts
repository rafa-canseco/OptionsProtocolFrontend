"use client";

import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import { createWalletClient, custom, type Address } from "viem";
import { useState, useEffect, useCallback } from "react";
import { CHAIN } from "@/lib/contracts";

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

  const externalWallet = wallets.find((w) => w.walletClientType !== "privy");
  const embeddedWallet = wallets.find((w) => w.walletClientType === "privy");
  const primaryWallet = externalWallet ?? embeddedWallet;

  const address = (externalWallet?.address ??
    client?.account?.address ??
    embeddedWallet?.address) as Address | undefined;

  useEffect(() => {
    if (!primaryWallet) return;
    primaryWallet
      .switchChain(CHAIN.id)
      .then(() => setChainError(null))
      .catch((err) => {
        console.error("[useWallet] Failed to switch chain:", err);
        setChainError(
          "Failed to switch to the required chain. Transactions will fail.",
        );
      });
  }, [primaryWallet]);

  // Builder attribution (ERC-8021 dataSuffix) is handled by the Privy
  // dataSuffix plugin in providers.tsx — no manual append needed here.
  // The plugin automatically appends the suffix to EOA tx.data and
  // ERC-4337 userOp.callData.

  const sendBatchTx = useCallback(
    async (calls: BatchCall[]): Promise<unknown> => {
      if (calls.length === 0) {
        throw new Error("sendBatchTx requires at least one call");
      }

      if (externalWallet) {
        const provider = await externalWallet.getEthereumProvider();
        const walletClient = createWalletClient({
          account: externalWallet.address as Address,
          chain: CHAIN,
          transport: custom(provider),
        });
        console.log(
          "[sendBatchTx] External wallet: sending",
          calls.length,
          "call(s) sequentially",
        );
        let lastResult: unknown;
        for (const call of calls) {
          lastResult = await walletClient.sendTransaction({
            to: call.to,
            data: call.data,
            value: call.value,
          });
        }
        return lastResult;
      }

      if (!client) {
        throw new Error("Smart wallet not ready");
      }
      console.log(
        "[sendBatchTx] Smart wallet: firing batch with",
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
    [externalWallet, client],
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
