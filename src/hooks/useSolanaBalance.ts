"use client";

import { useState, useEffect, useCallback } from "react";
import {
  solanaConnection,
  SOLANA_USDC_MINT,
  toPublicKey,
} from "@/lib/solana";

interface SolanaBalance {
  solanaUsdcRaw: bigint;
  solanaUsdc: number;
  loading: boolean;
  error: string | null;
}

const ZERO: SolanaBalance = {
  solanaUsdcRaw: BigInt(0),
  solanaUsdc: 0,
  loading: true,
  error: null,
};

export function useSolanaBalance(
  address: string | undefined,
  pollInterval = 15_000,
): SolanaBalance {
  const [balance, setBalance] = useState<SolanaBalance>(ZERO);

  const refetch = useCallback(async () => {
    if (!address || !SOLANA_USDC_MINT || !solanaConnection) {
      setBalance({ ...ZERO, loading: false });
      return;
    }
    try {
      const owner = toPublicKey(address, "wallet address");
      const mint = toPublicKey(SOLANA_USDC_MINT, "USDC mint");
      const resp =
        await solanaConnection.getParsedTokenAccountsByOwner(owner, {
          mint,
        });
      let raw = BigInt(0);
      for (const { account } of resp.value) {
        const info = account.data.parsed?.info;
        if (info?.tokenAmount?.amount) {
          raw += BigInt(info.tokenAmount.amount);
        }
      }
      const usdc = Number(raw) / 1e6;
      setBalance({
        solanaUsdcRaw: raw,
        solanaUsdc: usdc,
        loading: false,
        error: null,
      });
    } catch (err) {
      console.error("[useSolanaBalance] Failed to fetch:", err);
      setBalance((prev) => ({
        ...prev,
        loading: false,
        error: "Failed to fetch Solana balance",
      }));
    }
  }, [address]);

  useEffect(() => {
    refetch();
    if (!address) return;
    const id = setInterval(refetch, pollInterval);
    return () => clearInterval(id);
  }, [refetch, address, pollInterval]);

  useEffect(() => {
    const handler = () => refetch();
    window.addEventListener("balance:refetch", handler);
    return () => window.removeEventListener("balance:refetch", handler);
  }, [refetch]);

  return balance;
}
