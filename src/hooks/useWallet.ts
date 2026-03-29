"use client";

import { usePrivy, useWallets, useConnectWallet } from "@privy-io/react-auth";
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
  const { logout, authenticated, ready } = usePrivy();
  const { connectWallet } = useConnectWallet();
  const { wallets } = useWallets();
  const { client } = useSmartWallets();
  const [chainError, setChainError] = useState<string | null>(null);

  const externalWallet = wallets.find((w) => w.walletClientType !== "privy");
  const embeddedWallet = wallets.find((w) => w.walletClientType === "privy");
  const fundingWallet = externalWallet ?? embeddedWallet;

  // Trading address: always the smart wallet (gas-sponsored, batched)
  const address = client?.account?.address as Address | undefined;

  // Funding address: the connected EOA (for deposits, withdrawals, legacy positions)
  const fundingAddress = fundingWallet?.address as Address | undefined;

  useEffect(() => {
    if (!fundingWallet) return;
    fundingWallet
      .switchChain(CHAIN.id)
      .then(() => setChainError(null))
      .catch((err) => {
        console.error("[useWallet] Failed to switch chain:", err);
        setChainError(
          "Failed to switch to the required chain. Transactions will fail.",
        );
      });
  }, [fundingWallet]);

  // All trades execute through the smart wallet — gas sponsored by Privy paymaster
  const sendBatchTx = useCallback(
    async (calls: BatchCall[]): Promise<unknown> => {
      if (calls.length === 0) {
        throw new Error("sendBatchTx requires at least one call");
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
    [client],
  );

  // Deposit/withdraw only — single tx from the user's EOA
  const sendFundingTx = useCallback(
    async (call: BatchCall): Promise<`0x${string}`> => {
      if (!fundingWallet) {
        throw new Error("No funding wallet connected");
      }
      const provider = await fundingWallet.getEthereumProvider();
      const walletClient = createWalletClient({
        account: fundingWallet.address as Address,
        chain: CHAIN,
        transport: custom(provider),
      });
      console.log("[sendFundingTx] EOA sending tx to", call.to);
      return walletClient.sendTransaction({
        to: call.to,
        data: call.data,
        value: call.value,
      });
    },
    [fundingWallet],
  );

  const disconnect = useCallback(async () => {
    // Disconnect each wallet via its EIP-1193 provider
    for (const w of wallets) {
      try {
        const provider = await w.getEthereumProvider();
        await provider.request({ method: "wallet_revokePermissions", params: [{ eth_accounts: {} }] });
      } catch {
        // Not all providers support revokePermissions; fall through
      }
    }
    // Clear any Privy auth state
    try { await logout(); } catch {}
  }, [wallets, logout]);

  return {
    address,
    fundingAddress,
    sendBatchTx,
    sendFundingTx,
    chainError,
    isConnected: !!fundingAddress,
    isReady: ready,
    connectWallet,
    disconnect,
  };
}
