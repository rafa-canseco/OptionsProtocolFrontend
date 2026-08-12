"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { encodeFunctionData, formatUnits, parseUnits, type Address } from "viem";
import { useLogin, usePrivy, type WalletListEntry } from "@privy-io/react-auth";
import { useWallet, type BatchCall, type ExternalWallet } from "@/hooks/useWallet";
import { useBalances } from "@/hooks/useBalances";
import { useSolanaBalance } from "@/hooks/useSolanaBalance";
import { useB1naryAccount } from "@/hooks/useB1naryAccount";
import { publicClient, ADDRESSES, CHAIN, ERC20_ABI } from "@/lib/contracts";
import {
  buildEvmBurnCalls,
  DOMAIN_BASE,
  DOMAIN_SOLANA,
  getFastCctpMaxFee,
  getSolanaUsdcTokenAccount,
  solanaToBytes32,
} from "@/lib/cctp";
import { isSolanaOffInProd } from "@/lib/marketState";
import { SOLANA_TSLAX_MINT, solanaConnection, solanaTxUrl, toPublicKey } from "@/lib/solana";
import { api, type BridgeJob, type BridgeJobStatus } from "@/lib/api";
import { useAppPreferences } from "@/lib/preferences";
import { invalidateData } from "@/lib/dataInvalidation";
import {
  buildDyneroxCheckoutUrl,
  getDyneroxCheckoutConfig,
} from "@/lib/dyneroxCheckout";

type Tab = "deposit" | "withdraw";
type FundingMethod = "crypto" | "bank";
type Chain = "base" | "solana";
type Token = "usdc" | "eth" | "weth" | "btc" | "sol" | "wsol" | "tslax";
type AccountBalanceToken = Token;

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

const SOLANA_WITHDRAW_TOKENS: Token[] = ["usdc", "sol", "wsol", "tslax"];

function tokensFor(chain: Chain, tab: Tab): Token[] {
  if (chain === "solana" && tab === "withdraw") {
    return SOLANA_WITHDRAW_TOKENS;
  }
  return TOKENS_BY_CHAIN[chain];
}

const SOL_FEE_RESERVE_LAMPORTS = BigInt(5_000_000);
const BRIDGE_POLL_INTERVAL_MS = 2_000;
const BRIDGE_MAX_POLL_ATTEMPTS = 180;
const BRIDGE_TERMINAL_STATUSES: BridgeJobStatus[] = [
  "completed",
  "failed",
  "mint_completed",
  "mint_completed_trade_failed",
];

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
  invalidateData(["balances"], "funding-balance-changed");
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

async function pollBridgeJob(
  jobId: string,
  setProgressMessage: (message: string) => void,
): Promise<BridgeJob> {
  let lastStatus: BridgeJobStatus | null = null;

  for (let i = 0; i < BRIDGE_MAX_POLL_ATTEMPTS; i++) {
    const job = await api.getBridgeStatus(jobId);
    if (job.status !== lastStatus) {
      lastStatus = job.status;
      console.log("[DepositModal] withdrawal bridge status:", jobId, job.status);
      setProgressMessage(bridgeStatusMessage(job));
    }

    if (BRIDGE_TERMINAL_STATUSES.includes(job.status)) {
      return job;
    }

    await new Promise((resolve) => setTimeout(resolve, BRIDGE_POLL_INTERVAL_MS));
  }

  throw new Error(
    "Timed out waiting for bridge completion. Your USDC may still be in transit.",
  );
}

function bridgeStatusMessage(job: BridgeJob): string {
  switch (job.status) {
    case "completed":
    case "mint_completed":
      return `USDC arrived on ${chainLabel(job.dest_chain)}.`;
    case "mint_completed_trade_failed":
      return `USDC arrived on ${chainLabel(job.dest_chain)}.`;
    case "failed":
      return "Bridge failed.";
    default:
      return `Waiting for USDC to arrive on ${chainLabel(job.dest_chain)}...`;
  }
}

