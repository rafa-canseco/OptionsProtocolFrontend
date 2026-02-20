"use client";

import { useState } from "react";
import { parseUnits, type Address, type Hash } from "viem";
import { publicClient, ADDRESSES, ERC20_ABI } from "@/lib/contracts";
import type { WalletClient } from "viem";

const MINT_USD = parseUnits("100000", 6);   // 100,000 LUSD
const MINT_ETH = parseUnits("50", 18);      // 50 LETH

export function useFaucet(
  address: Address | undefined,
  walletClient: WalletClient | null,
  onComplete?: () => void,
) {
  const [minting, setMinting] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function mint() {
    if (!address || !walletClient) return;
    setMinting(true);
    setError(null);

    try {
      const usdHash = await walletClient.writeContract({
        address: ADDRESSES.usdc,
        abi: ERC20_ABI,
        functionName: "mint",
        args: [address, MINT_USD],
        account: address,
        chain: publicClient.chain,
      });
      await publicClient.waitForTransactionReceipt({ hash: usdHash as Hash });

      const ethHash = await walletClient.writeContract({
        address: ADDRESSES.weth,
        abi: ERC20_ABI,
        functionName: "mint",
        args: [address, MINT_ETH],
        account: address,
        chain: publicClient.chain,
      });
      await publicClient.waitForTransactionReceipt({ hash: ethHash as Hash });

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
