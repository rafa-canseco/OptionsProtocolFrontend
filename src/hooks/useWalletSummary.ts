"use client";

import { useMemo } from "react";
import { usePrivy, type User } from "@privy-io/react-auth";
import type { Address } from "viem";

type WalletAccount = User["linkedAccounts"][number] & {
  address?: string;
  chainType?: "ethereum" | "solana";
  walletClientType?: string;
};

function walletAccounts(user: User | null): WalletAccount[] {
  return (user?.linkedAccounts ?? []).filter(
    (account): account is WalletAccount => account.type === "wallet",
  );
}

function isEmbeddedWallet(account: WalletAccount): boolean {
  return account.walletClientType === "privy" || account.walletClientType === "privy-v2";
}

export function useWalletSummary() {
  const { authenticated, ready, user } = usePrivy();

  return useMemo(() => {
    const wallets = walletAccounts(user);
    const externalEvmWallet = wallets.find(
      (wallet) => wallet.chainType === "ethereum" && !isEmbeddedWallet(wallet),
    );
    const embeddedEvmWallet = wallets.find(
      (wallet) => wallet.chainType === "ethereum" && isEmbeddedWallet(wallet),
    );
    const solanaEmbeddedWallet = wallets.find(
      (wallet) => wallet.chainType === "solana" && isEmbeddedWallet(wallet),
    );

    const smartWalletAddress = user?.smartWallet?.address as Address | undefined;
    const fundingAddress = (externalEvmWallet?.address ?? embeddedEvmWallet?.address) as
      | Address
      | undefined;
    const solanaAddress = solanaEmbeddedWallet?.address;

    return {
      address: smartWalletAddress,
      fundingAddress,
      solanaAddress,
      isConnected: authenticated && !!(fundingAddress || solanaAddress || smartWalletAddress),
      isReady: ready,
    };
  }, [authenticated, ready, user]);
}