async function readSolanaUsdcBalanceRaw(ownerAddress: string): Promise<bigint> {
  if (!solanaConnection) {
    throw new Error("Solana RPC not configured");
  }
  const owner = toPublicKey(ownerAddress, "Solana owner");
  const tokenAccount = await getSolanaUsdcTokenAccount(owner);
  try {
    const balance = await solanaConnection.getTokenAccountBalance(
      tokenAccount,
      "confirmed",
    );
    return BigInt(balance.value.amount);
  } catch {
    return BigInt(0);
  }
}

export function resolveSolanaUsdcWithdrawAmount(
  requestedRaw: bigint,
  availableRaw: bigint,
): bigint {
  return availableRaw < requestedRaw ? availableRaw : requestedRaw;
}

async function bridgeBaseUsdcToSolana(
  solanaRecipient: string,
  amount: bigint,
  userId: string,
  sendBatchTx: (calls: BatchCall[]) => Promise<unknown>,
  setProgressMessage: (message: string) => void,
): Promise<BridgeJob> {
  const solanaRecipientPk = toPublicKey(solanaRecipient, "Solana recipient");
  setProgressMessage("Resolving Solana USDC account...");
  const solanaUsdcAccount = await getSolanaUsdcTokenAccount(solanaRecipientPk);
  const recipient = solanaToBytes32(solanaUsdcAccount);
  setProgressMessage("Checking bridge fee...");
  const maxFee = await getFastCctpMaxFee(DOMAIN_BASE, DOMAIN_SOLANA, amount);
  const burnCalls = buildEvmBurnCalls(amount, recipient, maxFee);

  setProgressMessage("Sending USDC from Base to Solana...");
  const burnTxHash = (await sendBatchTx(burnCalls)) as string;
  if (!burnTxHash || !burnTxHash.startsWith("0x")) {
    throw new Error("Base bridge transaction did not return a hash.");
  }
  console.log("[DepositModal] Base withdrawal bridge burn tx:", burnTxHash);

  setProgressMessage("Starting bridge confirmation...");
  const { job_id: jobId } = await api.bridgeAndTrade({
    burnTxHash,
    signedTradeTx: null,
    quoteId: null,
    sourceChain: "base",
    destChain: "solana",
    userId,
    mintRecipient: solanaUsdcAccount.toBase58(),
    burnAmount: amount.toString(),
  });
  console.log("[DepositModal] Base withdrawal bridge job:", jobId);

  setProgressMessage("Waiting for USDC to arrive on Solana...");
  const job = await pollBridgeJob(jobId, setProgressMessage);
  if (job.status === "failed") {
    throw new Error(job.error_message ?? "Bridge failed.");
  }
  return job;
}

async function bridgeSolanaUsdcToBase(
  solanaOwner: string,
  baseRecipient: Address,
  amount: bigint,
  userId: string,
  signSolanaTransaction: (serializedTx: Uint8Array) => Promise<Uint8Array>,
  setProgressMessage: (message: string) => void,
): Promise<BridgeJob> {
  setProgressMessage("Preparing sponsored Solana transfer...");
  const preparedBurn = await api.prepareSolanaCctpBurn({
    owner: solanaOwner,
    destChain: "base",
    mintRecipient: baseRecipient,
    burnAmount: amount.toString(),
    maxFee: "0",
    minFinalityThreshold: 2000,
  });

  setProgressMessage("Confirming Solana transfer...");
  const signedBurnBytes = await signSolanaTransaction(
    new Uint8Array(Buffer.from(preparedBurn.transaction_base64, "base64")),
  );

  setProgressMessage("Sending USDC to Base...");
  const { job_id: jobId } = await api.submitSolanaCctpBurn({
    signedTransactionBase64: Buffer.from(signedBurnBytes).toString("base64"),
    destChain: "base",
    userId,
    mintRecipient: baseRecipient,
    burnAmount: amount.toString(),
    quoteId: `withdraw:${userId}:${Date.now()}`,
    signedTradeTx: null,
  });
  console.log("[DepositModal] Solana withdrawal bridge job:", jobId);

  setProgressMessage("Waiting for USDC to arrive on Base...");
  const job = await pollBridgeJob(jobId, setProgressMessage);
  if (job.status === "failed") {
    throw new Error(job.error_message ?? "Bridge failed.");
  }
  return job;
}

