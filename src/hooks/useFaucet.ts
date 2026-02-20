"use client";

import { useState } from "react";
import { parseUnits, encodeFunctionData, type Address } from "viem";
import { publicClient, ADDRESSES, ERC20_ABI } from "@/lib/contracts";

const MINT_USD = parseUnits("100000", 6);   // 100,000 LUSD
const MINT_ETH = parseUnits("50", 18);      // 50 LETH

type SendSponsoredTx = (tx: { to: Address; data: `0x${string}` }) => Promise<unknown>;

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
      // Snapshot balance before minting
      const usdBefore = await publicClient.readContract({
        address: ADDRESSES.usdc, abi: ERC20_ABI, functionName: "balanceOf", args: [address],
      });

      const usdData = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: "mint",
        args: [address, MINT_USD],
      });
      const ethData = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: "mint",
        args: [address, MINT_ETH],
      });

      // Serialize mints — Privy's relayer drops txs on concurrent nonces
      let usdOk = false;
      let ethOk = false;
      try { await sendSponsoredTx({ to: ADDRESSES.usdc, data: usdData }); usdOk = true; }
      catch (e) { console.warn("[useFaucet] USD mint tx failed:", e); }
      try { await sendSponsoredTx({ to: ADDRESSES.weth, data: ethData }); ethOk = true; }
      catch (e) { console.warn("[useFaucet] ETH mint tx failed:", e); }
      if (!usdOk && !ethOk) throw new Error("Both mint transactions failed. Check your connection and try again.");

      // Poll until USD balance increases (proves at least one mint landed)
      let confirmed = false;
      let consecutiveErrors = 0;
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        try {
          const usdNow = await publicClient.readContract({
            address: ADDRESSES.usdc, abi: ERC20_ABI, functionName: "balanceOf", args: [address],
          });
          consecutiveErrors = 0;
          if (usdNow > usdBefore) {
            confirmed = true;
            break;
          }
        } catch (err) {
          consecutiveErrors++;
          console.warn(`[useFaucet] Balance poll failed (attempt ${i + 1}):`, err);
          if (consecutiveErrors >= 5) {
            throw new Error("Lost connection while checking balance. Your tokens may still arrive — refresh the page.");
          }
        }
      }

      if (confirmed) {
        setShowNotification(true);
        setTimeout(() => setShowNotification(false), 5000);
      } else {
        setError("Tokens are taking longer than expected. Check your balance in a moment.");
      }
      window.dispatchEvent(new Event("balance:refetch"));
      await onComplete?.();
    } catch (err) {
      console.error("[useFaucet] Mint failed:", err);
      setError("Failed to mint test tokens. Try again.");
    } finally {
      setMinting(false);
    }
  }

  return { mint, minting, showNotification, error };
}
