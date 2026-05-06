"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePrivy, useWallets, type User } from "@privy-io/react-auth";
import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import { useWallets as useSolanaWallets } from "@privy-io/react-auth/solana";
import {
  api,
  type B1naryAccount,
  type B1naryAccountMember,
  type B1naryWallet,
  type B1naryWalletChain,
  type B1naryWalletType,
} from "@/lib/api";

type WalletAccount = User["linkedAccounts"][number] & {
  address?: string;
  chainType?: "ethereum" | "solana";
  walletClientType?: string;
};

export interface TrustedB1naryWalletCandidate {
  chain: B1naryWalletChain;
  address: string;
  walletType: Extract<B1naryWalletType, "smart" | "embedded">;
  walletClientType: string;
}

interface B1naryWalletLookupCandidate {
  chain: B1naryWalletChain;
  address: string;
}

interface UseB1naryAccountOptions {
  autoSyncTrustedWallets?: boolean;
}

function walletAccounts(user: User | null): WalletAccount[] {
  return (user?.linkedAccounts ?? []).filter(
    (account): account is WalletAccount => account.type === "wallet",
  );
}

function isPrivyWalletClient(walletClientType: string | undefined): boolean {
  return walletClientType === "privy" || walletClientType === "privy-v2";
}

function normalizeAddress(chain: B1naryWalletChain, address: string): string {
  return chain === "base" ? address.toLowerCase() : address;
}

function candidateKey(candidate: TrustedB1naryWalletCandidate): string {
  return `${candidate.chain}:${normalizeAddress(candidate.chain, candidate.address)}`;
}

function lookupKey(candidate: B1naryWalletLookupCandidate): string {
  return `${candidate.chain}:${normalizeAddress(candidate.chain, candidate.address)}`;
}

function uniqueCandidates(
  candidates: Array<TrustedB1naryWalletCandidate | undefined>,
): TrustedB1naryWalletCandidate[] {
  const seen = new Set<string>();
  const unique: TrustedB1naryWalletCandidate[] = [];
  for (const candidate of candidates) {
    if (!candidate?.address) continue;
    const key = candidateKey(candidate);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(candidate);
  }
  return unique;
}

function uniqueLookupCandidates(
  candidates: Array<B1naryWalletLookupCandidate | undefined>,
): B1naryWalletLookupCandidate[] {
  const seen = new Set<string>();
  const unique: B1naryWalletLookupCandidate[] = [];
  for (const candidate of candidates) {
    if (!candidate?.address) continue;
    const key = lookupKey(candidate);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(candidate);
  }
  return unique;
}

