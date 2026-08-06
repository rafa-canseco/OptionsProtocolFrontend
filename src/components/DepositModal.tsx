"use client";

import { useState, useCallback, useMemo } from "react";
import { encodeFunctionData, formatUnits, parseUnits, type Address } from "viem";
import { useLogin, usePrivy, type WalletListEntry } from "@privy-io/react-auth";
import { useWallet, type ExternalWallet } from "@/hooks/useWallet";
import { useBalances } from "@/hooks/useBalances";
import { useB1naryAccount } from "@/hooks/useB1naryAccount";
import { publicClient, ADDRESSES, CHAIN, ERC20_ABI } from "@/lib/contracts";
import { useAppPreferences } from "@/lib/preferences";
import { invalidateData } from "@/lib/dataInvalidation";
import {
  buildDyneroxCheckoutUrl,
  getDyneroxCheckoutConfig,
} from "@/lib/dyneroxCheckout";

type Tab = "deposit" | "withdraw";
type FundingMethod = "crypto" | "bank";
type Token = "usdc" | "eth" | "weth" | "btc";

interface TokenConfig {
  label: string;
  icon: string;
  decimals: number;
}

const TOKEN_META: Record<Token, TokenConfig> = {
  usdc: { label: "USDC", icon: "/usdc.svg", decimals: 6 },
  eth: { label: "ETH", icon: "/eth.png", decimals: 18 },
  weth: { label: "WETH", icon: "/weth.png", decimals: 18 },
  btc: { label: "cbBTC", icon: "/cbbtc.webp", decimals: 8 },
};

const BASE_TOKENS: Token[] = ["usdc", "eth", "weth", "btc"];

function normalizeRequiredToken(requiredToken?: string): Token {
  return BASE_TOKENS.find((token) => token === requiredToken) ?? "usdc";
}

interface Props {
  onClose: () => void;
  requiredToken?: string;
  onComplete?: () => void;
}

function refetchBalancesSoon() {
  invalidateData(["balances"], "funding-balance-changed");
}

function TokenIcon({
  token,
  className,
}: {
  token: Token;
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
    </span>
  );
}

function translateDepositError(message: string): string {
  const translations: Array<[string, string]> = [
    ["Enter an amount", "Ingresa un monto"],
    ["Invalid amount", "Monto inválido"],
    ["Amount exceeds available balance", "El monto supera el saldo disponible"],
    ["Wallet not ready. Please reconnect", "La wallet no está lista. Vuelve a conectarla"],
    ["Wallet not connected", "Wallet no conectada"],
    ["Smart wallet not ready", "La wallet inteligente no está lista"],
    ["Transaction failed", "La transacción falló"],
    ["Insufficient", "Saldo insuficiente de"],
    ["is not configured", "no está configurado"],
  ];
  return translations.reduce((result, [english, spanish]) => result.replace(english, spanish), message);
}

function translateDepositProgress(message: string): string {
  const translations: Array<[string, string]> = [
    ["Preparing transfer", "Preparando transferencia"],
    ["Preparing withdrawal", "Preparando retiro"],
    ["Withdrawal confirmed", "Retiro confirmado"],
    ["Withdrawing USDC from Base", "Retirando USDC de Base"],
  ];
  return translations.reduce((result, [english, spanish]) => result.replace(english, spanish), message);
}

