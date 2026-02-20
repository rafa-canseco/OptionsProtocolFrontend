"use client";

import { useEffect, useRef, useState } from "react";
import { parseUnits, type Address, type Hash } from "viem";
import { publicClient, ADDRESSES, ERC20_ABI } from "@/lib/contracts";
import type { WalletClient } from "viem";

const MINT_USD = parseUnits("100000", 6);   // 100,000 LUSD
const MINT_ETH = parseUnits("50", 18);      // 50 LETH

export function useAutoFaucet(
  address: Address | undefined,
  walletClient: WalletClient | null,
  onComplete?: () => void,
) {
  const attempted = useRef(false);
  const [minting, setMinting] = useState(false);
  const [showNotification, setShowNotification] = useState(false);

  useEffect(() => {
    if (!address || !walletClient || attempted.current) return;
    attempted.current = true;

    (async () => {
      try {
        const usdBalance = await publicClient.readContract({
          address: ADDRESSES.usdc,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [address],
        });

        if (usdBalance > BigInt(0)) return;

        setMinting(true);

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
        console.error("[useAutoFaucet] Mint failed:", err);
        setMinting(false);
      }
    })();
  }, [address, walletClient, onComplete]);

  return { minting, showNotification };
}