export function useB1naryAccount(options: UseB1naryAccountOptions = {}) {
  const { autoSyncTrustedWallets = true } = options;
  const { authenticated, ready, user } = usePrivy();
  const { wallets } = useWallets();
  const { client } = useSmartWallets();
  const { wallets: solanaWallets } = useSolanaWallets();
  const [account, setAccount] = useState<B1naryAccount | null>(null);
  const [members, setMembers] = useState<B1naryAccountMember[]>([]);
  const [linkedWallets, setLinkedWallets] = useState<B1naryWallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attemptedLinks = useRef<Set<string>>(new Set());

  const privyUserId = user?.id;
  const linkedAccounts = useMemo(() => walletAccounts(user ?? null), [user]);

  const walletLookupCandidates = useMemo(() => {
    const smartWalletAddress = client?.account?.address ?? user?.smartWallet?.address;
    const evmWalletCandidates = wallets.map((wallet) =>
      wallet.address
        ? {
            chain: "base" as const,
            address: wallet.address,
          }
        : undefined,
    );
    const solanaWalletCandidates = solanaWallets.map((wallet) =>
      wallet.address
        ? {
            chain: "solana" as const,
            address: wallet.address,
          }
        : undefined,
    );
    const linkedWalletCandidates = linkedAccounts.map((wallet) => {
      if (!wallet.address || !wallet.chainType) return undefined;
      return {
        chain: wallet.chainType === "solana" ? "solana" as const : "base" as const,
        address: wallet.address,
      };
    });

    return uniqueLookupCandidates([
      smartWalletAddress
        ? {
            chain: "base",
            address: smartWalletAddress,
          }
        : undefined,
      ...evmWalletCandidates,
      ...solanaWalletCandidates,
      ...linkedWalletCandidates,
    ]);
  }, [
    client?.account?.address,
    linkedAccounts,
    solanaWallets,
    user?.smartWallet?.address,
    wallets,
  ]);

  const trustedWalletCandidates = useMemo(() => {
    const smartWalletAddress = client?.account?.address ?? user?.smartWallet?.address;
    const embeddedEvmWallet = wallets.find((wallet) =>
      isPrivyWalletClient(wallet.walletClientType),
    );
    const linkedEmbeddedEvmWallet = linkedAccounts.find(
      (wallet) =>
        wallet.chainType === "ethereum" &&
        isPrivyWalletClient(wallet.walletClientType),
    );
    const solanaEmbeddedWallet = solanaWallets.find(
      (wallet) => "isPrivyWallet" in wallet.standardWallet,
    );
    const linkedSolanaEmbeddedWallet = linkedAccounts.find(
      (wallet) =>
        wallet.chainType === "solana" &&
        isPrivyWalletClient(wallet.walletClientType),
    );

    return uniqueCandidates([
      smartWalletAddress
        ? {
            chain: "base",
            address: smartWalletAddress,
            walletType: "smart",
            walletClientType: "privy-smart-wallet",
          }
        : undefined,
      embeddedEvmWallet?.address
        ? {
            chain: "base",
            address: embeddedEvmWallet.address,
            walletType: "embedded",
            walletClientType: embeddedEvmWallet.walletClientType,
          }
        : undefined,
      linkedEmbeddedEvmWallet?.address
        ? {
            chain: "base",
            address: linkedEmbeddedEvmWallet.address,
            walletType: "embedded",
            walletClientType: linkedEmbeddedEvmWallet.walletClientType ?? "privy",
          }
        : undefined,
      solanaEmbeddedWallet?.address
        ? {
            chain: "solana",
            address: solanaEmbeddedWallet.address,
            walletType: "embedded",
            walletClientType: "privy",
          }
        : undefined,
      linkedSolanaEmbeddedWallet?.address
        ? {
            chain: "solana",
            address: linkedSolanaEmbeddedWallet.address,
            walletType: "embedded",
            walletClientType: linkedSolanaEmbeddedWallet.walletClientType ?? "privy",
          }
        : undefined,
    ]);
  }, [
    client?.account?.address,
    linkedAccounts,
    solanaWallets,
    user?.smartWallet?.address,
    wallets,
  ]);

  const refresh = useCallback(async () => {
    if (!ready) return;
    if (!authenticated || !privyUserId) {
      setAccount(null);
      setMembers([]);
      setLinkedWallets([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await api.getB1naryAccount(privyUserId);
      if (response.account) {
        setAccount(response.account);
        setMembers(response.members);
        setLinkedWallets(response.wallets);
        setError(null);
        return;
      }

      for (const candidate of walletLookupCandidates) {
        let walletResponse;
        try {
          walletResponse = await api.getB1naryAccountByWallet(
            candidate.chain,
            candidate.address,
          );
        } catch (walletErr) {
          console.warn(
            "[useB1naryAccount] wallet account lookup failed:",
            walletErr,
          );
          continue;
        }
        if (!walletResponse.account) continue;

        try {
          const memberResponse = await api.addTrustedB1naryMember(
            walletResponse.account.id,
            privyUserId,
          );
          setAccount(memberResponse.account);
          setMembers(memberResponse.members);
          setLinkedWallets(memberResponse.wallets);
        } catch (memberErr) {
          console.warn(
            "[useB1naryAccount] trusted member link failed:",
            memberErr,
          );
          setAccount(walletResponse.account);
          setMembers(walletResponse.members);
          setLinkedWallets(walletResponse.wallets);
        }
        setError(null);
        return;
      }

      setAccount(null);
      setMembers([]);
      setLinkedWallets([]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load b1nary account");
    } finally {
      setLoading(false);
    }
  }, [authenticated, privyUserId, ready, walletLookupCandidates]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createAccount = useCallback(async (username: string) => {
    if (!privyUserId) {
      throw new Error("Privy user not ready");
    }
    const response = await api.createB1naryAccount(username, privyUserId);
    setAccount(response.account);
    setMembers(response.members);
    setLinkedWallets(response.wallets);
    setError(null);
    return response.account;
  }, [privyUserId]);

  const syncTrustedWallets = useCallback(async (
    targetAccount = account,
  ): Promise<B1naryWallet[]> => {
    if (!targetAccount || !privyUserId) return [];
    const linked = new Set(
      linkedWallets
        .filter((wallet) => wallet.verified_at)
        .map((wallet) =>
          `${wallet.chain}:${normalizeAddress(wallet.chain, wallet.address)}`,
        ),
    );
    const missing = trustedWalletCandidates.filter((candidate) => {
      const key = candidateKey(candidate);
      return !linked.has(key) && !attemptedLinks.current.has(key);
    });
    if (missing.length === 0) return [];

    setSyncing(true);
    try {
      const linkedNow: B1naryWallet[] = [];
      for (const candidate of missing) {
        const key = candidateKey(candidate);
        attemptedLinks.current.add(key);
        const response = await api.linkTrustedB1naryWallet(targetAccount.id, {
          privyUserId,
          chain: candidate.chain,
          address: candidate.address,
          walletType: candidate.walletType,
          role: "trading",
          walletClientType: candidate.walletClientType,
        });
        linkedNow.push(response.wallet);
      }
      if (linkedNow.length > 0) {
        setLinkedWallets((current) => {
          const byKey = new Map(
            current.map((wallet) => [
              `${wallet.chain}:${normalizeAddress(wallet.chain, wallet.address)}`,
              wallet,
            ]),
          );
          for (const wallet of linkedNow) {
            byKey.set(
              `${wallet.chain}:${normalizeAddress(wallet.chain, wallet.address)}`,
              wallet,
            );
          }
          return Array.from(byKey.values());
        });
      }
      setError(null);
      return linkedNow;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not link trading wallets");
      throw err;
    } finally {
      setSyncing(false);
    }
  }, [account, linkedWallets, privyUserId, trustedWalletCandidates]);

  useEffect(() => {
    if (!autoSyncTrustedWallets || !account || loading || syncing) return;
    void syncTrustedWallets().catch((err) => {
      console.warn("[useB1naryAccount] trusted wallet sync failed:", err);
    });
  }, [account, autoSyncTrustedWallets, loading, syncing, syncTrustedWallets]);

  return {
    account,
    members,
    wallets: linkedWallets,
    trustedWalletCandidates,
    loading,
    syncing,
    error,
    needsOnboarding:
      ready &&
      authenticated &&
      !loading &&
      !account &&
      trustedWalletCandidates.length > 0,
    createAccount,
    refresh,
    syncTrustedWallets,
  };
}
