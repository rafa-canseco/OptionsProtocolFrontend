"use client";

import { useState, useCallback, useEffect } from "react";
import { encodeFunctionData, formatUnits, parseUnits } from "viem";
import { useWallet } from "@/hooks/useWallet";
import { useBalances } from "@/hooks/useBalances";
import { publicClient, ADDRESSES, ERC20_ABI } from "@/lib/contracts";

type Tab = "deposit" | "withdraw";
type Token = "usdc" | "eth" | "btc";

interface TokenConfig {
  label: string;
  icon: string;
  decimals: number;
}

const TOKEN_META: Record<Token, TokenConfig> = {
  usdc: { label: "USDC", icon: "/usdc.svg", decimals: 6 },
  eth: { label: "ETH", icon: "/eth.png", decimals: 18 },
  btc: { label: "cbBTC", icon: "/cbbtc.webp", decimals: 8 },
};

interface Props {
  onClose: () => void;
  /** Pre-select a token when opened from a trade interception */
  requiredToken?: Token;
  /** Called after a successful deposit */
  onComplete?: () => void;
}

function truncate(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function DepositModal({ onClose, requiredToken, onComplete }: Props) {
  const { address, fundingAddress, sendBatchTx, sendFundingTx, activateSmartWallet, disconnect } = useWallet();
  const smartBalances = useBalances(address);
  const eoaBalances = useBalances(fundingAddress);

  const [tab, setTab] = useState<Tab>("deposit");
  const [token, setToken] = useState<Token>(requiredToken ?? "usdc");
  const [amountStr, setAmountStr] = useState("");
  const [status, setStatus] = useState<"idle" | "pending" | "done" | "activating">("idle");
  const [error, setError] = useState<string | null>(null);

  const meta = TOKEN_META[token];

  // Available balance depends on direction
  const availableBalance = tab === "deposit"
    ? token === "usdc" ? eoaBalances.usd
      : token === "eth" ? eoaBalances.eth
      : eoaBalances.wbtc
    : token === "usdc" ? smartBalances.usd
      : token === "eth" ? smartBalances.weth
      : smartBalances.wbtc;

  // Use raw bigint balance for Max to avoid float precision issues
  const rawBalance = tab === "deposit"
    ? token === "usdc" ? eoaBalances.usdRaw
      : token === "eth" ? eoaBalances.ethRaw
      : eoaBalances.wbtcRaw
    : token === "usdc" ? smartBalances.usdRaw
      : token === "eth" ? smartBalances.wethRaw
      : smartBalances.wbtcRaw;

  const handleMax = useCallback(() => {
    setAmountStr(formatUnits(rawBalance, meta.decimals));
  }, [rawBalance, meta.decimals]);

  const handleDeposit = useCallback(async () => {
    if (!address || !fundingAddress) {
      setError("Wallet not ready. Please reconnect.");
      return;
    }
    let amount: bigint;
    try {
      amount = parseUnits(amountStr, meta.decimals);
    } catch {
      setError("Invalid amount.");
      return;
    }
    if (amount === BigInt(0)) {
      setError("Enter an amount.");
      return;
    }

    setError(null);
    setStatus("pending");
    try {
      let hash: `0x${string}`;
      if (token === "eth") {
        // Native ETH: send value directly to smart wallet
        hash = await sendFundingTx({ to: address, data: "0x", value: amount });
      } else {
        const tokenAddress = token === "usdc" ? ADDRESSES.usdc : ADDRESSES.wbtc;
        hash = await sendFundingTx({
          to: tokenAddress,
          data: encodeFunctionData({
            abi: ERC20_ABI,
            functionName: "transfer",
            args: [address, amount],
          }),
        });
      }
      await publicClient.waitForTransactionReceipt({ hash });
      setStatus("done");
      window.dispatchEvent(new Event("balance:refetch"));
      setTimeout(() => window.dispatchEvent(new Event("balance:refetch")), 2000);
      onComplete?.();
    } catch (err) {
      console.error("[DepositModal] deposit failed:", err);
      setError(err instanceof Error ? err.message : "Transaction failed. Please try again.");
      setStatus("idle");
    }
  }, [address, fundingAddress, amountStr, meta.decimals, token, sendFundingTx, onComplete]);

  const handleWithdraw = useCallback(async () => {
    if (!address || !fundingAddress) {
      setError("Wallet not ready. Please reconnect.");
      return;
    }
    let amount: bigint;
    try {
      amount = parseUnits(amountStr, meta.decimals);
    } catch {
      setError("Invalid amount.");
      return;
    }
    if (amount === BigInt(0)) {
      setError("Enter an amount.");
      return;
    }

    setError(null);
    setStatus("pending");
    try {
      // Withdraw: transfer from smart wallet back to EOA
      // ETH/WETH option withdraws WETH token
      const tokenAddress = token === "usdc" ? ADDRESSES.usdc
        : token === "eth" ? ADDRESSES.weth
        : ADDRESSES.wbtc;

      const result = await sendBatchTx([{
        to: tokenAddress,
        data: encodeFunctionData({
          abi: ERC20_ABI,
          functionName: "transfer",
          args: [fundingAddress, amount],
        }),
      }]);
      if (typeof result !== "string" || !result.startsWith("0x")) {
        throw new Error("Unexpected response from smart wallet");
      }
      const hash = result as `0x${string}`;

      await publicClient.waitForTransactionReceipt({ hash });
      setStatus("done");
      window.dispatchEvent(new Event("balance:refetch"));
      setTimeout(() => window.dispatchEvent(new Event("balance:refetch")), 2000);
    } catch (err) {
      console.error("[DepositModal] withdraw failed:", err);
      setError(err instanceof Error ? err.message : "Transaction failed. Please try again.");
      setStatus("idle");
    }
  }, [address, fundingAddress, amountStr, meta.decimals, token, sendBatchTx]);

  const isPending = status === "pending" || status === "activating";
  const isDone = status === "done";
  const needsActivation = !address;

  // After loginOrLink(), Privy creates the embedded wallet (signer) and
  // then the smart wallet asynchronously. When address appears,
  // transition out of "activating" state.
  useEffect(() => {
    if (address && status === "activating") {
      console.log("[DepositModal] Smart wallet ready:", address);
      setStatus("idle");
    }
  }, [address, status]);

  // Timeout: if smart wallet doesn't appear within 15s, show error
  useEffect(() => {
    if (status !== "activating") return;
    const timer = setTimeout(() => {
      console.error("[DepositModal] Smart wallet activation timed out. address:", address);
      setError("Activation is taking longer than expected. Please refresh the page and try again.");
      setStatus("idle");
    }, 15_000);
    return () => clearTimeout(timer);
  }, [status, address]);

  const handleActivate = useCallback(async () => {
    setError(null);
    setStatus("activating");
    try {
      console.log("[DepositModal] Calling activateSmartWallet (loginOrLink)...");
      await activateSmartWallet();
      console.log("[DepositModal] loginOrLink resolved. Waiting for smart wallet...");
      // Don't set status to "idle" here. The effect above will do it
      // when the smart wallet address becomes available.
    } catch (err) {
      console.error("[DepositModal] activation failed:", err);
      const msg = err instanceof Error ? err.message : "";
      if (msg.match(/reject|denied|cancel/i)) {
        setError("Signature cancelled.");
      } else {
        setError("Activation failed. Please try again.");
      }
      setStatus("idle");
    }
  }, [activateSmartWallet]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={isPending ? undefined : onClose} />
      <div className="relative w-full max-w-sm bg-[var(--bg)] rounded-t-2xl sm:rounded-2xl border border-[var(--border)] p-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--text)]">Your trading account</h2>
          <button
            onClick={onClose}
            disabled={isPending}
            className="text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors disabled:opacity-40 text-xl leading-none"
          >
            ×
          </button>
        </div>

        {needsActivation ? (
          /* Smart wallet not set up yet — one-time activation */
          <>
            <p className="text-sm text-[var(--text-secondary)]">
              Activate your self-custodial trading account with a one-time signature. After this, you can deposit funds and trade with zero gas fees.
            </p>
            {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
            <button
              onClick={handleActivate}
              disabled={isPending}
              className="w-full rounded-xl bg-[var(--accent)] py-3 text-sm font-semibold text-[var(--bg)] hover:bg-[var(--accent-hover)] disabled:opacity-40 transition-colors"
            >
              {status === "activating" ? "Activating..." : "Activate account"}
            </button>
          </>
        ) : (
          /* Normal deposit/withdraw flow */
          <>

            {/* Tabs */}
            <div className="flex rounded-xl bg-[var(--surface)] p-1 gap-1">
              {(["deposit", "withdraw"] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => { setTab(t); setAmountStr(""); setError(null); setStatus("idle"); }}
                  disabled={isPending}
                  className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors capitalize ${
                    tab === t
                      ? "bg-[var(--bg)] text-[var(--text)] shadow-sm"
                      : "text-[var(--text-secondary)] hover:text-[var(--text)]"
                  } disabled:opacity-40`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Token selector */}
            <div className="flex gap-2">
              {(["usdc", "eth", "btc"] as Token[]).map((t) => (
                <button
                  key={t}
                  onClick={() => { setToken(t); setAmountStr(""); setError(null); }}
                  disabled={isPending}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                    token === t
                      ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10"
                      : "border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--text-secondary)]"
                  } disabled:opacity-40`}
                >
                  <img src={TOKEN_META[t].icon} alt={TOKEN_META[t].label} className="w-4 h-4 rounded-full" />
                  {TOKEN_META[t].label}
                </button>
              ))}
            </div>

            {/* Amount input */}
            <div>
              <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={amountStr}
                  disabled={isPending || isDone}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === "" || /^(0|[1-9]\d*)?\.?\d*$/.test(raw)) {
                      setAmountStr(raw);
                    }
                  }}
                  className="flex-1 bg-transparent text-[var(--text)] font-semibold text-base focus:outline-none"
                />
                <button
                  onClick={handleMax}
                  disabled={isPending || isDone || availableBalance <= 0}
                  className="text-xs font-semibold text-[var(--accent)] hover:opacity-80 transition-opacity disabled:opacity-40"
                >
                  Max
                </button>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-1.5">
                Available: {token === "usdc"
                  ? `$${availableBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : `${availableBalance.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 })} ${meta.label}`}
                {tab === "withdraw" && token === "eth" ? " (WETH)" : ""}
              </p>
            </div>

            {/* Withdraw gas note */}
            {tab === "withdraw" && fundingAddress && (
              <p className="text-xs text-[var(--text-secondary)]">
                Withdraw to {truncate(fundingAddress)}. Gas is sponsored.
              </p>
            )}

            {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

            {isDone ? (
              <div className="space-y-3">
                <p className="text-sm text-center text-[var(--accent)] font-semibold">
                  {tab === "deposit" ? "Deposit complete." : "Withdrawal complete."}
                </p>
                <button
                  onClick={onClose}
                  className="w-full rounded-xl bg-[var(--surface)] py-3 text-sm font-semibold text-[var(--text)] hover:bg-[var(--border)] transition-colors"
                >
                  Close
                </button>
              </div>
            ) : (
              <button
                onClick={tab === "deposit" ? handleDeposit : handleWithdraw}
                disabled={isPending || !amountStr || !(Number(amountStr) > 0)}
                className="w-full rounded-xl bg-[var(--accent)] py-3 text-sm font-semibold text-[var(--bg)] hover:bg-[var(--accent-hover)] disabled:opacity-40 transition-colors"
              >
                {isPending
                  ? tab === "deposit" ? "Depositing..." : "Withdrawing..."
                  : tab === "deposit" ? `Deposit ${meta.label}` : `Withdraw ${meta.label}`}
              </button>
            )}
          </>
        )}

        {/* Disconnect */}
        <button
          onClick={async () => { await disconnect(); onClose(); }}
          disabled={isPending}
          className="w-full text-center text-xs text-[var(--text-secondary)] hover:text-[var(--danger)] transition-colors disabled:opacity-40"
        >
          Disconnect wallet
        </button>
      </div>
    </div>
  );
}