function translateDepositError(message: string): string {
  const translations: Array<[string, string]> = [
    ["Enter an amount", "Ingresa un monto"],
    ["Invalid amount", "Monto inválido"],
    ["Amount exceeds available balance", "El monto supera el saldo disponible"],
    ["Leave at least 0.005 SOL in your wallet for network fees", "Deja al menos 0.005 SOL en tu wallet para las comisiones de red"],
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
    ["Checking bridge fee", "Revisando comisión del puente"],
    ["Confirming Solana transfer", "Confirmando transferencia en Solana"],
    ["Consolidating USDC on Base", "Consolidando USDC en Base"],
    ["Consolidating USDC on Solana", "Consolidando USDC en Solana"],
    ["Preparing sponsored Solana transfer", "Preparando transferencia patrocinada en Solana"],
    ["Resolving Solana USDC account", "Buscando cuenta USDC en Solana"],
    ["Sending USDC from Base to Solana", "Enviando USDC de Base a Solana"],
    ["Sending USDC to Base", "Enviando USDC a Base"],
    ["Starting bridge confirmation", "Iniciando confirmación del puente"],
    ["Waiting for USDC to arrive on Base", "Esperando que USDC llegue a Base"],
    ["Waiting for USDC to arrive on Solana", "Esperando que USDC llegue a Solana"],
    ["Withdrawal confirmed", "Retiro confirmado"],
    ["Withdrawing USDC from Base", "Retirando USDC de Base"],
    ["Withdrawing USDC from Solana", "Retirando USDC de Solana"],
  ];
  return translations.reduce((result, [english, spanish]) => result.replace(english, spanish), message);
}

