"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { formatUnits, type Address } from "viem";
import { publicClient, ADDRESSES, ERC20_ABI } from "@/lib/contracts";

interface Balances {
  usdRaw: bigint;
  /** Native ETH balance */
  ethRaw: bigint;
  /** WETH token balance */
  wethRaw: bigint;
  /** WBTC/LBTC token balance */
  wbtcRaw: bigint;
  usd: number;
  /** Native ETH as a number */
  eth: number;
  /** WETH token as a number */
  weth: number;
  /** WBTC/LBTC token as a number (8 decimals) */
  wbtc: number;
  usdFormatted: string;
  /** Formatted native ETH balance */
  ethFormatted: string;
}

const ZERO: Balances = {
  usdRaw: BigInt(0),
  ethRaw: BigInt(0),
  wethRaw: BigInt(0),
  wbtcRaw: BigInt(0),
  usd: 0,
  eth: 0,
  weth: 0,
  wbtc: 0,
  usdFormatted: "0",
  ethFormatted: "0.00",
};

const BALANCE_CACHE_TTL_MS = 10_000;
const BALANCE_REFETCH_DELAY_MS = 4_000;

type BalanceCacheEntry = {
  value: Balances;
  updatedAt: number;
};

const balanceCache = new Map<string, BalanceCacheEntry>();
const balanceRequests = new Map<string, Promise<Balances>>();

function normalizeAddresses(
  address: Address | Address[] | undefined,
): Address[] {
  return (Array.isArray(address) ? address : [address])
    .filter((value): value is Address => Boolean(value))
    .map((value) => value.toLowerCase() as Address)
    .filter((value, index, arr) => arr.indexOf(value) === index)
    .sort();
}

function balanceKey(addresses: Address[]): string {
  return addresses.join(",");
}

async function fetchBalancesForAddresses(addresses: Address[]): Promise<Balances> {
  const balancesByAddress = await Promise.all(addresses.map(async (addr) => {
    const [usdRaw, wethRaw, wbtcRaw, ethRaw] = await Promise.all([
      publicClient.readContract({
        address: ADDRESSES.usdc,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [addr],
      }),
      publicClient.readContract({
        address: ADDRESSES.weth,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [addr],
      }),
      publicClient.readContract({
        address: ADDRESSES.wbtc,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [addr],
      }),
      publicClient.getBalance({ address: addr }),
    ]);
    return { usdRaw, wethRaw, wbtcRaw, ethRaw };
  }));

  const usdRaw = balancesByAddress.reduce(
    (sum, item) => sum + item.usdRaw,
    BigInt(0),
  );
  const wethRaw = balancesByAddress.reduce(
    (sum, item) => sum + item.wethRaw,
    BigInt(0),
  );
  const wbtcRaw = balancesByAddress.reduce(
    (sum, item) => sum + item.wbtcRaw,
    BigInt(0),
  );
  const ethRaw = balancesByAddress.reduce(
    (sum, item) => sum + item.ethRaw,
    BigInt(0),
  );

  const usd = Number(formatUnits(usdRaw, 6));
  const eth = Number(formatUnits(ethRaw, 18));
  const weth = Number(formatUnits(wethRaw, 18));
  const wbtc = Number(formatUnits(wbtcRaw, 8));

  return {
    usdRaw,
    ethRaw,
    wethRaw,
    wbtcRaw,
    usd,
    eth,
    weth,
    wbtc,
    usdFormatted: usd.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
    ethFormatted: eth.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }),
  };
}

async function getCachedBalances(
  key: string,
  addresses: Address[],
  force = false,
): Promise<Balances> {
  const cached = balanceCache.get(key);
  if (
    !force &&
    cached &&
    Date.now() - cached.updatedAt < BALANCE_CACHE_TTL_MS
  ) {
    return cached.value;
  }

  const existing = balanceRequests.get(key);
  if (existing) return existing;

  const request = fetchBalancesForAddresses(addresses)
    .then((value) => {
      balanceCache.set(key, { value, updatedAt: Date.now() });
      return value;
    })
    .finally(() => {
      balanceRequests.delete(key);
    });
  balanceRequests.set(key, request);
  return request;
}

export function useBalances(
  address: Address | Address[] | undefined,
  pollInterval = 60_000,
) {
  const key = useMemo(() => balanceKey(normalizeAddresses(address)), [address]);
  const addresses = useMemo(
    () => (key ? key.split(",") as Address[] : []),
    [key],
  );
  const [balances, setBalances] = useState<Balances>(ZERO);
  const [loading, setLoading] = useState(true);
  const requestIdRef = useRef(0);
  const refetchTimerRef = useRef<number | null>(null);

  const refetch = useCallback(async (force = false) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (addresses.length === 0) {
      setBalances(ZERO);
      setLoading(false);
      return;
    }
    try {
      const nextBalances = await getCachedBalances(key, addresses, force);
      if (requestId !== requestIdRef.current) return;
      setBalances(nextBalances);
    } catch (err) {
      console.error("[useBalances] Failed to fetch balances:", err);
    } finally {
      if (requestId !== requestIdRef.current) return;
      setLoading(false);
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

  // Listen for balance:refetch events from other components
  useEffect(() => {
    const handler = () => {
      if (document.hidden) return;
      void refetch(true);
      if (refetchTimerRef.current) {
        window.clearTimeout(refetchTimerRef.current);
      }
      refetchTimerRef.current = window.setTimeout(() => {
        void refetch(true);
      }, BALANCE_REFETCH_DELAY_MS);
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

  return { ...balances, loading, refetch };
}
