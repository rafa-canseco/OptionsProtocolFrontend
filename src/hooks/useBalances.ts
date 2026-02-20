"use client";

import { useState, useEffect, useCallback } from "react";
import { formatUnits, type Address } from "viem";
import { publicClient, ADDRESSES, ERC20_ABI } from "@/lib/contracts";

interface Balances {
  usdRaw: bigint;
  ethRaw: bigint;
  usd: number;
  eth: number;
  usdFormatted: string;
  ethFormatted: string;
}

const ZERO: Balances = {
  usdRaw: 0n,
  ethRaw: 0n,
  usd: 0,
  eth: 0,
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
      const [usdRaw, ethRaw] = await Promise.all([
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
      ]);

      const usd = Number(formatUnits(usdRaw, 6));
      const eth = Number(formatUnits(ethRaw, 18));

      setBalances({
        usdRaw,
        ethRaw,
        usd,
        eth,
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

  return { ...balances, loading, refetch };
}
