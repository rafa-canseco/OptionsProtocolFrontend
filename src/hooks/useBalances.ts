"use client";

import { useState, useEffect, useCallback } from "react";
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

export function useBalances(
  address: Address | Address[] | undefined,
  pollInterval = 60_000,
) {
  const [balances, setBalances] = useState<Balances>(ZERO);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    const addresses = (Array.isArray(address) ? address : [address]).filter(
      (value, index, arr): value is Address =>
        Boolean(value) && arr.indexOf(value) === index,
    );

    if (addresses.length === 0) {
      setBalances(ZERO);
      setLoading(false);
      return;
    }
    try {
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

      setBalances({
        usdRaw,
        ethRaw,
        wethRaw,
        wbtcRaw,
        usd,
        eth,
        weth,
        wbtc,
        usdFormatted: usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        ethFormatted: eth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }),
      });
    } catch (err) {
      console.error("[useBalances] Failed to fetch balances:", err);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    refetch();
    const hasAddress = Array.isArray(address)
      ? address.some(Boolean)
      : Boolean(address);
    if (!hasAddress) return;
    const id = setInterval(refetch, pollInterval);
    return () => clearInterval(id);
  }, [refetch, address, pollInterval]);

  // Listen for balance:refetch events from other components
  useEffect(() => {
    const handler = () => {
      refetch();
      for (const delay of [1_500, 6_000]) {
        window.setTimeout(() => refetch(), delay);
      }
    };
    window.addEventListener("balance:refetch", handler);
    return () => window.removeEventListener("balance:refetch", handler);
  }, [refetch]);

  return { ...balances, loading, refetch };
}
