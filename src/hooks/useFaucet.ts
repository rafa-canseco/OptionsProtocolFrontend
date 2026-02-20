"use client";

import { useState } from "react";
import { parseUnits, encodeFunctionData, type Address } from "viem";
import { ADDRESSES, ERC20_ABI } from "@/lib/contracts";

const MINT_USD = parseUnits("100000", 6);   // 100,000 LUSD
const MINT_ETH = parseUnits("50", 18);      // 50 LETH

type SendSponsoredTx = (tx: { to: Address; data: `0x${string}` }) => void;

export function useFaucet(
  address: Address | undefined,
  sendSponsoredTx: SendSponsoredTx | undefined,
  onComplete?: () => void,
) {
  const [minting, setMinting] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function mint() {
    if (!address || !sendSponsoredTx) return;
    setMinting(true);
    setError(null);

    try {
      const usdData = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: "mint",
        args: [address, MINT_USD],
      });
      sendSponsoredTx({ to: ADDRESSES.usdc, data: usdData });

      const ethData = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: "mint",
        args: [address, MINT_ETH],
      });
      sendSponsoredTx({ to: ADDRESSES.weth, data: ethData });

      setMinting(false);
      setShowNotification(true);
      onComplete?.();

      setTimeout(() => setShowNotification(false), 5000);
    } catch (err) {
      console.error("[useFaucet] Mint failed:", err);
      setError("Failed to mint test tokens. Try again.");
      setMinting(false);
    }
  }

  return { mint, minting, showNotification, error };
}
