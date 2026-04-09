"use client";

import { useState, useEffect, useCallback } from "react";
import {
  solanaConnection,
  SOLANA_USDC_MINT,
  SOLANA_WSOL_MINT,
  toPublicKey,
} from "@/lib/solana";

interface SolanaBalance {
  solanaUsdcRaw: bigint;
  solanaUsdc: number;
  solanaWsolRaw: bigint;
  solanaWsol: number;
  solanaSolRaw: bigint;
  solanaSol: number;
  loading: boolean;
  error: string | null;
}

const ZERO: SolanaBalance = {
  solanaUsdcRaw: BigInt(0),
  solanaUsdc: 0,
  solanaWsolRaw: BigInt(0),
  solanaWsol: 0,
  solanaSolRaw: BigInt(0),
  solanaSol: 0,
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
      const usdcMint = toPublicKey(SOLANA_USDC_MINT, "USDC mint");
      const wsolMint = toPublicKey(SOLANA_WSOL_MINT, "wSOL mint");

      const [usdcResp, wsolResp, solLamports] = await Promise.all([
        solanaConnection.getParsedTokenAccountsByOwner(owner, {
          mint: usdcMint,
        }),
        solanaConnection.getParsedTokenAccountsByOwner(owner, {
          mint: wsolMint,
        }),
        solanaConnection.getBalance(owner),
      ]);

      let usdcRaw = BigInt(0);
      for (const { account } of usdcResp.value) {
        const info = account.data.parsed?.info;
        if (info?.tokenAmount?.amount) {
          usdcRaw += BigInt(info.tokenAmount.amount);
        }
      }

      let wsolRaw = BigInt(0);
      for (const { account } of wsolResp.value) {
        const info = account.data.parsed?.info;
        if (info?.tokenAmount?.amount) {
          wsolRaw += BigInt(info.tokenAmount.amount);
        }
      }

      const solRaw = BigInt(solLamports);

      setBalance({
        solanaUsdcRaw: usdcRaw,
        solanaUsdc: Number(usdcRaw) / 1e6,
        solanaWsolRaw: wsolRaw,
        solanaWsol: Number(wsolRaw) / 1e9,
        solanaSolRaw: solRaw,
        solanaSol: Number(solRaw) / 1e9,
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
