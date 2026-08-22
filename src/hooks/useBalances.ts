"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { formatUnits, type Address } from "viem";
import { publicClient, ADDRESSES, CHAIN, ERC20_ABI } from "@/lib/contracts";

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

type BalanceCacheEntry = {
  value: Balances;
  updatedAt: number;
};

const balanceCache = new Map<string, BalanceCacheEntry>();
const balanceRequests = new Map<string, Promise<Balances>>();
const balanceAttemptedAt = new Map<string, number>();

const MULTICALL3_ABI = [{
  type: "function",
  name: "getEthBalance",
  inputs: [{ name: "addr", type: "address" }],
  outputs: [{ name: "balance", type: "uint256" }],
  stateMutability: "view",
}] as const;

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
  const multicall3 = CHAIN.contracts?.multicall3?.address;
  if (!multicall3) throw new Error("Base multicall3 address is unavailable");

  const balancesByAddress = await Promise.all(addresses.map(async (addr) => {
    const [usdRaw, wethRaw, wbtcRaw, ethRaw] = await publicClient.multicall({
      contracts: [
        { address: ADDRESSES.usdc, abi: ERC20_ABI, functionName: "balanceOf", args: [addr] },
        { address: ADDRESSES.weth, abi: ERC20_ABI, functionName: "balanceOf", args: [addr] },
        { address: ADDRESSES.wbtc, abi: ERC20_ABI, functionName: "balanceOf", args: [addr] },
        { address: multicall3, abi: MULTICALL3_ABI, functionName: "getEthBalance", args: [addr] },
      ],
      allowFailure: false,
    });
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
): Promise<Balances> {
  const cached = balanceCache.get(key);
  const existing = balanceRequests.get(key);
  if (existing) return existing;
  const lastAttempt = balanceAttemptedAt.get(key) ?? 0;
  if (Date.now() - lastAttempt < BALANCE_CACHE_TTL_MS) {
    if (cached) return cached.value;
    throw new Error("Balance refresh is cooling down.");
  }

  balanceAttemptedAt.set(key, Date.now());
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
  const pendingRefreshRef = useRef(false);

  const refetch = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (addresses.length === 0) {
      setBalances(ZERO);
      setLoading(false);
      return;
    }
    try {
      const nextBalances = await getCachedBalances(key, addresses);
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
    void refetch();
  }, [refetch]);

  useEffect(() => {
    const refreshWhenAllowed = () => {
      pendingRefreshRef.current = true;
      if (document.hidden || !key) return;
      const remaining = BALANCE_CACHE_TTL_MS -
        (Date.now() - (balanceAttemptedAt.get(key) ?? 0));
      if (remaining <= 0) {
        pendingRefreshRef.current = false;
        void refetch();
        return;
      }
      if (refetchTimerRef.current) window.clearTimeout(refetchTimerRef.current);
      refetchTimerRef.current = window.setTimeout(() => {
        if (document.hidden) return;
        pendingRefreshRef.current = false;
        void refetch();
      }, remaining);
    };
    const focusHandler = () => {
      if (!document.hidden) void refetch();
    };
    const visibilityHandler = () => {
      if (document.hidden) return;
      if (pendingRefreshRef.current) refreshWhenAllowed();
      else void refetch();
    };
    window.addEventListener("balance:refetch", refreshWhenAllowed);
    window.addEventListener("focus", focusHandler);
    document.addEventListener("visibilitychange", visibilityHandler);
    return () => {
      window.removeEventListener("balance:refetch", refreshWhenAllowed);
      window.removeEventListener("focus", focusHandler);
      document.removeEventListener("visibilitychange", visibilityHandler);
      if (refetchTimerRef.current) window.clearTimeout(refetchTimerRef.current);
    };
  }, [key, refetch]);

  return { ...balances, loading, refetch };
}
