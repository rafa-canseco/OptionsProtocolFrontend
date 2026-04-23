"use client";

import { isDevnet } from "@/lib/deployment";

interface Props {
  assetSymbol?: string;
  className?: string;
}

export function DevnetBanner({ assetSymbol, className = "" }: Props) {
  if (!isDevnet()) return null;

  return (
    <div
      className={`rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100 ${className}`.trim()}
    >
      Demo environment on Solana devnet. Wallet balances, fills, and{" "}
      {assetSymbol === "TSLAx" ? "TSLAx" : assetSymbol ?? "asset"} positions
      {" "}use mock tokens and staging liquidity.
    </div>
  );
}
