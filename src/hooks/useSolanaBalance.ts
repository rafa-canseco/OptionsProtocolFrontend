"use client";

import { useState, useEffect, useCallback } from "react";
import { Connection, PublicKey } from "@solana/web3.js";

const SOLANA_RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const USDC_MINT = process.env.NEXT_PUBLIC_SOLANA_USDC_MINT ?? "";

const connection = new Connection(SOLANA_RPC_URL);

interface SolanaBalance {
  solanaUsdcRaw: bigint;
  solanaUsdc: number;
  loading: boolean;
}

const ZERO: SolanaBalance = {
  solanaUsdcRaw: BigInt(0),
  solanaUsdc: 0,
  loading: true,
};

export function useSolanaBalance(
  address: string | undefined,
  pollInterval = 15_000,
): SolanaBalance {
  const [balance, setBalance] = useState<SolanaBalance>(ZERO);

  const refetch = useCallback(async () => {
    if (!address || !USDC_MINT) {
      setBalance({ ...ZERO, loading: false });
      return;
    }
    try {
      const owner = new PublicKey(address);
      const mint = new PublicKey(USDC_MINT);
      const resp = await connection.getParsedTokenAccountsByOwner(owner, {
        mint,
      });
      let raw = BigInt(0);
      for (const { account } of resp.value) {
        const info = account.data.parsed?.info;
        if (info?.tokenAmount?.amount) {
          raw += BigInt(info.tokenAmount.amount);
        }
      }
      // USDC is 6 decimals
      const usdc = Number(raw) / 1e6;
      setBalance({ solanaUsdcRaw: raw, solanaUsdc: usdc, loading: false });
    } catch (err) {
      console.error("[useSolanaBalance] Failed to fetch:", err);
      setBalance((prev) => ({ ...prev, loading: false }));
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
