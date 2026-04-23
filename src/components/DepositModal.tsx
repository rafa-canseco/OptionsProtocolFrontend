"use client";

import { useState, useCallback, useEffect } from "react";
import { encodeFunctionData, formatUnits, parseUnits, type Address } from "viem";
import { useWallet, type ExternalWallet } from "@/hooks/useWallet";
import { useBalances } from "@/hooks/useBalances";
import { useSolanaBalance } from "@/hooks/useSolanaBalance";
import { publicClient, ADDRESSES, CHAIN, ERC20_ABI } from "@/lib/contracts";
import { isSolanaOffInProd } from "@/lib/marketState";
import { SOLANA_TSLAX_MINT, solanaTxUrl } from "@/lib/solana";

type Tab = "deposit" | "withdraw";
type Token = "usdc" | "eth" | "weth" | "btc" | "sol" | "tslax";
type AccountBalanceToken = Token | "wsol";

interface TokenConfig {
  label: string;
  icon: string;
  decimals: number;
}

const TOKEN_META: Record<AccountBalanceToken, TokenConfig> = {
  usdc: { label: "USDC", icon: "/usdc.svg", decimals: 6 },
  eth: { label: "ETH", icon: "/eth.png", decimals: 18 },
  weth: { label: "WETH", icon: "/weth.png", decimals: 18 },
  btc: { label: "cbBTC", icon: "/cbbtc.webp", decimals: 8 },
  sol: { label: "SOL", icon: "/sol.png", decimals: 9 },
  tslax: { label: "TSLAx", icon: "/tslax.svg", decimals: 8 },
  wsol: { label: "wSOL", icon: "/sol.png", decimals: 9 },
};

const TOKENS_BY_CHAIN: Record<"base" | "solana", Token[]> = {
  base: ["usdc", "eth", "weth", "btc"],
  solana: ["usdc", "sol", "tslax"],
};

const SOL_FEE_RESERVE_LAMPORTS = BigInt(5_000_000);

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

function refetchBalancesSoon() {
  window.dispatchEvent(new Event("balance:refetch"));
}

function TokenIcon({
  token,
  className,
}: {
  token: AccountBalanceToken;
  className: string;
}) {
  const meta = TOKEN_META[token];
  return (
    <span className={`relative inline-flex shrink-0 ${className}`}>
      <img
        src={meta.icon}
        alt={meta.label}
        className="h-full w-full rounded-full"
      />
      {token === "wsol" && (
        <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-[var(--accent)] text-[8px] font-bold leading-none text-[var(--bg)]">
          W
        </span>
      )}
    </span>
  );
}

