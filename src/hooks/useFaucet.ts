"use client";

import { useState } from "react";
import { encodeFunctionData, type Address } from "viem";
import { IS_XLAYER, ADDRESSES, ERC20_ABI, publicClient } from "@/lib/contracts";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface FaucetOpts {
  address: Address | undefined;
  solanaAddress: string | undefined;
  onComplete?: () => void;
  sendFundingTx?: (call: {
    to: Address;
    data: `0x${string}`;
    value?: bigint;
  }) => Promise<`0x${string}`>;
  fundingAddress?: Address;
}

type FaucetResult =
  | { ok: true }
  | { ok: false; error: string };

export function useFaucet({
  address,
  solanaAddress,
  onComplete,
  sendFundingTx,
  fundingAddress,
}: FaucetOpts) {
  const [minting, setMinting] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function callFaucet(
    url: string,
    body: Record<string, string>,
  ): Promise<FaucetResult> {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        let detail: string | undefined;
        try {
          const data = await res.json();
          detail = data.detail;
        } catch { /* non-JSON */ }
        return { ok: false, error: detail || `Faucet error (${res.status})` };
      }
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Network error",
      };
    }
  }

  async function mintXLayer(): Promise<void> {
    if (!sendFundingTx || !fundingAddress) {
      throw new Error("Wallet not connected");
    }
    const recipient = fundingAddress;
    const mokbAddress = ADDRESSES.mokb ?? ADDRESSES.weth;

    const okbAmount = BigInt("1000") * BigInt(10) ** BigInt(18);
    const usdcAmount = BigInt("100000") * BigInt(10) ** BigInt(6);

    const mintOkbData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: "mint",
      args: [recipient, okbAmount],
    });
    const mintUsdcData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: "mint",
      args: [recipient, usdcAmount],
    });

    const hash1 = await sendFundingTx({
      to: mokbAddress,
      data: mintOkbData,
    });
    await publicClient.waitForTransactionReceipt({ hash: hash1 });

    const hash2 = await sendFundingTx({
      to: ADDRESSES.usdc,
      data: mintUsdcData,
    });
    await publicClient.waitForTransactionReceipt({ hash: hash2 });
  }

  async function mint() {
    if (IS_XLAYER) {
      if (!sendFundingTx || !fundingAddress) return;
      setMinting(true);
      setError(null);
      try {
        await mintXLayer();
        setNotification("You received 1,000 OKB and 100,000 USDC on X Layer.");
        setTimeout(() => setNotification(null), 5000);
        window.dispatchEvent(new Event("balance:refetch"));
        await onComplete?.();
      } catch (err) {
        console.error("[useFaucet] XLayer mint failed:", err);
        const msg = err instanceof Error ? err.message : "";
        if (/reject|denied|cancel/i.test(msg)) {
          setError("Transaction cancelled.");
        } else {
          setError(msg || "Minting failed.");
        }
      }
      setMinting(false);
      return;
    }

    if (!address && !solanaAddress) return;
    setMinting(true);
    setError(null);

    const results: string[] = [];
    const errors: string[] = [];

    const [baseResult, solanaResult] = await Promise.all([
      address
        ? callFaucet(`${API_BASE}/faucet`, { address })
        : null,
      solanaAddress
        ? callFaucet(`${API_BASE}/faucet/solana`, { address: solanaAddress })
        : null,
    ]);

    if (baseResult?.ok) {
      results.push("100,000 USDC, 50 ETH, and 2 BTC on Base");
    } else if (baseResult) {
      errors.push(baseResult.error);
    }

    if (solanaResult?.ok) {
      results.push("10,000 USDC and 0.1 SOL on Solana");
    } else if (solanaResult) {
      errors.push(solanaResult.error);
    }

    if (results.length > 0) {
      setNotification(`You received ${results.join("; ")}.`);
      setTimeout(() => setNotification(null), 5000);
      window.dispatchEvent(new Event("balance:refetch"));
      await onComplete?.();
    } else {
      setError(errors[0] || "Failed to get test tokens.");
    }

    setMinting(false);
  }

  return { mint, minting, notification, error };
}
