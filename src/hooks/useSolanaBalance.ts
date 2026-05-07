"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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

const SOLANA_BALANCE_CACHE_TTL_MS = 10_000;
const SOLANA_BALANCE_REFETCH_DELAY_MS = 4_000;

type SolanaBalanceSnapshot = Omit<SolanaBalance, "loading" | "error" | "refetch">;

type SolanaBalanceCacheEntry = {
  value: SolanaBalanceSnapshot;
  updatedAt: number;
};

const solanaBalanceCache = new Map<string, SolanaBalanceCacheEntry>();
const solanaBalanceRequests = new Map<string, Promise<SolanaBalanceSnapshot>>();

function normalizeAddresses(address: string | string[] | undefined): string[] {
  return (Array.isArray(address) ? address : [address])
    .filter((value): value is string => Boolean(value))
    .filter((value, index, arr) => arr.indexOf(value) === index)
    .sort();
}

function solanaBalanceKey(addresses: string[]): string {
  return addresses.join(",");
}

async function fetchSolanaBalances(addresses: string[]): Promise<SolanaBalanceSnapshot> {
  if (!SOLANA_USDC_MINT || !solanaConnection) {
    return {
      solanaUsdcRaw: BigInt(0),
      solanaUsdc: 0,
      solanaWsolRaw: BigInt(0),
      solanaWsol: 0,
      solanaTslaxRaw: BigInt(0),
      solanaTslax: 0,
      solanaSolRaw: BigInt(0),
      solanaSol: 0,
    };
  }

  const conn = solanaConnection;
  const usdcMint = toPublicKey(SOLANA_USDC_MINT, "USDC mint");
  const wsolMint = toPublicKey(SOLANA_WSOL_MINT, "wSOL mint");
  const tslaxMint = SOLANA_TSLAX_MINT
    ? toPublicKey(SOLANA_TSLAX_MINT, "TSLAx mint")
    : null;

  let usdcRaw = BigInt(0);
  let wsolRaw = BigInt(0);
  let tslaxRaw = BigInt(0);
  let solRaw = BigInt(0);

  await Promise.all(addresses.map(async (addr) => {
    const owner = toPublicKey(addr, "wallet address");
    const [usdcResp, wsolResp, tslaxResp, solLamports] = await Promise.all([
      conn.getParsedTokenAccountsByOwner(owner, {
        mint: usdcMint,
      }, "confirmed"),
      conn.getParsedTokenAccountsByOwner(owner, {
        mint: wsolMint,
      }, "confirmed"),
      tslaxMint
        ? conn.getParsedTokenAccountsByOwner(owner, {
            mint: tslaxMint,
          }, "confirmed")
        : Promise.resolve({ value: [] }),
      conn.getBalance(owner, "confirmed"),
    ]);

    for (const { account } of usdcResp.value) {
      const info = account.data.parsed?.info;
      if (info?.tokenAmount?.amount) {
        usdcRaw += BigInt(info.tokenAmount.amount);
      }
    }

    for (const { account } of wsolResp.value) {
      const info = account.data.parsed?.info;
      if (info?.tokenAmount?.amount) {
        wsolRaw += BigInt(info.tokenAmount.amount);
      }
    }

    for (const { account } of tslaxResp.value) {
      const info = account.data.parsed?.info;
      if (info?.tokenAmount?.amount) {
        tslaxRaw += BigInt(info.tokenAmount.amount);
      }
    }

    solRaw += BigInt(solLamports);
  }));

  return {
    solanaUsdcRaw: usdcRaw,
    solanaUsdc: Number(usdcRaw) / 1e6,
    solanaWsolRaw: wsolRaw,
    solanaWsol: Number(wsolRaw) / 1e9,
    solanaTslaxRaw: tslaxRaw,
    solanaTslax: Number(tslaxRaw) / 1e8,
    solanaSolRaw: solRaw,
    solanaSol: Number(solRaw) / 1e9,
  };
}

async function getCachedSolanaBalances(
  key: string,
  addresses: string[],
  force = false,
): Promise<SolanaBalanceSnapshot> {
  const cached = solanaBalanceCache.get(key);
  if (
    !force &&
    cached &&
    Date.now() - cached.updatedAt < SOLANA_BALANCE_CACHE_TTL_MS
  ) {
    return cached.value;
  }

  const existing = solanaBalanceRequests.get(key);
  if (existing) return existing;

  const request = fetchSolanaBalances(addresses)
    .then((value) => {
      solanaBalanceCache.set(key, { value, updatedAt: Date.now() });
      return value;
    })
    .finally(() => {
      solanaBalanceRequests.delete(key);
    });
  solanaBalanceRequests.set(key, request);
  return request;
}

export function useSolanaBalance(
  address: string | string[] | undefined,
  pollInterval = 60_000,
): SolanaBalance {
  const key = useMemo(() => solanaBalanceKey(normalizeAddresses(address)), [address]);
  const addresses = useMemo(() => (key ? key.split(",") : []), [key]);
  const [balance, setBalance] = useState<SolanaBalance>(ZERO);
  const requestIdRef = useRef(0);
  const refetchTimerRef = useRef<number | null>(null);

  const refetch = useCallback(async (force = false) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (addresses.length === 0 || !SOLANA_USDC_MINT || !solanaConnection) {
      setBalance({ ...ZERO, loading: false, refetch });
      return;
    }
    try {
      const nextBalance = await getCachedSolanaBalances(key, addresses, force);

      if (requestId !== requestIdRef.current) return;

      setBalance({
        ...nextBalance,
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
  }, [addresses, key]);

  useEffect(() => {
    refetch();
    if (addresses.length === 0) return;
    const id = setInterval(() => {
      if (document.hidden) return;
      void refetch();
    }, pollInterval);
    return () => clearInterval(id);
  }, [addresses.length, refetch, pollInterval]);

  useEffect(() => {
    const handler = () => {
      if (document.hidden) return;
      void refetch(true);
      if (refetchTimerRef.current) {
        window.clearTimeout(refetchTimerRef.current);
      }
      refetchTimerRef.current = window.setTimeout(() => {
        void refetch(true);
      }, SOLANA_BALANCE_REFETCH_DELAY_MS);
    };
    window.addEventListener("balance:refetch", handler);
    const visibilityHandler = () => {
      if (!document.hidden) void refetch();
    };
    document.addEventListener("visibilitychange", visibilityHandler);
    return () => {
      window.removeEventListener("balance:refetch", handler);
      document.removeEventListener("visibilitychange", visibilityHandler);
      if (refetchTimerRef.current) {
        window.clearTimeout(refetchTimerRef.current);
      }
    };
  }, [refetch]);

  return { ...balance, refetch };
}
