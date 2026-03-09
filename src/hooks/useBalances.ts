"use client";

import { useState, useEffect, useCallback } from "react";
import { formatUnits, type Address } from "viem";
import { publicClient, ADDRESSES, ERC20_ABI } from "@/lib/contracts";

interface Balances {
  usdRaw: bigint;
  /** Native ETH balance */
  ethRaw: bigint;
  /** WETH token balance — used internally for covered call collateral */
  wethRaw: bigint;
  usd: number;
  /** Native ETH as a number */
  eth: number;
  /** WETH token as a number */
  weth: number;
  usdFormatted: string;
  /** Formatted native ETH balance */
  ethFormatted: string;
}

const ZERO: Balances = {
  usdRaw: BigInt(0),
  ethRaw: BigInt(0),
  wethRaw: BigInt(0),
  usd: 0,
  eth: 0,
  weth: 0,
  usdFormatted: "0",
  ethFormatted: "0.00",
};

export function useBalances(address: Address | undefined, pollInterval = 15_000) {
  const [balances, setBalances] = useState<Balances>(ZERO);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!address) {
      setBalances(ZERO);
      setLoading(false);
      return;
    }
    try {
      const [usdRaw, wethRaw, ethRaw] = await Promise.all([
        publicClient.readContract({
          address: ADDRESSES.usdc,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [address],
        }),
        publicClient.readContract({
          address: ADDRESSES.weth,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [address],
        }),
        publicClient.getBalance({ address }),
      ]);

      const usd = Number(formatUnits(usdRaw, 6));
      const eth = Number(formatUnits(ethRaw, 18));
      const weth = Number(formatUnits(wethRaw, 18));

      setBalances({
        usdRaw,
        ethRaw,
        wethRaw,
        usd,
        eth,
        weth,
        usdFormatted: usd.toLocaleString(undefined, { maximumFractionDigits: 0 }),
        ethFormatted: eth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      });
    } catch (err) {
      console.error("[useBalances] Failed to fetch balances:", err);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    refetch();
    if (!address) return;
    const id = setInterval(refetch, pollInterval);
    return () => clearInterval(id);
  }, [refetch, address, pollInterval]);

  // Listen for balance:refetch events from other components
  useEffect(() => {
    const handler = () => refetch();
    window.addEventListener("balance:refetch", handler);
    return () => window.removeEventListener("balance:refetch", handler);
  }, [refetch]);

  return { ...balances, loading, refetch };
}
