"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  solanaConnection,
  SOLANA_USDC_MINT,
  SOLANA_TSLAX_MINT,
  SOLANA_WSOL_MINT,
  toPublicKey,
} from "@/lib/solana";

interface SolanaBalance {
  solanaUsdcRaw: bigint;
  solanaUsdc: number;
  solanaWsolRaw: bigint;
  solanaWsol: number;
  solanaTslaxRaw: bigint;
  solanaTslax: number;
  solanaSolRaw: bigint;
  solanaSol: number;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const ZERO: SolanaBalance = {
  solanaUsdcRaw: BigInt(0),
  solanaUsdc: 0,
  solanaWsolRaw: BigInt(0),
  solanaWsol: 0,
  solanaTslaxRaw: BigInt(0),
  solanaTslax: 0,
  solanaSolRaw: BigInt(0),
  solanaSol: 0,
  loading: true,
  error: null,
  refetch: async () => {},
};

export function useSolanaBalance(
  address: string | undefined,
  pollInterval = 15_000,
): SolanaBalance {
  const [balance, setBalance] = useState<SolanaBalance>(ZERO);
  const requestIdRef = useRef(0);

  const refetch = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (!address || !SOLANA_USDC_MINT || !solanaConnection) {
      setBalance({ ...ZERO, loading: false, refetch });
      return;
    }
    try {
      const owner = toPublicKey(address, "wallet address");
      const usdcMint = toPublicKey(SOLANA_USDC_MINT, "USDC mint");
      const wsolMint = toPublicKey(SOLANA_WSOL_MINT, "wSOL mint");
      const tslaxMint = SOLANA_TSLAX_MINT
        ? toPublicKey(SOLANA_TSLAX_MINT, "TSLAx mint")
        : null;

      const [usdcResp, wsolResp, tslaxResp, solLamports] = await Promise.all([
        solanaConnection.getParsedTokenAccountsByOwner(owner, {
          mint: usdcMint,
        }, "confirmed"),
        solanaConnection.getParsedTokenAccountsByOwner(owner, {
          mint: wsolMint,
        }, "confirmed"),
        tslaxMint
          ? solanaConnection.getParsedTokenAccountsByOwner(owner, {
              mint: tslaxMint,
            }, "confirmed")
          : Promise.resolve({ value: [] }),
        solanaConnection.getBalance(owner, "confirmed"),
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

      let tslaxRaw = BigInt(0);
      for (const { account } of tslaxResp.value) {
        const info = account.data.parsed?.info;
        if (info?.tokenAmount?.amount) {
          tslaxRaw += BigInt(info.tokenAmount.amount);
        }
      }

      const solRaw = BigInt(solLamports);

      if (requestId !== requestIdRef.current) return;

      setBalance({
        solanaUsdcRaw: usdcRaw,
        solanaUsdc: Number(usdcRaw) / 1e6,
        solanaWsolRaw: wsolRaw,
        solanaWsol: Number(wsolRaw) / 1e9,
        solanaTslaxRaw: tslaxRaw,
        solanaTslax: Number(tslaxRaw) / 1e8,
        solanaSolRaw: solRaw,
        solanaSol: Number(solRaw) / 1e9,
        loading: false,
        error: null,
        refetch,
      });
    } catch (err) {
      console.error("[useSolanaBalance] Failed to fetch:", err);
      if (requestId !== requestIdRef.current) return;
      setBalance((prev) => ({
        ...prev,
        loading: false,
        error: "Failed to fetch Solana balance",
        refetch,
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
    const handler = () => {
      refetch();
      for (const delay of [500, 1500, 3000, 6000]) {
        window.setTimeout(() => refetch(), delay);
      }
    };
    window.addEventListener("balance:refetch", handler);
    return () => window.removeEventListener("balance:refetch", handler);
  }, [refetch]);

  return { ...balance, refetch };
}