export function DepositModal({ onClose, requiredToken, onComplete }: Props) {
  const { locale } = useAppPreferences();
  const translate = (en: string, es: string) => locale === "es" ? es : en;
  const { authenticated, user } = usePrivy();
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
    signSolanaTransaction,
    activateSmartWallet,
    connectFundingWallet,
    disconnect,
  } = useWallet();
  const solanaDisabled = isSolanaOffInProd();
  const externalWallets = solanaDisabled
    ? rawExternalWallets.filter((w) => w.chain !== "solana")
    : rawExternalWallets;
  const [tab, setTab] = useState<Tab>("deposit");
  const [fundingMethod, setFundingMethod] = useState<FundingMethod>("crypto");
  const dyneroxConfig = getDyneroxCheckoutConfig();
  const [selectedWallet, setSelectedWallet] =
    useState<ExternalWallet | null>(null);
  const initialToken: Token =
    requiredToken && !(solanaDisabled && (requiredToken === "sol" || requiredToken === "wsol" || requiredToken === "tslax"))
      ? requiredToken
      : "usdc";
  const initialChain: Chain =
    !solanaDisabled && (initialToken === "sol" || initialToken === "wsol" || initialToken === "tslax")
      ? "solana"
      : "base";
  const [activeChain, setActiveChain] = useState<Chain>(initialChain);
  const [token, setToken] = useState<Token>(initialToken);

  const { wallets: b1naryWallets } = useB1naryAccount({
    autoSyncTrustedWallets: false,
  });
  const b1naryTradingWallets = b1naryWallets.filter((wallet) =>
    wallet.role === "trading" &&
    wallet.verified_at &&
    (wallet.chain !== "base" || wallet.wallet_type === "smart"),
  );
  const b1naryBaseTradingAddresses = b1naryTradingWallets
    .filter((wallet) => wallet.chain === "base")
    .map((wallet) => wallet.address as Address);
  const b1narySolanaTradingAddresses = b1naryTradingWallets
    .filter((wallet) => wallet.chain === "solana")
    .map((wallet) => wallet.address);

  const smartBalances = useBalances(
    b1naryBaseTradingAddresses.length > 0
      ? b1naryBaseTradingAddresses
      : address,
  );
  const selectedBaseAddress =
    selectedWallet?.chain === "base"
      ? (selectedWallet.address as Address)
      : undefined;
  const eoaBalances = useBalances(selectedBaseAddress ?? fundingAddress);
  const solBalance = useSolanaBalance(
    b1narySolanaTradingAddresses.length > 0
      ? b1narySolanaTradingAddresses
      : solanaAddress,
  );
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
  const [progressMessage, setProgressMessage] = useState("Preparing transfer...");

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
    const available = tokensFor(activeChain, tab);
    if (!available.includes(token)) {
      setToken(available[0]);
      setAmountStr("");
    }
  }, [activeChain, tab, token]);

  const chain = activeChain;
  const meta = TOKEN_META[token];
  const availableTokens = tokensFor(chain, tab);
  const availableChains: Chain[] = solanaDisabled ? ["base"] : ["base", "solana"];

  // --- Available balance for deposit/withdraw ---
  const solanaWalletBalance =
    tab === "deposit" ? solExternalBalance : solBalance;

  const getRawBalance = useCallback((asset: Token): bigint => {
    if (tab === "withdraw" && asset === "usdc") {
      return smartBalances.usdRaw + solBalance.solanaUsdcRaw;
    }
    if (chain === "solana") {
      if (asset === "sol") return solanaWalletBalance.solanaSolRaw;
      if (asset === "usdc") return solanaWalletBalance.solanaUsdcRaw;
      if (asset === "wsol") return solanaWalletBalance.solanaWsolRaw;
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
  }, [
    chain,
    eoaBalances,
    smartBalances,
    solBalance.solanaUsdcRaw,
    solanaWalletBalance,
    tab,
  ]);

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
    connectFundingWallet({
      walletList,
      walletChainType,
      description: `Choose the ${chainLabel(chain)} wallet you want to use for deposits and withdrawals.`,
    });
  }, [authenticated, chain, connectFundingWallet, login]);

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
    setProgressMessage("Preparing transfer...");
    setTokenMenuOpen(false);
  }, []);

  const selectChain = useCallback((nextChain: Chain) => {
    const nextTokens = tokensFor(nextChain, tab);
    setActiveChain(nextChain);
    setAmountStr("");
    setError(null);
    setStatus("idle");
    setTxHash(null);
    setTxChain(null);
    setProgressMessage("Preparing transfer...");
    setChainMenuOpen(false);
    setTokenMenuOpen(false);
    setToken((currentToken) =>
      nextTokens.includes(currentToken)
        ? currentToken
        : nextTokens[0],
    );
  }, [tab]);

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
      let hash: `0x${string}` | null = null;
      let bridgeJob: BridgeJob | null = null;

      if (token === "usdc") {
        const bridgeAmount =
          smartBalances.usdRaw >= amount ? BigInt(0) : amount - smartBalances.usdRaw;

        if (bridgeAmount > BigInt(0)) {
          if (!solanaAddress) {
            throw new Error("Solana trading account not ready.");
          }
          if (!user?.id) {
            throw new Error("User session not ready.");
          }
          setProgressMessage("Consolidating USDC on Base...");
          bridgeJob = await bridgeSolanaUsdcToBase(
            solanaAddress,
            address,
            bridgeAmount,
            user.id,
            signSolanaTransaction,
            setProgressMessage,
          );
        }

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

      const finalHash = bridgeJob?.mint_tx_hash ?? hash;
      if (finalHash) {
        setTxHash(finalHash);
        setTxChain(finalHash.startsWith("0x") ? "base" : "solana");
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
    token, sendBatchTx, smartBalances.usdRaw, solanaAddress,
    user, signSolanaTransaction, meta.label,
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
    setProgressMessage("Preparing withdrawal...");
    setTxHash(null);
    setTxChain(null);
    try {
      let signature: string | null = null;
      let bridgeJob: BridgeJob | null = null;

      if (token === "usdc") {
        const bridgeAmount =
          solBalance.solanaUsdcRaw >= amount ? BigInt(0) : amount - solBalance.solanaUsdcRaw;

        if (bridgeAmount > BigInt(0)) {
          if (!solanaAddress) {
            throw new Error("Solana trading account not ready.");
          }
          if (!user?.id) {
            throw new Error("User session not ready.");
          }
          setProgressMessage("Consolidating USDC on Solana...");
          bridgeJob = await bridgeBaseUsdcToSolana(
            solanaAddress,
            bridgeAmount,
            user.id,
            sendBatchTx,
            setProgressMessage,
          );
        }

        setProgressMessage("Withdrawing USDC from Solana...");
        const withdrawAmount =
          bridgeJob && solanaAddress
            ? resolveSolanaUsdcWithdrawAmount(
                amount,
                await readSolanaUsdcBalanceRaw(solanaAddress),
              )
            : amount;
        if (withdrawAmount <= BigInt(0)) {
          throw new Error("USDC arrived on Solana, but no withdrawable balance was found. Check your balance before retrying.");
        }
        signature = await sendSolanaWithdraw(
          selectedWallet.address,
          withdrawAmount,
          "usdc",
        );
      } else {
        setProgressMessage(`Withdrawing ${meta.label} from Solana...`);
        signature = token === "sol"
          ? await sendSolanaSolWithdraw(selectedWallet.address, amount)
          : await sendSolanaWithdraw(
              selectedWallet.address,
              amount,
              token === "tslax" ? "tslax" : token === "wsol" ? "wsol" : "usdc",
            );
      }

      const finalHash = signature ?? bridgeJob?.mint_tx_hash;
      if (finalHash) {
        setTxHash(finalHash);
        setTxChain(finalHash.startsWith("0x") ? "base" : "solana");
      }
      setStatus("done");
      setProgressMessage("Withdrawal confirmed.");
      refetchBalancesSoon();
    } catch (err) {
      console.error("[DepositModal] solana withdraw failed:", err);
      setError(
        err instanceof Error ? err.message : "Transaction failed.",
      );
      setStatus("idle");
      setProgressMessage("Preparing transfer...");
    }
  }, [
    solanaDisabled, selectedWallet, parseAmount, token,
    sendSolanaSolWithdraw, sendSolanaWithdraw, solBalance.solanaUsdcRaw,
    solanaAddress, user, sendBatchTx, meta.label,
  ]);

  const handleWithdraw =
    chain === "solana" ? handleSolanaWithdraw : handleBaseWithdraw;

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
                setTxChain(null);
                setTokenMenuOpen(false);
                setChainMenuOpen(false);
                setToken((currentToken) => {
                  const nextTokens = tokensFor(activeChain, t);
                  return nextTokens.includes(currentToken)
                    ? currentToken
                    : nextTokens[0];
                });
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
                  setChainMenuOpen(false);
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
              <span className="text-xs font-semibold text-[var(--text)]">{translate("Network", "Red")}</span>
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
                    {tab === "deposit" ? translate("From", "Desde") : translate("To", "Hacia")}
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
                  {translate("Connect", "Conectar")}
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
                  {locale === "es" ? `No hay una wallet de ${chainLabel(chain)} conectada` : `No ${chainLabel(chain)} wallet connected`}
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
                {translate("Connect", "Conectar")} {chainLabel(chain)} wallet
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
                      {tab === "deposit" ? translate("Deposit", "Depositar") : translate("Withdraw", "Retirar")} {translate("on", "en")} {chainLabel(chain)}
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
              {chain === "solana" && token === "tslax" && !SOLANA_TSLAX_MINT && (
                <p className="text-xs text-amber-400 mt-1">
                  TSLAx mint is not configured in this deployment.
                </p>
              )}
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
                  {tab === "withdraw"
                    ? translate("Cross-chain withdrawals can take a few minutes.", "Los retiros entre redes pueden tardar unos minutos.")
                    : translate("This can take a few moments.", "Esto puede tardar unos momentos.")}
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
