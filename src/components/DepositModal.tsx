"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { encodeFunctionData, formatUnits, parseUnits, type Address } from "viem";
import { useLogin, usePrivy, type WalletListEntry } from "@privy-io/react-auth";
import { useWallet, type ExternalWallet } from "@/hooks/useWallet";
import { useBalances } from "@/hooks/useBalances";
import { useSolanaBalance } from "@/hooks/useSolanaBalance";
import { publicClient, ADDRESSES, CHAIN, ERC20_ABI } from "@/lib/contracts";
import { isSolanaOffInProd } from "@/lib/marketState";
import { SOLANA_TSLAX_MINT, solanaTxUrl } from "@/lib/solana";

type Tab = "deposit" | "withdraw";
type Chain = "base" | "solana";
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

const TOKENS_BY_CHAIN: Record<Chain, Token[]> = {
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

function chainLabel(chain: Chain): string {
  return chain === "base" ? "Base" : "Solana";
}

function chainIcon(chain: Chain): string {
  return chain === "base" ? "/base.svg" : "/sol.png";
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
        alt=""
        aria-hidden="true"
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

function ChainIcon({ chain, className }: { chain: Chain; className: string }) {
  return (
    <span className={`inline-flex shrink-0 ${className}`}>
      <img
        src={chainIcon(chain)}
        alt=""
        aria-hidden="true"
        className={`h-full w-full ${chain === "solana" ? "rounded-full" : ""}`}
      />
    </span>
  );
}

export function DepositModal({ onClose, requiredToken, onComplete }: Props) {
  const { authenticated } = usePrivy();
  const { login } = useLogin();
  const {
    address,
    fundingAddress,
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
  const initialChain: Chain =
    !solanaDisabled && (initialToken === "sol" || initialToken === "tslax")
      ? "solana"
      : "base";
  const [activeChain, setActiveChain] = useState<Chain>(initialChain);
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
  const [tokenMenuOpen, setTokenMenuOpen] = useState(false);
  const [chainMenuOpen, setChainMenuOpen] = useState(false);

  const chainWallets = useMemo(
    () => externalWallets.filter((w) => w.chain === activeChain),
    [activeChain, externalWallets],
  );

  // Keep the selected external wallet scoped to the chosen network.
  useEffect(() => {
    if (selectedWallet?.chain === activeChain) return;
    setSelectedWallet(chainWallets[0] ?? null);
  }, [activeChain, chainWallets, selectedWallet]);

  useEffect(() => {
    const available = TOKENS_BY_CHAIN[activeChain];
    if (!available.includes(token)) {
      setToken(available[0]);
      setAmountStr("");
    }
  }, [activeChain, token]);

  const chain = activeChain;
  const meta = TOKEN_META[token];
  const availableTokens = TOKENS_BY_CHAIN[chain];
  const availableChains: Chain[] = solanaDisabled ? ["base"] : ["base", "solana"];

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
    const walletChainType = chain === "base" ? "ethereum-only" : "solana-only";
    const walletList: WalletListEntry[] = chain === "base"
      ? [
          "detected_ethereum_wallets",
          "metamask",
          "coinbase_wallet",
          "rainbow",
          "wallet_connect",
        ]
      : [
          "detected_solana_wallets",
          "phantom",
        ];
    if (!authenticated) {
      login({
        loginMethods: ["wallet"],
        walletChainType,
      });
      return;
    }
    connectWallet({
      walletList,
      walletChainType,
      description: `Choose the ${chainLabel(chain)} wallet you want to use for deposits and withdrawals.`,
    });
  }, [authenticated, chain, connectWallet, login]);

  const handleMax = useCallback(() => {
    if (maxSpendableRaw > BigInt(0)) {
      setAmountStr(formatUnits(maxSpendableRaw, meta.decimals));
    }
  }, [maxSpendableRaw, meta.decimals]);

  const needsBaseActivation = !address;

  const selectToken = useCallback((nextToken: Token) => {
    setToken(nextToken);
    setAmountStr("");
    setError(null);
    setStatus("idle");
    setTxHash(null);
    setTxChain(null);
    setTokenMenuOpen(false);
  }, []);

  const selectChain = useCallback((nextChain: Chain) => {
    setActiveChain(nextChain);
    setAmountStr("");
    setError(null);
    setStatus("idle");
    setTxHash(null);
    setTxChain(null);
    setChainMenuOpen(false);
    setTokenMenuOpen(false);
    setToken((currentToken) =>
      TOKENS_BY_CHAIN[nextChain].includes(currentToken)
        ? currentToken
        : TOKENS_BY_CHAIN[nextChain][0],
    );
  }, []);

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
    if (!address || !selectedWallet || selectedWallet.chain !== "base") {
      setError("Wallet not ready. Please reconnect.");
      return;
    }
    const amount = parseAmount();
    if (amount == null) return;

    setError(null);
    setStatus("pending");
    setTxHash(null);
    setTxChain(null);
    const BASE_DEPOSIT_TOKEN_ADDRESS: Partial<Record<Token, Address>> = {
      usdc: ADDRESSES.usdc,
      weth: ADDRESSES.weth,
      btc: ADDRESSES.wbtc,
    };

    try {
      let hash: `0x${string}`;
      if (token === "eth") {
        hash = await sendFundingTx({
          to: address,
          data: "0x",
          value: amount,
        }, selectedWallet.address);
      } else {
        const tokenAddress = BASE_DEPOSIT_TOKEN_ADDRESS[token];
        if (!tokenAddress) {
          setError(`Unsupported token for Base deposit: ${token}`);
          setStatus("idle");
          return;
        }
        hash = await sendFundingTx({
          to: tokenAddress,
          data: encodeFunctionData({
            abi: ERC20_ABI,
            functionName: "transfer",
            args: [address, amount],
          }),
        }, selectedWallet.address);
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
    address, selectedWallet, parseAmount,
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
    const BASE_WITHDRAW_TOKEN_ADDRESS: Partial<Record<Token, Address | null>> = {
      usdc: ADDRESSES.usdc,
      eth: null,
      weth: ADDRESSES.weth,
      btc: ADDRESSES.wbtc,
    };

    if (!(token in BASE_WITHDRAW_TOKEN_ADDRESS)) {
      setError(`Unsupported token for Base withdrawal: ${token}`);
      return;
    }
    const tokenAddress = BASE_WITHDRAW_TOKEN_ADDRESS[token];

    try {
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
        <div className="relative text-center">
          <h2 className="text-2xl font-semibold text-[var(--text)]">
            {tab === "deposit" ? "Deposit" : "Withdraw"}
          </h2>
          <button
            onClick={onClose}
            disabled={isPending}
            className="absolute right-0 top-0 text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors disabled:opacity-40 text-2xl leading-none"
          >
            &times;
          </button>
        </div>

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

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-base font-semibold text-[var(--text)]">
                Transfer Crypto
              </p>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                {tab === "deposit" ? "From your wallet to trading" : "From trading to your wallet"}
              </p>
            </div>
            <span className="text-xs text-[var(--text-secondary)]">No limit</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="relative space-y-1.5">
              <span className="text-xs font-semibold text-[var(--text)]">Token</span>
              <button
                type="button"
                aria-label={`Token ${meta.label}`}
                onClick={() => {
                  setTokenMenuOpen((open) => !open);
                  setChainMenuOpen(false);
                }}
                disabled={isPending || isDone}
                className="flex h-12 w-full items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-sm font-semibold text-[var(--text)] hover:border-[var(--accent)] focus:border-[var(--accent)] focus:outline-none disabled:opacity-40"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <TokenIcon token={token} className="h-6 w-6" />
                  <span className="truncate">{meta.label}</span>
                </span>
                <span className="text-[var(--text-secondary)]">⌄</span>
              </button>
              {tokenMenuOpen && (
                <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg)] shadow-xl">
                  {availableTokens.map((asset) => (
                    <button
                      key={asset}
                      type="button"
                      onClick={() => selectToken(asset)}
                      className={`flex w-full items-center gap-2 px-3 py-3 text-left text-sm ${
                        token === asset
                          ? "bg-[var(--accent)]/10"
                          : "hover:bg-[var(--surface)]"
                      }`}
                    >
                      <TokenIcon token={asset} className="h-5 w-5" />
                      <span className="font-semibold text-[var(--text)]">
                        {TOKEN_META[asset].label}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="relative space-y-1.5">
              <span className="text-xs font-semibold text-[var(--text)]">Network</span>
              <button
                type="button"
                aria-label={`Network ${chainLabel(activeChain)}`}
                onClick={() => {
                  setChainMenuOpen((open) => !open);
                  setTokenMenuOpen(false);
                }}
                disabled={isPending || isDone}
                className="flex h-12 w-full items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-sm font-semibold text-[var(--text)] hover:border-[var(--accent)] focus:border-[var(--accent)] focus:outline-none disabled:opacity-40"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <ChainIcon chain={activeChain} className="h-6 w-6" />
                  <span className="truncate">{chainLabel(activeChain)}</span>
                </span>
                <span className="text-[var(--text-secondary)]">⌄</span>
              </button>
              {chainMenuOpen && (
                <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg)] shadow-xl">
                  {availableChains.map((network) => (
                    <button
                      key={network}
                      type="button"
                      onClick={() => selectChain(network)}
                      className={`flex w-full items-center gap-2 px-3 py-3 text-left text-sm ${
                        activeChain === network
                          ? "bg-[var(--accent)]/10"
                          : "hover:bg-[var(--surface)]"
                      }`}
                    >
                      <ChainIcon chain={network} className="h-5 w-5" />
                      <span className="font-semibold text-[var(--text)]">
                        {chainLabel(network)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Contextual external wallet */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          {selectedWallet ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[var(--text-secondary)]">
                    {tab === "deposit" ? "From" : "To"}
                  </p>
                  <p className="mt-0.5 truncate font-mono text-sm font-semibold text-[var(--text)]">
                    {truncate(selectedWallet.address)}
                    <span className="ml-2 font-sans text-xs font-medium text-[var(--text-secondary)]">
                      {selectedWallet.name} · {chainLabel(chain)} wallet
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleConnectWallet}
                  disabled={isPending}
                  className="shrink-0 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-40"
                >
                  Connect
                </button>
              </div>
              {chainWallets.length > 1 && (
                <div className="grid gap-2">
                  {chainWallets.map((wallet) => {
                    const selected =
                      wallet.address.toLowerCase() ===
                      selectedWallet.address.toLowerCase();
                    return (
                      <button
                        key={`${wallet.chain}-${wallet.address}`}
                        type="button"
                        onClick={() => setSelectedWallet(wallet)}
                        disabled={isPending}
                        className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors disabled:opacity-40 ${
                          selected
                            ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--text)]"
                            : "border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--text)]"
                        }`}
                      >
                        <span className="text-xs font-semibold">{wallet.name}</span>
                        <span className="font-mono text-xs">{truncate(wallet.address)}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-[var(--text)]">
                  No {chainLabel(chain)} wallet connected
                </p>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  {tab === "deposit"
                    ? "Connect the wallet you want to deposit from."
                    : "Connect the wallet you want to withdraw to."}
                </p>
              </div>
              <button
                type="button"
                onClick={handleConnectWallet}
                disabled={isPending}
                className="w-full rounded-xl bg-[var(--accent)] py-3 text-sm font-semibold text-[var(--bg)] hover:bg-[var(--accent-hover)] disabled:opacity-40 transition-colors"
              >
                Connect {chainLabel(chain)} wallet
              </button>
            </div>
          )}
        </div>

        {/* Base activation gate — show activate button instead of deposit/withdraw UI */}
        {needsWallet ? (
          null
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
                  <div className="flex shrink-0 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm font-semibold text-[var(--text)]">
                    <TokenIcon token={token} className="h-5 w-5" />
                    <span>{meta.label}</span>
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
              {chain === "solana" && token === "tslax" && !SOLANA_TSLAX_MINT && (
                <p className="text-xs text-amber-400 mt-1">
                  TSLAx mint is not configured in this deployment.
                </p>
              )}
            </div>

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
              onClose();
            } catch (err) {
              console.error("[DepositModal] disconnect failed:", err);
            }
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
