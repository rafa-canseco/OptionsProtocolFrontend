"use client";

import { useState, useEffect } from "react";
import { type Address } from "viem";
import { publicClient, ADDRESSES } from "@/lib/contracts";

const AAVE_POOL_ADDRESS = (process.env.NEXT_PUBLIC_AAVE_POOL_ADDRESS ??
  null) as Address | null;

const AAVE_POOL_ABI = [
  {
    type: "function",
    name: "getReserveData",
    inputs: [{ name: "asset", type: "address" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "configuration", type: "uint256" },
          { name: "liquidityIndex", type: "uint128" },
          { name: "currentLiquidityRate", type: "uint128" },
          { name: "variableBorrowIndex", type: "uint128" },
          { name: "currentVariableBorrowRate", type: "uint128" },
          { name: "currentStableBorrowRate", type: "uint128" },
          { name: "lastUpdateTimestamp", type: "uint40" },
          { name: "id", type: "uint16" },
          { name: "aTokenAddress", type: "address" },
          { name: "stableDebtTokenAddress", type: "address" },
          { name: "variableDebtTokenAddress", type: "address" },
          { name: "interestRateStrategyAddress", type: "address" },
          { name: "accruedToTreasury", type: "uint128" },
          { name: "unbacked", type: "uint128" },
          { name: "isolationModeTotalDebt", type: "uint128" },
        ],
      },
    ],
    stateMutability: "view",
  },
] as const;

// RAY = 1e27 in Aave
const RAY = BigInt("1000000000000000000000000000");

const ASSET_MAP: Record<string, Address> = {
  usdc: ADDRESSES.usdc,
  eth: ADDRESSES.weth,
  btc: ADDRESSES.wbtc,
};

export type AaveRates = Record<string, number>;

// Fallback rates if on-chain read fails
const FALLBACK_RATES: AaveRates = {
  usdc: 0.0274,
  eth: 0.0155,
  btc: 0.0003,
};

async function fetchRate(asset: Address): Promise<number> {
  if (!AAVE_POOL_ADDRESS) return 0;
  const data = await publicClient.readContract({
    address: AAVE_POOL_ADDRESS,
    abi: AAVE_POOL_ABI,
    functionName: "getReserveData",
    args: [asset],
  });
  const liquidityRate = data.currentLiquidityRate;
  return Number(liquidityRate) / Number(RAY);
}

export function useAaveRates() {
  const [rates, setRates] = useState<AaveRates>(FALLBACK_RATES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!AAVE_POOL_ADDRESS) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    Promise.all(
      Object.entries(ASSET_MAP).map(async ([slug, addr]) => {
        try {
          const rate = await fetchRate(addr);
          return [slug, rate] as const;
        } catch {
          return [slug, FALLBACK_RATES[slug] ?? 0] as const;
        }
      }),
    ).then((results) => {
      if (cancelled) return;
      const newRates: AaveRates = {};
      for (const [slug, rate] of results) {
        newRates[slug] = rate;
      }
      setRates(newRates);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, []);

  return { rates, loading };
}