export function DepositModal({ onClose, requiredToken, onComplete }: Props) {
  const {
    address,
    fundingAddress,
    withdrawAddress,
    hasExternalWallet,
    solanaAddress,
    externalWallets: rawExternalWallets,
    sendBatchTx,
    sendFundingTx,
    sendSolanaDeposit,
    sendSolanaSolDeposit,
    sendSolanaWithdraw,
    sendSolanaSolWithdraw,
    activateSmartWallet,
    connectWallet,
    disconnect,
  } = useWallet();
  const solanaDisabled = isSolanaOffInProd();
  const externalWallets = solanaDisabled
    ? rawExternalWallets.filter((w) => w.chain !== "solana")
    : rawExternalWallets;
  const [tab, setTab] = useState<Tab>("deposit");
  const [selectedWallet, setSelectedWallet] =
    useState<ExternalWallet | null>(null);
  const initialToken: Token =
    requiredToken && !(solanaDisabled && (requiredToken === "sol" || requiredToken === "tslax"))
      ? requiredToken
      : "usdc";
  const [token, setToken] = useState<Token>(initialToken);

  const smartBalances = useBalances(address);
  const selectedBaseAddress =
    selectedWallet?.chain === "base"
      ? (selectedWallet.address as Address)
      : undefined;
  const eoaBalances = useBalances(selectedBaseAddress ?? fundingAddress);
  const solBalance = useSolanaBalance(solanaAddress);
  const solExternalBalance = useSolanaBalance(
    selectedWallet?.chain === "solana" ? selectedWallet.address : undefined,
  );
  const [amountStr, setAmountStr] = useState("");
  const [status, setStatus] = useState<
    "idle" | "pending" | "done" | "activating"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txChain, setTxChain] = useState<"base" | "solana" | null>(null);
  const [assetMenuOpen, setAssetMenuOpen] = useState(false);
  const [assetSearch, setAssetSearch] = useState("");
  const [baseBalanceMenuOpen, setBaseBalanceMenuOpen] = useState(false);
  const [solanaBalanceMenuOpen, setSolanaBalanceMenuOpen] = useState(false);
  const [baseBalanceSearch, setBaseBalanceSearch] = useState("");
  const [solanaBalanceSearch, setSolanaBalanceSearch] = useState("");
  const [baseBalanceToken, setBaseBalanceToken] =
    useState<AccountBalanceToken>("usdc");
  const [solanaBalanceToken, setSolanaBalanceToken] =
    useState<AccountBalanceToken>("sol");

  // Auto-select a useful wallet when the list populates.
  useEffect(() => {
    if (!selectedWallet && externalWallets.length > 0) {
      const preferredChain =
        !solanaDisabled && (requiredToken === "sol" || requiredToken === "tslax")
          ? "solana"
          : "base";
      setSelectedWallet(
        externalWallets.find((w) => w.chain === preferredChain) ??
          externalWallets[0],
      );
    }
  }, [selectedWallet, externalWallets, requiredToken, solanaDisabled]);

  // Reset token if selected token not available for chain
  useEffect(() => {
    if (!selectedWallet) return;
    const available = TOKENS_BY_CHAIN[selectedWallet.chain];
    if (!available.includes(token)) {
      setToken(available[0]);
      setAmountStr("");
    }
  }, [selectedWallet, token]);

  const chain = selectedWallet?.chain ?? (
    !solanaDisabled && (requiredToken === "sol" || requiredToken === "tslax")
      ? "solana"
      : "base"
  );
  const meta = TOKEN_META[token];
  const availableTokens = TOKENS_BY_CHAIN[chain];
  const filteredAssetTokens = availableTokens.filter((asset) =>
    TOKEN_META[asset].label.toLowerCase().includes(assetSearch.trim().toLowerCase()),
  );
  const baseBalanceTokens: AccountBalanceToken[] = ["usdc", "eth", "weth", "btc"];
  const solanaBalanceTokens: AccountBalanceToken[] = ["usdc", "sol", "tslax", "wsol"];
  const filteredBaseBalanceTokens = baseBalanceTokens.filter((asset) =>
    TOKEN_META[asset].label.toLowerCase().includes(baseBalanceSearch.trim().toLowerCase()),
  );
  const filteredSolanaBalanceTokens = solanaBalanceTokens.filter((asset) =>
    TOKEN_META[asset].label.toLowerCase().includes(solanaBalanceSearch.trim().toLowerCase()),
  );

  // --- Available balance for deposit/withdraw ---
  const solanaWalletBalance =
    tab === "deposit" ? solExternalBalance : solBalance;

  const getRawBalance = useCallback((asset: Token): bigint => {
    if (chain === "solana") {
      if (asset === "sol") return solanaWalletBalance.solanaSolRaw;
      if (asset === "usdc") return solanaWalletBalance.solanaUsdcRaw;
      if (asset === "tslax") return solanaWalletBalance.solanaTslaxRaw;
      return BigInt(0);
    }
    if (tab === "deposit") {
      if (asset === "usdc") return eoaBalances.usdRaw;
      if (asset === "eth") return eoaBalances.ethRaw;
      if (asset === "weth") return eoaBalances.wethRaw;
      if (asset === "btc") return eoaBalances.wbtcRaw;
      return BigInt(0);
    }
    if (asset === "usdc") return smartBalances.usdRaw;
    if (asset === "eth") return smartBalances.ethRaw;
    if (asset === "weth") return smartBalances.wethRaw;
    if (asset === "btc") return smartBalances.wbtcRaw;
    return BigInt(0);
  }, [chain, eoaBalances, smartBalances, solanaWalletBalance, tab]);

  const getSpendableRaw = useCallback((asset: Token): bigint => {
    const balance = getRawBalance(asset);
    if (asset !== "sol") return balance;
    return balance > SOL_FEE_RESERVE_LAMPORTS
      ? balance - SOL_FEE_RESERVE_LAMPORTS
      : BigInt(0);
  }, [getRawBalance]);

  const maxSpendableRaw = getSpendableRaw(token);
  const maxSpendableBalance = Number(formatUnits(maxSpendableRaw, meta.decimals));
  const selectedWalletAddress = selectedWallet?.address;

  const formatTokenBalance = useCallback((asset: Token): string => {
    const tokenMeta = TOKEN_META[asset];
    const balance = Number(formatUnits(getSpendableRaw(asset), tokenMeta.decimals));
    if (asset === "usdc") {
      return `$${balance.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    }
    return `${balance.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: tokenMeta.decimals === 8 ? 6 : 4,
    })} ${tokenMeta.label}`;
  }, [getSpendableRaw]);

  const handleConnectWallet = useCallback(() => {
    connectWallet({
      walletList: ["metamask", "coinbase_wallet", "rainbow", "phantom"],
      walletChainType: "ethereum-and-solana",
      description: "Choose the wallet you want to use for deposits and withdrawals.",
    });
  }, [connectWallet]);

  const handleMax = useCallback(() => {
    if (maxSpendableRaw > BigInt(0)) {
      setAmountStr(formatUnits(maxSpendableRaw, meta.decimals));
    }
  }, [maxSpendableRaw, meta.decimals]);

  const needsBaseActivation = !address;

  const getTradingBalanceRaw = useCallback((
    account: "base" | "solana",
    asset: AccountBalanceToken,
  ): bigint => {
    if (account === "base") {
      if (asset === "usdc") return smartBalances.usdRaw;
      if (asset === "eth") return smartBalances.ethRaw;
      if (asset === "weth") return smartBalances.wethRaw;
      if (asset === "btc") return smartBalances.wbtcRaw;
      return BigInt(0);
    }
    if (asset === "usdc") return solBalance.solanaUsdcRaw;
    if (asset === "sol") return solBalance.solanaSolRaw;
    if (asset === "tslax") return solBalance.solanaTslaxRaw;
    if (asset === "wsol") return solBalance.solanaWsolRaw;
    return BigInt(0);
  }, [smartBalances, solBalance]);

  const formatTradingBalance = useCallback((
    account: "base" | "solana",
    asset: AccountBalanceToken,
  ): string => {
    const tokenMeta = TOKEN_META[asset];
    const balance = Number(formatUnits(
      getTradingBalanceRaw(account, asset),
      tokenMeta.decimals,
    ));
    if (asset === "usdc") {
      return `$${balance.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    }
    return balance.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: tokenMeta.decimals === 8 ? 6 : 4,
    });
  }, [getTradingBalanceRaw]);

  const parseAmount = useCallback((): bigint | null => {
    try {
      const amount = parseUnits(amountStr, meta.decimals);
      if (amount === BigInt(0)) {
        setError("Enter an amount.");
        return null;
      }
      if (amount > maxSpendableRaw) {
        setError(
          token === "sol"
            ? "Leave at least 0.005 SOL in your wallet for network fees."
            : "Amount exceeds available balance.",
        );
        return null;
      }
      return amount;
    } catch (err) {
      console.error("[DepositModal] parseUnits failed:", err);
      setError("Invalid amount.");
      return null;
    }
  }, [amountStr, maxSpendableRaw, meta.decimals, token]);

  // --- Base deposit (existing EVM flow) ---
  const handleBaseDeposit = useCallback(async () => {
    if (!address || !fundingAddress) {
      setError("Wallet not ready. Please reconnect.");
      return;
    }
    const amount = parseAmount();
    if (amount == null) return;

    setError(null);
    setStatus("pending");
    setTxHash(null);
    setTxChain(null);
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
          token === "usdc"
            ? ADDRESSES.usdc
            : token === "weth"
              ? ADDRESSES.weth
              : ADDRESSES.wbtc;
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
      setTxHash(hash);
      setTxChain("base");
      setStatus("done");
      refetchBalancesSoon();
      onComplete?.();
    } catch (err) {
      console.error("[DepositModal] base deposit failed:", err);
      setError(
        err instanceof Error ? err.message : "Transaction failed.",
      );
      setStatus("idle");
    }
  }, [
    address, fundingAddress, parseAmount,
    token, sendFundingTx, onComplete,
  ]);

  // --- Solana deposit (SPL USDC or native SOL transfer) ---
  const handleSolanaDeposit = useCallback(async () => {
    if (solanaDisabled) {
      setError("Solana deposits are disabled in production.");
      return;
    }
    if (!selectedWallet || selectedWallet.chain !== "solana") {
      setError("No Solana wallet selected.");
      return;
    }
    const amount = parseAmount();
    if (amount == null) return;

    setError(null);
    setStatus("pending");
    setTxHash(null);
    setTxChain(null);
    try {
      let signature: string;
      if (token === "sol") {
        signature = await sendSolanaSolDeposit(selectedWallet.address, amount);
      } else {
        signature = await sendSolanaDeposit(
          selectedWallet.address,
          amount,
          token === "tslax" ? "tslax" : "usdc",
        );
      }
      setTxHash(signature);
      setTxChain("solana");
      setStatus("done");
      refetchBalancesSoon();
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
  }, [
    solanaDisabled, selectedWallet, parseAmount, token,
    sendSolanaDeposit, sendSolanaSolDeposit, onComplete,
  ]);

  const handleDeposit =
    chain === "solana" ? handleSolanaDeposit : handleBaseDeposit;
  const needsWallet = !selectedWallet;

  const handleActivate = useCallback(async () => {
    setError(null);
    setStatus("activating");
    try {
      await activateSmartWallet(
        selectedWallet?.chain === "base" ? selectedWallet.address : undefined,
      );
      setStatus("idle");
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
  }, [activateSmartWallet, selectedWallet]);

  const handleBaseWithdraw = useCallback(async () => {
    if (!selectedWallet || selectedWallet.chain !== "base") {
      setError("Connect an external wallet to withdraw.");
      return;
    }
    const baseWithdrawAddr = selectedWallet.address as Address;
    if (!address) {
      setError("Smart wallet not ready. Please reconnect.");
      return;
    }
    const amount = parseAmount();
    if (amount == null) return;

    setError(null);
    setStatus("pending");
    setTxHash(null);
    setTxChain(null);
    try {
      const tokenAddress =
        token === "usdc"
          ? ADDRESSES.usdc
          : token === "eth"
            ? null
            : token === "weth"
              ? ADDRESSES.weth
              : ADDRESSES.wbtc;

      const result = await sendBatchTx([
        tokenAddress
          ? {
              to: tokenAddress,
              data: encodeFunctionData({
                abi: ERC20_ABI,
                functionName: "transfer",
                args: [baseWithdrawAddr, amount],
              }),
            }
          : {
              to: baseWithdrawAddr,
              data: "0x",
              value: amount,
            },
      ]);
      if (typeof result !== "string" || !result.startsWith("0x")) {
        throw new Error("Unexpected response from smart wallet");
      }
      const hash = result as `0x${string}`;
      await publicClient.waitForTransactionReceipt({ hash });
      setTxHash(hash);
      setTxChain("base");
      setStatus("done");
      refetchBalancesSoon();
    } catch (err) {
      console.error("[DepositModal] withdraw failed:", err);
      setError(
        err instanceof Error ? err.message : "Transaction failed.",
      );
      setStatus("idle");
    }
  }, [
    address, selectedWallet, parseAmount,
    token, sendBatchTx,
  ]);

  const handleSolanaWithdraw = useCallback(async () => {
    if (solanaDisabled) {
      setError("Solana withdrawals are disabled in production.");
      return;
    }
    if (!selectedWallet || selectedWallet.chain !== "solana") {
      setError("Select a Solana wallet to receive funds.");
      return;
    }
    const amount = parseAmount();
    if (amount == null) return;

    setError(null);
    setStatus("pending");
    setTxHash(null);
    setTxChain(null);
    try {
      const signature = token === "sol"
        ? await sendSolanaSolWithdraw(selectedWallet.address, amount)
        : await sendSolanaWithdraw(
            selectedWallet.address,
            amount,
            token === "tslax" ? "tslax" : "usdc",
          );
      setTxHash(signature);
      setTxChain("solana");
      setStatus("done");
      refetchBalancesSoon();
    } catch (err) {
      console.error("[DepositModal] solana withdraw failed:", err);
      setError(
        err instanceof Error ? err.message : "Transaction failed.",
      );
      setStatus("idle");
    }
  }, [
    solanaDisabled, selectedWallet, parseAmount, token,
    sendSolanaSolWithdraw, sendSolanaWithdraw,
  ]);

  const handleWithdraw =
    chain === "solana" ? handleSolanaWithdraw : handleBaseWithdraw;

  const isPending = status === "pending" || status === "activating";
  const isDone = status === "done";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="fixed inset-0 bg-black/50"
        onClick={isPending ? undefined : onClose}
      />
      <div
        className="relative max-h-[90vh] w-full max-w-sm overflow-y-auto bg-[var(--bg)] rounded-t-2xl sm:rounded-2xl border border-[var(--border)] p-6 space-y-5"
        onWheel={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--text)]">
            Manage funds
          </h2>
          <button
            onClick={onClose}
            disabled={isPending}
            className="text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors disabled:opacity-40 text-xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Trading accounts */}
        <div className="space-y-2">
          {/* Base account */}
          <div className="rounded-xl bg-[var(--surface)] px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img src="/base.svg" alt="Base" className="w-4 h-4" />
                <span className="text-sm font-semibold text-[var(--text)]">
                  Base trading account
                </span>
              </div>
              <span className={`text-xs font-semibold ${
                address ? "text-[var(--accent)]" : "text-amber-400"
              }`}>
                {address ? "Active" : "Activation needed"}
              </span>
            </div>
            <div className="relative mt-3 flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2">
              <button
                type="button"
                onClick={() => {
                  setBaseBalanceMenuOpen((open) => !open);
                  setBaseBalanceSearch("");
                }}
                className="flex items-center gap-2 text-xs font-semibold text-[var(--text)]"
              >
                <TokenIcon token={baseBalanceToken} className="h-5 w-5" />
                {TOKEN_META[baseBalanceToken].label}
                <span className="text-[var(--text-secondary)]">⌄</span>
              </button>
              <span className="font-mono text-sm font-semibold text-[var(--text)]">
                {formatTradingBalance("base", baseBalanceToken)}
                {baseBalanceToken !== "usdc" ? ` ${TOKEN_META[baseBalanceToken].label}` : ""}
              </span>
              {baseBalanceMenuOpen && (
                <div
                  className="absolute left-0 top-full z-20 mt-2 w-56 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg)] shadow-xl"
                  onWheel={(e) => e.stopPropagation()}
                >
                  <div className="border-b border-[var(--border)] p-2">
                    <input
                      type="text"
                      value={baseBalanceSearch}
                      onChange={(e) => setBaseBalanceSearch(e.target.value)}
                      placeholder="Search asset"
                      autoFocus
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-secondary)] focus:border-[var(--accent)] focus:outline-none"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto overscroll-contain">
                    {filteredBaseBalanceTokens.map((asset) => (
                      <button
                        key={asset}
                        type="button"
                        onClick={() => {
                          setBaseBalanceToken(asset);
                          setBaseBalanceMenuOpen(false);
                          setBaseBalanceSearch("");
                        }}
                        className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm ${
                          baseBalanceToken === asset
                            ? "bg-[var(--accent)]/10"
                            : "hover:bg-[var(--surface)]"
                        }`}
                      >
                        <TokenIcon token={asset} className="h-5 w-5" />
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold text-[var(--text)]">
                            {TOKEN_META[asset].label}
                          </span>
                          <span className="block text-xs font-mono text-[var(--text-secondary)]">
                            {formatTradingBalance("base", asset)}
                            {asset !== "usdc" ? ` ${TOKEN_META[asset].label}` : ""}
                          </span>
                        </span>
                      </button>
                    ))}
                    {filteredBaseBalanceTokens.length === 0 && (
                      <p className="px-3 py-4 text-sm text-[var(--text-secondary)]">
                        No assets found.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
            {address ? (
              <p className="text-[10px] text-[var(--text-secondary)] font-mono mt-1">
                {truncate(address)}
              </p>
            ) : (
              <p className="text-[10px] text-amber-400 mt-1">
                Needs one-time activation to trade on Base
              </p>
            )}
          </div>

          {/* Solana account */}
          {!solanaDisabled && (
          <div className="rounded-xl bg-[var(--surface)] px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img src="/sol.png" alt="Solana" className="w-4 h-4 rounded-full" />
                <span className="text-sm font-semibold text-[var(--text)]">
                  Solana trading account
                </span>
              </div>
              <span className={`text-xs font-semibold ${
                solanaAddress ? "text-[var(--accent)]" : "text-[var(--text-secondary)]"
              }`}>
                {solanaAddress ? "Active" : "Ready on deposit"}
              </span>
            </div>
            <div className="relative mt-3 flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2">
              <button
                type="button"
                onClick={() => {
                  setSolanaBalanceMenuOpen((open) => !open);
                  setSolanaBalanceSearch("");
                }}
                className="flex items-center gap-2 text-xs font-semibold text-[var(--text)]"
              >
                <TokenIcon token={solanaBalanceToken} className="h-5 w-5" />
                {TOKEN_META[solanaBalanceToken].label}
                <span className="text-[var(--text-secondary)]">⌄</span>
              </button>
              <span className="font-mono text-sm font-semibold text-[var(--text)]">
                {formatTradingBalance("solana", solanaBalanceToken)}
                {solanaBalanceToken !== "usdc" ? ` ${TOKEN_META[solanaBalanceToken].label}` : ""}
              </span>
              {solanaBalanceMenuOpen && (
                <div
                  className="absolute left-0 top-full z-20 mt-2 w-56 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg)] shadow-xl"
                  onWheel={(e) => e.stopPropagation()}
                >
                  <div className="border-b border-[var(--border)] p-2">
                    <input
                      type="text"
                      value={solanaBalanceSearch}
                      onChange={(e) => setSolanaBalanceSearch(e.target.value)}
                      placeholder="Search asset"
                      autoFocus
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-secondary)] focus:border-[var(--accent)] focus:outline-none"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto overscroll-contain">
                    {filteredSolanaBalanceTokens.map((asset) => (
                      <button
                        key={asset}
                        type="button"
                        onClick={() => {
                          setSolanaBalanceToken(asset);
                          setSolanaBalanceMenuOpen(false);
                          setSolanaBalanceSearch("");
                        }}
                        className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm ${
                          solanaBalanceToken === asset
                            ? "bg-[var(--accent)]/10"
                            : "hover:bg-[var(--surface)]"
                        }`}
                      >
                        <TokenIcon token={asset} className="h-5 w-5" />
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold text-[var(--text)]">
                            {TOKEN_META[asset].label}
                          </span>
                          <span className="block text-xs font-mono text-[var(--text-secondary)]">
                            {formatTradingBalance("solana", asset)}
                            {asset !== "usdc" ? ` ${TOKEN_META[asset].label}` : ""}
                          </span>
                        </span>
                      </button>
                    ))}
                    {filteredSolanaBalanceTokens.length === 0 && (
                      <p className="px-3 py-4 text-sm text-[var(--text-secondary)]">
                        No assets found.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
            <p className="text-[10px] text-[var(--text-secondary)] font-mono mt-1">
              {solanaAddress ? truncate(solanaAddress) : "Set up on first deposit"}
            </p>
          </div>
          )}
        </div>

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
                setTxHash(null);
                setTxChain(null);
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

        {/* Wallet selector */}
        <div className="space-y-2">
          <p className="text-xs text-[var(--text-secondary)]">
            {tab === "deposit" ? "From wallet" : "Withdraw to"}
          </p>
          {externalWallets.length === 0 ? (
            <button
              onClick={handleConnectWallet}
              className="w-full rounded-xl border border-dashed border-[var(--border)] py-3 text-sm text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
            >
              + Connect another wallet
            </button>
          ) : (
            <div className="flex flex-col gap-1.5">
              {externalWallets.map((w) => (
                <button
                  key={`${w.chain}-${w.address}`}
                  onClick={() => {
                    setSelectedWallet(w);
                    setAmountStr("");
                    setError(null);
                    setStatus("idle");
                    setTxHash(null);
                    setTxChain(null);
                  }}
                  disabled={isPending}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm border transition-colors text-left ${
                    selectedWallet?.address === w.address &&
                    selectedWallet?.chain === w.chain
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
                onClick={handleConnectWallet}
                disabled={isPending}
                className="w-full rounded-xl border border-dashed border-[var(--border)] py-2.5 text-xs text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors disabled:opacity-40"
              >
                + Connect another wallet
              </button>
            </div>
          )}
          {selectedWallet && (
            <p className="text-xs text-[var(--text-secondary)]">
              {tab === "deposit"
                ? `${selectedWallet.name} → ${chainLabel(chain)} trading account`
                : `${chainLabel(chain)} trading account → ${selectedWallet.name}`}
            </p>
          )}
        </div>

        {/* Base activation gate — show activate button instead of deposit/withdraw UI */}
        {needsWallet ? (
          <div className="space-y-3">
            <p className="text-sm text-[var(--text-secondary)]">
              Connect the wallet you want to use for deposits and withdrawals.
            </p>
          </div>
        ) : needsBaseActivation && chain === "base" ? (
          <div className="space-y-3">
            <p className="text-sm text-[var(--text-secondary)]">
              Activate your Base trading account with a one-time signature.
              After this you can deposit, withdraw, and trade with zero gas fees.
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
                : "Activate Base Trading Account"}
            </button>
          </div>
        ) : (
          <>
            {/* Amount input */}
            <div>
              <div className="relative rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
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
                      className="w-full bg-transparent text-[var(--text)] font-semibold text-3xl focus:outline-none"
                    />
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">
                      {tab === "deposit" ? "Deposit" : "Withdraw"} on {chainLabel(chain)}
                    </p>
                  </div>
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setAssetMenuOpen((open) => !open);
                        setAssetSearch("");
                      }}
                      disabled={isPending || isDone}
                      className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm font-semibold text-[var(--text)] hover:border-[var(--accent)] disabled:opacity-40"
                    >
                      <TokenIcon token={token} className="h-5 w-5" />
                      <span>{meta.label}</span>
                      <span className="text-[var(--text-secondary)]">⌄</span>
                    </button>
                    {assetMenuOpen && (
                      <div
                        className="absolute right-0 top-full z-10 mt-2 w-64 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg)] shadow-xl"
                        onWheel={(e) => e.stopPropagation()}
                      >
                        <div className="border-b border-[var(--border)] p-2">
                          <input
                            type="text"
                            value={assetSearch}
                            onChange={(e) => setAssetSearch(e.target.value)}
                            placeholder="Search asset"
                            autoFocus
                            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-secondary)] focus:border-[var(--accent)] focus:outline-none"
                          />
                        </div>
                        <div className="max-h-56 overflow-y-auto overscroll-contain">
                          {filteredAssetTokens.map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => {
                                setToken(t);
                                setAmountStr("");
                                setError(null);
                                setStatus("idle");
                                setTxHash(null);
                                setTxChain(null);
                                setAssetMenuOpen(false);
                                setAssetSearch("");
                              }}
                              className={`flex w-full items-center gap-3 px-3 py-3 text-left transition-colors ${
                                token === t
                                  ? "bg-[var(--accent)]/10"
                                  : "hover:bg-[var(--surface)]"
                              }`}
                            >
                              <TokenIcon token={t} className="h-6 w-6" />
                              <span className="min-w-0 flex-1">
                                <span className="block text-sm font-semibold text-[var(--text)]">
                                  {TOKEN_META[t].label}
                                </span>
                                <span className="block text-xs font-mono text-[var(--text-secondary)]">
                                  {formatTokenBalance(t)}
                                </span>
                              </span>
                            </button>
                          ))}
                          {filteredAssetTokens.length === 0 && (
                            <p className="px-3 py-4 text-sm text-[var(--text-secondary)]">
                              No assets found.
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="text-xs text-[var(--text-secondary)]">
                    Balance {formatTokenBalance(token)}
                  </p>
                  <button
                    onClick={handleMax}
                    disabled={
                      isPending || isDone || maxSpendableBalance <= 0
                    }
                    className="text-xs font-semibold text-[var(--accent)] hover:opacity-80 transition-opacity disabled:opacity-40"
                  >
                    Max
                  </button>
                </div>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-1.5">
                {tab === "deposit"
                  ? `From ${selectedWallet?.name ?? "wallet"}`
                  : `To ${selectedWallet?.name ?? "wallet"}`}
              </p>
              {token === "sol" && (
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  Leaving 0.005 SOL for network fees.
                </p>
              )}
              {chain === "solana" && token === "usdc" && (
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  Solana USDC transactions need a little SOL for network fees.
                </p>
              )}
              {chain === "solana" && token === "tslax" && !SOLANA_TSLAX_MINT && (
                <p className="text-xs text-amber-400 mt-1">
                  TSLAx mint is not configured in this deployment.
                </p>
              )}
            </div>

            {/* Withdraw gas note */}
            {tab === "withdraw" && selectedWalletAddress && (
              <p className="text-xs text-[var(--text-secondary)]">
                Withdraw to {truncate(selectedWalletAddress)}.
                {chain === "base" ? " Gas is sponsored." : ""}
              </p>
            )}

            {error && (
              <p className="text-sm text-[var(--danger)]">{error}</p>
            )}

            {isDone ? (
              <div className="space-y-3">
                <p className="text-sm text-center text-[var(--accent)] font-semibold">
                  {tab === "deposit"
                    ? "Deposit confirmed."
                    : "Withdrawal confirmed."}
                </p>
                {txHash && txChain && (
                  <a
                    href={
                      txChain === "solana"
                        ? solanaTxUrl(txHash)
                        : `${CHAIN.blockExplorers?.default.url}/tx/${txHash}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-center text-sm text-[var(--accent)] hover:underline"
                  >
                    View transaction ↗
                  </a>
                )}
                <p className="text-center text-xs text-[var(--text-secondary)]">
                  Balance can take a few seconds to refresh.
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
                    ? `Deposit ${meta.label}`
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