export function DepositModal({ onClose, requiredToken, onComplete }: Props) {
  const { locale } = useAppPreferences();
  const translate = (en: string, es: string) => locale === "es" ? es : en;
  const { authenticated } = usePrivy();
  const { login } = useLogin();
  const {
    address,
    fundingAddress,
    externalWallets: rawExternalWallets,
    sendBatchTx,
    sendFundingTx,
    activateSmartWallet,
    connectFundingWallet,
    disconnect,
  } = useWallet();
  const externalWallets = useMemo(
    () => rawExternalWallets.filter((wallet) => wallet.chain === "base"),
    [rawExternalWallets],
  );
  const [tab, setTab] = useState<Tab>("deposit");
  const [fundingMethod, setFundingMethod] = useState<FundingMethod>("crypto");
  const dyneroxConfig = getDyneroxCheckoutConfig();
  const selectedWallet: ExternalWallet | null = externalWallets[0] ?? null;
  const [token, setToken] = useState<Token>(() =>
    normalizeRequiredToken(requiredToken),
  );

  const { wallets: b1naryWallets } = useB1naryAccount({
    autoSyncTrustedWallets: false,
  });
  const b1naryBaseTradingAddresses = b1naryWallets
    .filter((wallet) =>
      wallet.role === "trading" &&
      wallet.verified_at &&
      wallet.chain === "base" &&
      wallet.wallet_type === "smart",
    )
    .map((wallet) => wallet.address as Address);

  const smartBalances = useBalances(
    b1naryBaseTradingAddresses.length > 0
      ? b1naryBaseTradingAddresses
      : address,
  );
  const selectedBaseAddress = selectedWallet?.address as Address | undefined;
  const eoaBalances = useBalances(selectedBaseAddress ?? fundingAddress);
  const [amountStr, setAmountStr] = useState("");
  const [status, setStatus] = useState<
    "idle" | "pending" | "done" | "activating"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [tokenMenuOpen, setTokenMenuOpen] = useState(false);
  const [progressMessage, setProgressMessage] = useState("Preparing transfer...");

  const meta = TOKEN_META[token];
  const availableTokens = BASE_TOKENS;

  // --- Available balance for deposit/withdraw ---

  const getRawBalance = useCallback((asset: Token): bigint => {
    const balances = tab === "deposit" ? eoaBalances : smartBalances;
    if (asset === "usdc") return balances.usdRaw;
    if (asset === "eth") return balances.ethRaw;
    if (asset === "weth") return balances.wethRaw;
    if (asset === "btc") return balances.wbtcRaw;
    return BigInt(0);
  }, [eoaBalances, smartBalances, tab]);

  const getSpendableRaw = getRawBalance;

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
    const walletChainType = "ethereum-only";
    const walletList: WalletListEntry[] = [
      "detected_ethereum_wallets",
      "metamask",
      "coinbase_wallet",
      "rainbow",
      "wallet_connect",
    ];
    if (!authenticated) {
      login({
        loginMethods: ["wallet"],
        walletChainType,
      });
      return;
    }
    connectFundingWallet({
      walletList,
      walletChainType,
      description: "Choose the Base wallet you want to use for deposits and withdrawals.",
    });
  }, [authenticated, connectFundingWallet, login]);

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
    setProgressMessage("Preparing transfer...");
    setTokenMenuOpen(false);
  }, []);

  const parseAmount = useCallback((): bigint | null => {
    try {
      const amount = parseUnits(amountStr, meta.decimals);
      if (amount === BigInt(0)) {
        setError("Enter an amount.");
        return null;
      }
      if (amount > maxSpendableRaw) {
        setError("Amount exceeds available balance.");
        return null;
      }
      return amount;
    } catch (err) {
      console.error("[DepositModal] parseUnits failed:", err);
      setError("Invalid amount.");
      return null;
    }
  }, [amountStr, maxSpendableRaw, meta.decimals]);

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

  const handleDeposit = handleBaseDeposit;
  const needsWallet = !selectedWallet;

  const handleActivate = useCallback(async () => {
    setError(null);
    setStatus("activating");
    try {
      await activateSmartWallet();
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
  }, [activateSmartWallet]);

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
    setProgressMessage("Preparing withdrawal...");
    setTxHash(null);
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
      let hash: `0x${string}` | null = null;

      if (token === "usdc") {
        setProgressMessage("Withdrawing USDC from Base...");
        const result = await sendBatchTx([
          {
            to: ADDRESSES.usdc,
            data: encodeFunctionData({
              abi: ERC20_ABI,
              functionName: "transfer",
              args: [baseWithdrawAddr, amount],
            }),
          },
        ]);
        if (typeof result !== "string" || !result.startsWith("0x")) {
          throw new Error("Unexpected response from smart wallet");
        }
        hash = result as `0x${string}`;
        await publicClient.waitForTransactionReceipt({ hash });
      } else {
        setProgressMessage(`Withdrawing ${meta.label} from Base...`);
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
        hash = result as `0x${string}`;
        await publicClient.waitForTransactionReceipt({ hash });
      }

      if (hash) {
        setTxHash(hash);
      }
      setStatus("done");
      setProgressMessage("Withdrawal confirmed.");
      refetchBalancesSoon();
    } catch (err) {
      console.error("[DepositModal] withdraw failed:", err);
      setError(
        err instanceof Error ? err.message : "Transaction failed.",
      );
      setStatus("idle");
      setProgressMessage("Preparing transfer...");
    }
  }, [
    address, selectedWallet, parseAmount,
    token, sendBatchTx, meta.label,
  ]);

  const handleWithdraw = handleBaseWithdraw;

  const isPending = status === "pending" || status === "activating";
  const isDone = status === "done";
  const displayError = locale === "es" && error ? translateDepositError(error) : error;
  const displayProgress = locale === "es" ? translateDepositProgress(progressMessage) : progressMessage;
  const dyneroxCheckoutUrl = dyneroxConfig
    ? buildDyneroxCheckoutUrl(
        dyneroxConfig,
        tab === "deposit" ? "on-ramp" : "off-ramp",
      )
    : null;

  const openDyneroxCheckout = () => {
    if (isPending || !dyneroxCheckoutUrl) return;
    window.open(dyneroxCheckoutUrl, "_blank", "noopener,noreferrer");
  };

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
            {tab === "deposit" ? translate("Deposit", "Depositar") : translate("Withdraw", "Retirar")}
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
                setTokenMenuOpen(false);
              }}
              disabled={isPending}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors capitalize ${
                tab === t
                  ? "bg-[var(--bg)] text-[var(--text)] shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-[var(--text)]"
              } disabled:opacity-40`}
            >
              {locale === "es" ? (t === "deposit" ? "Depositar" : "Retirar") : t}
            </button>
          ))}
        </div>

        {dyneroxConfig && (
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-[var(--surface)] p-1">
            {(["crypto", "bank"] as FundingMethod[]).map((method) => (
              <button
                key={method}
                type="button"
                onClick={() => {
                  if (isPending) return;
                  setFundingMethod(method);
                  setTokenMenuOpen(false);
                }}
                disabled={isPending}
                className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  fundingMethod === method
                    ? "bg-[var(--bg)] text-[var(--text)] shadow-sm"
                    : "text-[var(--text-secondary)] hover:text-[var(--text)]"
                }`}
              >
                {method === "crypto"
                  ? translate("Crypto transfer", "Transferencia cripto")
                  : translate("Bank transfer (MXN)", "Transferencia bancaria (MXN)")}
              </button>
            ))}
          </div>
        )}

        {fundingMethod === "bank" && dyneroxConfig ? (
          <div className="space-y-4 rounded-xl border border-amber-400/30 bg-amber-400/5 px-4 py-4">
            <div>
              <p className="text-base font-semibold text-[var(--text)]">
                {tab === "deposit"
                  ? translate("MXN bank transfer to USDC", "Transferencia bancaria MXN a USDC")
                  : translate("USDC to an MXN bank account", "USDC a una cuenta bancaria MXN")}
              </p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                {tab === "deposit"
                  ? translate("Dynerox will guide you through creating a permanent SPEI on-ramp route.", "Dynerox te guiará para crear una ruta permanente de entrada por SPEI.")
                  : translate("Dynerox will guide you through creating a permanent off-ramp route to SPEI.", "Dynerox te guiará para crear una ruta permanente de salida hacia SPEI.")}
              </p>
            </div>

            <div className="rounded-lg border border-amber-400/30 bg-[var(--bg)] px-3 py-3 text-xs text-[var(--text-secondary)]">
              <p className="font-semibold text-amber-400">
                {translate("Stage preview · Ethereum only", "Vista previa de stage · Solo Ethereum")}
              </p>
              <p className="mt-1">
                {translate(
                  "Base is not enabled by Dynerox yet. This preview opens Dynerox on Ethereum and does not track completion in b1nary.",
                  "Dynerox aún no habilita Base. Esta vista previa abre Dynerox en Ethereum y no registra la finalización en b1nary.",
                )}
              </p>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-3 text-sm">
              <span className="font-semibold text-[var(--text)]">
                {tab === "deposit" ? "MXN · SPEI" : "USDC · Ethereum"}
              </span>
              <span aria-hidden="true" className="text-[var(--text-secondary)]">→</span>
              <span className="font-semibold text-[var(--text)]">
                {tab === "deposit" ? "USDC · Ethereum" : "MXN · SPEI"}
              </span>
            </div>

            <button
              type="button"
              onClick={openDyneroxCheckout}
              disabled={isPending}
              className="w-full rounded-xl bg-[var(--accent)] py-3 text-sm font-semibold text-[var(--bg)] transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {translate("Continue to Dynerox ↗", "Continuar a Dynerox ↗")}
            </button>
            <p className="text-center text-xs text-[var(--text-secondary)]">
              {translate("Opens the Dynerox stage Checkout in a new tab.", "Abre el Checkout de stage de Dynerox en una pestaña nueva.")}
            </p>
          </div>
        ) : (
          <>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-base font-semibold text-[var(--text)]">
                {translate("Transfer Crypto", "Transferir cripto")}
              </p>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                {tab === "deposit" ? translate("From your wallet to trading", "De tu wallet a operaciones") : translate("From trading to your wallet", "De operaciones a tu wallet")}
              </p>
            </div>
            <span className="text-xs text-[var(--text-secondary)]">{translate("No limit", "Sin límite")}</span>
          </div>
          <div className="mt-4">
            <div className="relative space-y-1.5">
              <span className="text-xs font-semibold text-[var(--text)]">Token</span>
              <button
                type="button"
                aria-label={`Token ${meta.label}`}
                onClick={() => setTokenMenuOpen((open) => !open)}
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
          </div>
        </div>

        {!selectedWallet && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-[var(--text)]">
                  {translate("No Base wallet connected", "No hay una wallet de Base conectada")}
                </p>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  {tab === "deposit"
                    ? translate("Connect the wallet you want to deposit from.", "Conecta la wallet desde la que quieres depositar.")
                    : translate("Connect the wallet you want to withdraw to.", "Conecta la wallet a la que quieres retirar.")}
                </p>
              </div>
              <button
                type="button"
                onClick={handleConnectWallet}
                disabled={isPending}
                className="w-full rounded-xl bg-[var(--accent)] py-3 text-sm font-semibold text-[var(--bg)] hover:bg-[var(--accent-hover)] disabled:opacity-40 transition-colors"
              >
                {translate("Connect Base wallet", "Conectar wallet de Base")}
              </button>
            </div>
          </div>
        )}

        {/* Base activation gate — show activate button instead of deposit/withdraw UI */}
        {needsWallet ? (
          null
        ) : needsBaseActivation ? (
          <div className="space-y-3">
            <p className="text-sm text-[var(--text-secondary)]">
              {translate(
                "Activate your Base trading account with a one-time signature. After this you can deposit, withdraw, and trade with zero gas fees.",
                "Activa tu cuenta de operaciones en Base con una sola firma. Después podrás depositar, retirar y operar sin pagar gas.",
              )}
            </p>
            {displayError && (
              <p className="text-sm text-[var(--danger)]">{displayError}</p>
            )}
            <button
              onClick={handleActivate}
              disabled={isPending}
              className="w-full rounded-xl bg-[var(--accent)] py-3 text-sm font-semibold text-[var(--bg)] hover:bg-[var(--accent-hover)] disabled:opacity-40 transition-colors"
            >
              {status === "activating"
                ? translate("Activating...", "Activando...")
                : translate("Activate Base Trading Account", "Activar cuenta de operaciones en Base")}
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
                      {tab === "deposit" ? translate("Deposit on Base", "Depositar en Base") : translate("Withdraw on Base", "Retirar en Base")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm font-semibold text-[var(--text)]">
                    <TokenIcon token={token} className="h-5 w-5" />
                    <span>{meta.label}</span>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="text-xs text-[var(--text-secondary)]">
                    {translate("Balance", "Saldo")} {formatTokenBalance(token)}
                  </p>
                  <button
                    onClick={handleMax}
                    disabled={
                      isPending || isDone || maxSpendableBalance <= 0
                    }
                    className="text-xs font-semibold text-[var(--accent)] hover:opacity-80 transition-opacity disabled:opacity-40"
                  >
                    {translate("Max", "Máx")}
                  </button>
                </div>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-1.5">
                {tab === "deposit"
                  ? `From ${selectedWallet?.name ?? "wallet"}`
                  : `To ${selectedWallet?.name ?? "wallet"}`}
              </p>
            </div>

            {displayError && (
              <p className="text-sm text-[var(--danger)]">{displayError}</p>
            )}

            {isPending && status !== "activating" && (
              <div className="rounded-xl border border-[var(--accent)]/25 bg-[var(--accent)]/5 px-3 py-2">
                <div className="flex items-center gap-2 text-sm font-medium text-[var(--text)]">
                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent)] opacity-50" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />
                  </span>
                  <span>{displayProgress}</span>
                </div>
                <p className="mt-1 pl-4 text-xs text-[var(--text-secondary)]">
                  {translate("This can take a few moments.", "Esto puede tardar unos momentos.")}
                </p>
              </div>
            )}

            {isDone ? (
              <div className="space-y-3">
                <p className="text-sm text-center text-[var(--accent)] font-semibold">
                  {tab === "deposit"
                    ? translate("Deposit confirmed.", "Depósito confirmado.")
                    : translate("Withdrawal confirmed.", "Retiro confirmado.")}
                </p>
                {txHash && (
                  <a
                    href={`${CHAIN.blockExplorers?.default.url}/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-center text-sm text-[var(--accent)] hover:underline"
                  >
                    {translate("View transaction ↗", "Ver transacción ↗")}
                  </a>
                )}
                <p className="text-center text-xs text-[var(--text-secondary)]">
                  {translate("Balance can take a few seconds to refresh.", "El saldo puede tardar unos segundos en actualizarse.")}
                </p>
                <button
                  onClick={onClose}
                  className="w-full rounded-xl bg-[var(--surface)] py-3 text-sm font-semibold text-[var(--text)] hover:bg-[var(--border)] transition-colors"
                >
                  {translate("Close", "Cerrar")}
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
                    ? translate("Depositing...", "Depositando...")
                    : translate("Withdrawing...", "Retirando...")
                  : tab === "deposit"
                    ? `${translate("Deposit", "Depositar")} ${meta.label}`
                    : `${translate("Withdraw", "Retirar")} ${meta.label}`}
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
          {translate("Disconnect wallet", "Desconectar wallet")}
        </button>
          </>
        )}
      </div>
    </div>
  );
}
