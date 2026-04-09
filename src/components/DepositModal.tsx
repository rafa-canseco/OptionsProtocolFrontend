"use client";

import { useState, useCallback, useEffect } from "react";
import { encodeFunctionData, formatUnits, parseUnits } from "viem";
import { useWallet, type ExternalWallet } from "@/hooks/useWallet";
import { useBalances } from "@/hooks/useBalances";
import { useSolanaBalance } from "@/hooks/useSolanaBalance";
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

const TOKENS_BY_CHAIN: Record<"base" | "solana", Token[]> = {
  base: ["usdc", "eth", "btc"],
  solana: ["usdc"],
};

interface Props {
  onClose: () => void;
  requiredToken?: Token;
  onComplete?: () => void;
}

function truncate(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function chainLabel(chain: "base" | "solana"): string {
  return chain === "base" ? "Base" : "Solana";
}

export function DepositModal({ onClose, requiredToken, onComplete }: Props) {
  const {
    address,
    fundingAddress,
    solanaAddress,
    externalWallets,
    sendBatchTx,
    sendFundingTx,
    sendSolanaDeposit,
    activateSmartWallet,
    connectWallet,
    disconnect,
  } = useWallet();
  const smartBalances = useBalances(address);
  const eoaBalances = useBalances(fundingAddress);
  const solBalance = useSolanaBalance(solanaAddress);

  const [tab, setTab] = useState<Tab>("deposit");
  const [selectedWallet, setSelectedWallet] =
    useState<ExternalWallet | null>(null);
  const [token, setToken] = useState<Token>(requiredToken ?? "usdc");
  const [amountStr, setAmountStr] = useState("");
  const [status, setStatus] = useState<
    "idle" | "pending" | "done" | "activating"
  >("idle");
  const [error, setError] = useState<string | null>(null);

  // Auto-select first wallet when list populates
  useEffect(() => {
    if (!selectedWallet && externalWallets.length > 0) {
      setSelectedWallet(externalWallets[0]);
    }
  }, [selectedWallet, externalWallets]);

  // Reset token if selected token not available for chain
  useEffect(() => {
    if (!selectedWallet) return;
    const available = TOKENS_BY_CHAIN[selectedWallet.chain];
    if (!available.includes(token)) {
      setToken(available[0]);
      setAmountStr("");
    }
  }, [selectedWallet, token]);

  // Withdraw is always Base-only; deposit uses the selected wallet's chain
  const chain = tab === "withdraw" ? "base" : (selectedWallet?.chain ?? "base");
  const meta = TOKEN_META[token];
  const availableTokens = TOKENS_BY_CHAIN[chain];

  // --- Unified balance header ---
  const baseUsdc = smartBalances.usd;
  const solanaUsdc = solBalance.solanaUsdc;
  const totalUsdc = baseUsdc + solanaUsdc;

  // --- Available balance for deposit/withdraw ---
  const availableBalance =
    tab === "deposit"
      ? chain === "solana"
        ? 0 // external wallet balance unknown; user enters amount
        : token === "usdc"
          ? eoaBalances.usd
          : token === "eth"
            ? eoaBalances.eth
            : eoaBalances.wbtc
      : token === "usdc"
        ? smartBalances.usd
        : token === "eth"
          ? smartBalances.weth
          : smartBalances.wbtc;

  const rawBalance =
    tab === "deposit"
      ? chain === "solana"
        ? BigInt(0)
        : token === "usdc"
          ? eoaBalances.usdRaw
          : token === "eth"
            ? eoaBalances.ethRaw
            : eoaBalances.wbtcRaw
      : token === "usdc"
        ? smartBalances.usdRaw
        : token === "eth"
          ? smartBalances.wethRaw
          : smartBalances.wbtcRaw;

  const handleMax = useCallback(() => {
    if (rawBalance > BigInt(0)) {
      setAmountStr(formatUnits(rawBalance, meta.decimals));
    }
  }, [rawBalance, meta.decimals]);

  // --- Base deposit (existing EVM flow) ---
  const handleBaseDeposit = useCallback(async () => {
    if (!address || !fundingAddress) {
      setError("Wallet not ready. Please reconnect.");
      return;
    }
    let amount: bigint;
    try {
      amount = parseUnits(amountStr, meta.decimals);
    } catch (err) {
      console.error("[DepositModal] parseUnits failed:", err);
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
        hash = await sendFundingTx({
          to: address,
          data: "0x",
          value: amount,
        });
      } else {
        const tokenAddress =
          token === "usdc" ? ADDRESSES.usdc : ADDRESSES.wbtc;
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
      setTimeout(
        () => window.dispatchEvent(new Event("balance:refetch")),
        2000,
      );
      onComplete?.();
    } catch (err) {
      console.error("[DepositModal] base deposit failed:", err);
      setError(
        err instanceof Error ? err.message : "Transaction failed.",
      );
      setStatus("idle");
    }
  }, [
    address, fundingAddress, amountStr, meta.decimals,
    token, sendFundingTx, onComplete,
  ]);

  // --- Solana deposit (SPL USDC transfer) ---
  const handleSolanaDeposit = useCallback(async () => {
    if (!selectedWallet) {
      setError("No Solana wallet selected.");
      return;
    }
    let amount: bigint;
    try {
      amount = parseUnits(amountStr, 6); // USDC always 6 decimals
    } catch (err) {
      console.error("[DepositModal] parseUnits failed:", err);
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
      await sendSolanaDeposit(selectedWallet.address, amount);
      setStatus("done");
      window.dispatchEvent(new Event("balance:refetch"));
      setTimeout(
        () => window.dispatchEvent(new Event("balance:refetch")),
        2000,
      );
      onComplete?.();
    } catch (err) {
      console.error("[DepositModal] solana deposit failed:", err);
      const msg = err instanceof Error ? err.message : "";
      if (/reject|denied|cancel/i.test(msg)) {
        setError("Transaction cancelled.");
      } else {
        setError(msg || "Transaction failed.");
      }
      setStatus("idle");
    }
  }, [selectedWallet, amountStr, sendSolanaDeposit, onComplete]);

  const handleDeposit =
    chain === "solana" ? handleSolanaDeposit : handleBaseDeposit;

  // --- Withdraw (Base only for now) ---
  const handleWithdraw = useCallback(async () => {
    if (!address || !fundingAddress) {
      setError("Wallet not ready. Please reconnect.");
      return;
    }
    let amount: bigint;
    try {
      amount = parseUnits(amountStr, meta.decimals);
    } catch (err) {
      console.error("[DepositModal] parseUnits failed:", err);
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
      const tokenAddress =
        token === "usdc"
          ? ADDRESSES.usdc
          : token === "eth"
            ? ADDRESSES.weth
            : ADDRESSES.wbtc;

      const result = await sendBatchTx([
        {
          to: tokenAddress,
          data: encodeFunctionData({
            abi: ERC20_ABI,
            functionName: "transfer",
            args: [fundingAddress, amount],
          }),
        },
      ]);
      if (typeof result !== "string" || !result.startsWith("0x")) {
        throw new Error("Unexpected response from smart wallet");
      }
      const hash = result as `0x${string}`;
      await publicClient.waitForTransactionReceipt({ hash });
      setStatus("done");
      window.dispatchEvent(new Event("balance:refetch"));
      setTimeout(
        () => window.dispatchEvent(new Event("balance:refetch")),
        2000,
      );
    } catch (err) {
      console.error("[DepositModal] withdraw failed:", err);
      setError(
        err instanceof Error ? err.message : "Transaction failed.",
      );
      setStatus("idle");
    }
  }, [
    address, fundingAddress, amountStr, meta.decimals,
    token, sendBatchTx,
  ]);

  const isPending = status === "pending" || status === "activating";
  const isDone = status === "done";
  const needsActivation = !address;

  useEffect(() => {
    if (address && status === "activating") {
      setStatus("idle");
    }
  }, [address, status]);

  useEffect(() => {
    if (status !== "activating") return;
    const timer = setTimeout(() => {
      setError(
        "Activation is taking longer than expected. Please refresh.",
      );
      setStatus("idle");
    }, 15_000);
    return () => clearTimeout(timer);
  }, [status]);

  const handleActivate = useCallback(async () => {
    setError(null);
    setStatus("activating");
    try {
      await activateSmartWallet();
    } catch (err) {
      console.error("[DepositModal] activation failed:", err);
      const msg = err instanceof Error ? err.message : "";
      if (/reject|denied|cancel/i.test(msg)) {
        setError("Signature cancelled.");
      } else {
        setError(msg || "Activation failed. Please try again.");
      }
      setStatus("idle");
    }
  }, [activateSmartWallet]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="fixed inset-0 bg-black/50"
        onClick={isPending ? undefined : onClose}
      />
      <div className="relative w-full max-w-sm bg-[var(--bg)] rounded-t-2xl sm:rounded-2xl border border-[var(--border)] p-6 space-y-5">
        {/* Header with unified balance */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-[var(--text)]">
              Your trading account
            </h2>
            {address && (
              <button
                onClick={() => navigator.clipboard.writeText(address)}
                className="text-xs text-[var(--text-secondary)] font-mono mt-0.5 hover:text-[var(--text)] transition-colors cursor-pointer break-all text-left"
                title="Copy address"
              >
                {address}
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            disabled={isPending}
            className="text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors disabled:opacity-40 text-xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Unified USDC balance */}
        <div className="rounded-xl bg-[var(--surface)] px-4 py-3">
          <p className="text-xs text-[var(--text-secondary)] mb-1">
            Total USDC Balance
          </p>
          <p className="text-lg font-semibold text-[var(--text)]">
            $
            {totalUsdc.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
          <div className="flex gap-3 mt-1 text-xs text-[var(--text-secondary)]">
            <span>
              Base: $
              {baseUsdc.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
            <span>
              Solana: $
              {solanaUsdc.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
        </div>

        {needsActivation ? (
          <>
            <p className="text-sm text-[var(--text-secondary)]">
              Activate your self-custodial trading account with a one-time
              signature. After this, you can deposit funds and trade with
              zero gas fees.
            </p>
            {error && (
              <p className="text-sm text-[var(--danger)]">{error}</p>
            )}
            <button
              onClick={handleActivate}
              disabled={isPending}
              className="w-full rounded-xl bg-[var(--accent)] py-3 text-sm font-semibold text-[var(--bg)] hover:bg-[var(--accent-hover)] disabled:opacity-40 transition-colors"
            >
              {status === "activating"
                ? "Activating..."
                : "Activate account"}
            </button>
          </>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex rounded-xl bg-[var(--surface)] p-1 gap-1">
              {(["deposit", "withdraw"] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setTab(t);
                    setAmountStr("");
                    setError(null);
                    setStatus("idle");
                  }}
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

            {/* Wallet selector (deposit only) */}
            {tab === "deposit" && (
              <div className="space-y-2">
                <p className="text-xs text-[var(--text-secondary)]">
                  Deposit from
                </p>
                {externalWallets.length === 0 ? (
                  <button
                    onClick={() => connectWallet()}
                    className="w-full rounded-xl border border-dashed border-[var(--border)] py-3 text-sm text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                  >
                    Connect a wallet to deposit
                  </button>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {externalWallets.map((w) => (
                      <button
                        key={w.address}
                        onClick={() => {
                          setSelectedWallet(w);
                          setAmountStr("");
                          setError(null);
                        }}
                        disabled={isPending}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm border transition-colors text-left ${
                          selectedWallet?.address === w.address
                            ? "border-[var(--accent)] bg-[var(--accent)]/10"
                            : "border-[var(--border)] hover:border-[var(--text-secondary)]"
                        } disabled:opacity-40`}
                      >
                        <div className="flex-1 min-w-0">
                          <span className="font-semibold text-[var(--text)]">
                            {w.name}
                          </span>
                          <span className="ml-2 text-[var(--text-secondary)] font-mono text-xs">
                            {truncate(w.address)}
                          </span>
                        </div>
                        <span className="text-xs text-[var(--text-secondary)] shrink-0">
                          {chainLabel(w.chain)}
                        </span>
                      </button>
                    ))}
                    <button
                      onClick={() => connectWallet()}
                      disabled={isPending}
                      className="w-full rounded-xl border border-dashed border-[var(--border)] py-2.5 text-xs text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors disabled:opacity-40"
                    >
                      + Connect another wallet
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Token selector */}
            <div className="flex gap-2">
              {availableTokens.map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setToken(t);
                    setAmountStr("");
                    setError(null);
                  }}
                  disabled={isPending}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                    token === t
                      ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10"
                      : "border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--text-secondary)]"
                  } disabled:opacity-40`}
                >
                  <img
                    src={TOKEN_META[t].icon}
                    alt={TOKEN_META[t].label}
                    className="w-4 h-4 rounded-full"
                  />
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
                    if (
                      raw === "" ||
                      /^(0|[1-9]\d*)?\.?\d*$/.test(raw)
                    ) {
                      setAmountStr(raw);
                    }
                  }}
                  className="flex-1 bg-transparent text-[var(--text)] font-semibold text-base focus:outline-none"
                />
                {(tab === "withdraw" || chain === "base") && (
                  <button
                    onClick={handleMax}
                    disabled={
                      isPending || isDone || availableBalance <= 0
                    }
                    className="text-xs font-semibold text-[var(--accent)] hover:opacity-80 transition-opacity disabled:opacity-40"
                  >
                    Max
                  </button>
                )}
              </div>
              {/* Show available balance for Base deposits and all withdrawals */}
              {(tab === "withdraw" || chain === "base") && (
                <p className="text-xs text-[var(--text-secondary)] mt-1.5">
                  Available:{" "}
                  {token === "usdc"
                    ? `$${availableBalance.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`
                    : `${availableBalance.toLocaleString(undefined, {
                        minimumFractionDigits: 4,
                        maximumFractionDigits: 6,
                      })} ${meta.label}`}
                  {tab === "withdraw" && token === "eth" ? " (WETH)" : ""}
                </p>
              )}
            </div>

            {/* Withdraw gas note */}
            {tab === "withdraw" && fundingAddress && (
              <p className="text-xs text-[var(--text-secondary)]">
                Withdraw to {truncate(fundingAddress)}. Gas is sponsored.
              </p>
            )}

            {error && (
              <p className="text-sm text-[var(--danger)]">{error}</p>
            )}

            {isDone ? (
              <div className="space-y-3">
                <p className="text-sm text-center text-[var(--accent)] font-semibold">
                  {tab === "deposit"
                    ? "Deposit complete."
                    : "Withdrawal complete."}
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
                disabled={
                  isPending || !amountStr || !(Number(amountStr) > 0)
                }
                className="w-full rounded-xl bg-[var(--accent)] py-3 text-sm font-semibold text-[var(--bg)] hover:bg-[var(--accent-hover)] disabled:opacity-40 transition-colors"
              >
                {isPending
                  ? tab === "deposit"
                    ? "Depositing..."
                    : "Withdrawing..."
                  : tab === "deposit"
                    ? `Deposit ${meta.label} on ${chainLabel(chain)}`
                    : `Withdraw ${meta.label}`}
              </button>
            )}
          </>
        )}

        {/* Disconnect */}
        <button
          onClick={async () => {
            try {
              await disconnect();
            } catch (err) {
              console.error("[DepositModal] disconnect failed:", err);
            }
            onClose();
          }}
          disabled={isPending}
          className="w-full text-center text-xs text-[var(--text-secondary)] hover:text-[var(--danger)] transition-colors disabled:opacity-40"
        >
          Disconnect wallet
        </button>
      </div>
    </div>
  );
}
