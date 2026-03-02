"use client";

import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import { createWalletClient, custom, type Address } from "viem";
import { baseSepolia } from "viem/chains";
import { useState, useEffect, useCallback } from "react";
import { Attribution } from "ox/erc8021";

const BUILDER_CODE = process.env.NEXT_PUBLIC_BUILDER_CODE;
const DATA_SUFFIX = BUILDER_CODE
  ? Attribution.toDataSuffix({ codes: [BUILDER_CODE] })
  : null;

export type BatchCall = {
  to: Address;
  data: `0x${string}`;
  value?: bigint;
};

function appendSuffix(call: BatchCall): BatchCall {
  if (!DATA_SUFFIX || !call.data) return call;
  return {
    ...call,
    data: `${call.data}${DATA_SUFFIX.slice(2)}` as `0x${string}`,
  };
}

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
      .switchChain(baseSepolia.id)
      .then(() => setChainError(null))
      .catch((err) => {
        console.error("[useWallet] Failed to switch chain:", err);
        setChainError(
          "Failed to switch to Base Sepolia. Transactions will fail.",
        );
      });
  }, [primaryWallet]);

  const sendBatchTx = useCallback(
    async (calls: BatchCall[]): Promise<unknown> => {
      if (calls.length === 0) {
        throw new Error("sendBatchTx requires at least one call");
      }

      if (externalWallet) {
        const provider = await externalWallet.getEthereumProvider();
        const walletClient = createWalletClient({
          account: externalWallet.address as Address,
          chain: baseSepolia,
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
            calls: calls.map(appendSuffix).map((c) => ({
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
