"use client";

import {
  usePrivy,
  useWallets,
  useConnectWallet,
  useCreateWallet,
  type User,
} from "@privy-io/react-auth";
import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import {
  type ConnectedStandardSolanaWallet,
  useWallets as useSolanaWallets,
  useCreateWallet as useCreateSolanaWallet,
  useSignAndSendTransaction,
  useSignTransaction as useSolanaSignTransaction,
} from "@privy-io/react-auth/solana";
import { createWalletClient, custom, type Address } from "viem";
import { useCallback, useMemo } from "react";
import {
  Connection, Transaction, VersionedTransaction, SystemProgram, PublicKey,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const bs58 = require("bs58") as { encode(data: Uint8Array): string };
import { CHAIN } from "@/lib/contracts";
import { isSolanaOffInProd } from "@/lib/marketState";
import {
  SOLANA_RPC_URL,
  SOLANA_TSLAX_MINT,
  SOLANA_USDC_MINT,
  SOLANA_CHAIN,
  solanaConnection,
  toPublicKey,
} from "@/lib/solana";

const SOLANA_DISABLED_ERROR = "Solana flows are disabled in production.";

function assertSolanaEnabled(): void {
  if (isSolanaOffInProd()) {
    throw new Error(SOLANA_DISABLED_ERROR);
  }
}

export type BatchCall = {
  to: Address;
  data: `0x${string}`;
  value?: bigint;
};

export interface ExternalWallet {
  address: string;
  chain: "base" | "solana";
  name: string;
  walletClientType: string;
}

const WALLET_NAMES: Record<string, string> = {
  metamask: "MetaMask",
  coinbase_wallet: "Coinbase",
  rainbow: "Rainbow",
  phantom: "Phantom",
  privy: "Privy",
};

type WalletAccount = User["linkedAccounts"][number] & {
  address?: string;
  chainType?: "ethereum" | "solana";
  walletClientType?: string;
};

function walletAccounts(user: User | null): WalletAccount[] {
  return (user?.linkedAccounts ?? []).filter(
    (account): account is WalletAccount => account.type === "wallet",
  );
}

function isPrivyWalletClient(walletClientType: string | undefined): boolean {
  return walletClientType === "privy" || walletClientType === "privy-v2";
}

function uniqueAddresses(values: Array<string | undefined>): string[] {
  return values.filter((value, index, arr): value is string =>
    Boolean(value) && arr.indexOf(value) === index,
  );
}

function prettyWalletName(raw: string): string {
  return WALLET_NAMES[raw] ?? raw;
}

function getSplMintConfig(token: "usdc" | "tslax"): {
  mint: string;
  label: string;
  decimals: number;
} {
  if (token === "tslax") {
    if (!SOLANA_TSLAX_MINT) {
      throw new Error("Solana TSLAx mint not configured");
    }
    return { mint: SOLANA_TSLAX_MINT, label: "TSLAx", decimals: 8 };
  }
  if (!SOLANA_USDC_MINT) {
    throw new Error("Solana USDC mint not configured");
  }
  return { mint: SOLANA_USDC_MINT, label: "USDC", decimals: 6 };
}

async function getMintTokenProgram(
  conn: Connection,
  mint: PublicKey,
  label: string,
): Promise<PublicKey> {
  const mintAccount = await conn.getAccountInfo(mint, "confirmed");
  if (!mintAccount) {
    throw new Error(`${label} mint account not found.`);
  }
  if (
    mintAccount.owner.equals(TOKEN_PROGRAM_ID) ||
    mintAccount.owner.equals(TOKEN_2022_PROGRAM_ID)
  ) {
    return mintAccount.owner;
  }
  throw new Error(`${label} mint is not owned by a supported SPL token program.`);
}

async function findTokenAccountForMint(
  conn: Connection,
  owner: PublicKey,
  mint: PublicKey,
  tokenProgram: PublicKey,
  requireBalance: boolean,
) {
  const resp = await conn.getParsedTokenAccountsByOwner(
    owner,
    { mint },
    "confirmed",
  );
  const matching = resp.value.filter((entry) =>
    entry.account.owner.equals(tokenProgram),
  );
  if (!requireBalance) return matching[0]?.pubkey;

  return matching.find(({ account }) => {
    const parsed = account.data.parsed;
    const amount = parsed?.info?.tokenAmount?.amount;
    return amount != null && BigInt(amount) > BigInt(0);
  })?.pubkey;
}

export function useWallet() {
  const { authenticated, logout, ready, user } = usePrivy();
  const { connectWallet } = useConnectWallet();
  const { createWallet: createEvmWallet } = useCreateWallet();
  const { wallets } = useWallets();
  const { client } = useSmartWallets();
  const { wallets: solanaWallets } = useSolanaWallets();
  const { createWallet: createSolanaWallet } = useCreateSolanaWallet();
  const { signAndSendTransaction } = useSignAndSendTransaction();
  const { signTransaction: privySignSolanaTx } = useSolanaSignTransaction();
  const linkedWallets = useMemo(() => walletAccounts(user ?? null), [user]);
  // --- EVM wallets ---
  const externalWallet = wallets.find((w) => !isPrivyWalletClient(w.walletClientType));
  const embeddedWallet = wallets.find((w) => isPrivyWalletClient(w.walletClientType));
  const fundingWallet = externalWallet ?? embeddedWallet;

  // Trading address: always the smart wallet (gas-sponsored, batched)
  const address = (client?.account?.address ??
    user?.smartWallet?.address) as Address | undefined;

  // Funding address: the connected EOA (for deposits). Falls back to
  // embedded wallet so deposits work even without an external wallet.
  const fundingAddress = fundingWallet?.address as Address | undefined;

  // Withdraw address: external wallet only, never the embedded wallet.
  const withdrawAddress = externalWallet?.address as Address | undefined;

  // --- Solana wallets ---
  const solanaEmbedded = solanaWallets.find(
    (w) => "isPrivyWallet" in w.standardWallet,
  );
  const linkedSolanaEmbedded = linkedWallets.find(
    (wallet) =>
      wallet.chainType === "solana" &&
      isPrivyWalletClient(wallet.walletClientType),
  );
  const solanaAddress = solanaEmbedded?.address ?? linkedSolanaEmbedded?.address;

  const portfolioAddresses = useMemo(() => ({
    base: uniqueAddresses([
      address,
      ...linkedWallets
        .filter((wallet) =>
          wallet.chainType === "ethereum" &&
          isPrivyWalletClient(wallet.walletClientType),
        )
        .map((wallet) => wallet.address),
      embeddedWallet?.address,
    ]),
    solana: uniqueAddresses([
      solanaAddress,
      ...linkedWallets
        .filter((wallet) =>
          wallet.chainType === "solana" &&
          isPrivyWalletClient(wallet.walletClientType),
        )
        .map((wallet) => wallet.address),
    ]),
  }), [
    address,
    embeddedWallet?.address,
    linkedWallets,
    solanaAddress,
  ]);

  const getSolanaTradingAddress = useCallback(async (
    sourceWallet?: ConnectedStandardSolanaWallet,
  ): Promise<string> => {
    if (solanaAddress) return solanaAddress;
    if (!ready) {
      throw new Error("Wallet session is still loading. Please try again.");
    }
    if (!authenticated || !user?.id) {
      if (!sourceWallet) {
        throw new Error("Please connect your wallet before depositing to Solana.");
      }
      throw new Error(
        "Please connect your wallet before depositing to Solana.",
      );
    }
    const { wallet } = await createSolanaWallet();
    return wallet.address;
  }, [
    authenticated,
    createSolanaWallet,
    ready,
    solanaAddress,
    user?.id,
  ]);

  // --- Unified external wallets list ---
  const externalWalletsList = useMemo<ExternalWallet[]>(() => {
    const list: ExternalWallet[] = [];

    // EVM external wallets. Embedded Privy wallets are trading accounts,
    // not user-selected funding/withdrawal wallets.
    for (const wallet of wallets) {
      if (isPrivyWalletClient(wallet.walletClientType)) continue;
      list.push({
        address: wallet.address,
        chain: "base",
        name: prettyWalletName(wallet.walletClientType),
        walletClientType: wallet.walletClientType,
      });
    }

    // Solana external wallets (skip embedded Privy wallet)
    for (const w of solanaWallets) {
      if ("isPrivyWallet" in w.standardWallet) continue;
      list.push({
        address: w.address,
        chain: "solana",
        name: w.standardWallet.name,
        walletClientType: w.standardWallet.name.toLowerCase(),
      });
    }

    return list;
  }, [solanaWallets, wallets]);

  // All trades execute through the smart wallet — gas sponsored
  const sendBatchTx = useCallback(
    async (calls: BatchCall[]): Promise<unknown> => {
      if (calls.length === 0) {
        throw new Error("sendBatchTx requires at least one call");
      }
      if (!client) {
        throw new Error("Smart wallet not ready");
      }
      console.log(
        "[sendBatchTx] Smart wallet: firing batch with",
        calls.length,
        "calls:",
        calls.map((c) => ({ to: c.to, data: c.data.slice(0, 10) })),
      );
      return client
        .sendTransaction(
          {
            calls: calls.map((c) => ({
              to: c.to,
              data: c.data,
              value: c.value,
            })),
          },
          { uiOptions: { showWalletUIs: false } },
        )
        .catch((err) => {
          console.error("[sendBatchTx] Error:", err);
          throw err;
        });
    },
    [client],
  );

  // Deposit/withdraw — single tx from the user's EVM EOA
  const sendFundingTx = useCallback(
    async (
      call: BatchCall,
      walletAddress?: string,
    ): Promise<`0x${string}`> => {
      const sourceWallet = walletAddress
        ? wallets.find(
            (w) => w.address.toLowerCase() === walletAddress.toLowerCase(),
          )
        : fundingWallet;
      if (!sourceWallet) {
        throw new Error("No funding wallet connected");
      }
      await sourceWallet.switchChain(CHAIN.id);
      const provider = await sourceWallet.getEthereumProvider();
      const walletClient = createWalletClient({
        account: sourceWallet.address as Address,
        chain: CHAIN,
        transport: custom(provider),
      });
      console.log("[sendFundingTx] EOA sending tx to", call.to);
      return walletClient.sendTransaction({
        to: call.to,
        data: call.data,
        value: call.value,
      });
    },
    [fundingWallet, wallets],
  );

  // SPL USDC transfer from external Solana wallet to embedded Solana wallet
  const sendSolanaDeposit = useCallback(
    async (
      fromAddress: string,
      amount: bigint,
      token: "usdc" | "tslax" = "usdc",
    ): Promise<string> => {
      assertSolanaEnabled();
      const sourceWallet = solanaWallets.find(
        (w) => w.address === fromAddress,
      );
      if (!sourceWallet) {
        throw new Error("Solana wallet not found: " + fromAddress);
      }
      const receiverAddress = await getSolanaTradingAddress(sourceWallet);
      if (!SOLANA_RPC_URL) {
        throw new Error(
          "Solana RPC URL not configured",
        );
      }

      const conn = new Connection(SOLANA_RPC_URL);
      const splConfig = getSplMintConfig(token);
      const mint = toPublicKey(splConfig.mint, `${splConfig.label} mint`);
      const sender = toPublicKey(fromAddress, "sender");
      const receiver = toPublicKey(receiverAddress, "receiver");
      const tokenProgram = await getMintTokenProgram(
        conn,
        mint,
        splConfig.label,
      );

      const destAta = await getAssociatedTokenAddress(
        mint, receiver, false, tokenProgram, ASSOCIATED_TOKEN_PROGRAM_ID,
      );

      // Verify source token account exists and has enough balance
      const sourceAccount = await findTokenAccountForMint(
        conn,
        sender,
        mint,
        tokenProgram,
        true,
      );
      if (!sourceAccount) {
        throw new Error(
          `No ${splConfig.label} token account found for this wallet. ` +
            `Send ${splConfig.label} to this wallet first.`,
        );
      }

      const tx = new Transaction();

      // Create destination ATA if it doesn't exist
      const destAccount = await conn.getAccountInfo(destAta);
      if (!destAccount) {
        tx.add(
          createAssociatedTokenAccountInstruction(
            sender, destAta, receiver, mint,
            tokenProgram, ASSOCIATED_TOKEN_PROGRAM_ID,
          ),
        );
      }

      tx.add(
        createTransferCheckedInstruction(
          sourceAccount,
          mint,
          destAta,
          sender,
          amount,
          splConfig.decimals,
          [],
          tokenProgram,
        ),
      );

      const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = sender;

      const serialized = tx.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      });

      console.log(
        "[sendSolanaDeposit] Sending SPL transfer from",
        fromAddress,
        "to",
        receiverAddress,
        "token:",
        splConfig.label,
        "amount:",
        amount.toString(),
      );

      const { signature } = await signAndSendTransaction({
        transaction: serialized,
        wallet: sourceWallet,
        chain: SOLANA_CHAIN as `solana:${string}`,
        options: { uiOptions: { showWalletUIs: false } },
      });
      const signatureBase58 = bs58.encode(signature);
      await conn.confirmTransaction(
        { signature: signatureBase58, blockhash, lastValidBlockHeight },
        "confirmed",
      );
      return signatureBase58;
    },
    [getSolanaTradingAddress, solanaWallets, signAndSendTransaction],
  );

  // Native SOL transfer from external Solana wallet to embedded wallet
  const sendSolanaSolDeposit = useCallback(
    async (fromAddress: string, lamports: bigint): Promise<string> => {
      assertSolanaEnabled();
      const sourceWallet = solanaWallets.find(
        (w) => w.address === fromAddress,
      );
      if (!sourceWallet) {
        throw new Error("Solana wallet not found: " + fromAddress);
      }
      const receiverAddress = await getSolanaTradingAddress(sourceWallet);
      if (!SOLANA_RPC_URL) {
        throw new Error("Solana RPC URL not configured");
      }

      const conn = new Connection(SOLANA_RPC_URL);
      const sender = toPublicKey(fromAddress, "sender");
      const receiver = toPublicKey(receiverAddress, "receiver");

      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: sender,
          toPubkey: receiver,
          lamports,
        }),
      );

      const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = sender;

      const serialized = tx.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      });

      console.log(
        "[sendSolanaSolDeposit] Sending SOL from",
        fromAddress,
        "to",
        receiverAddress,
        "lamports:",
        lamports.toString(),
      );

      const { signature } = await signAndSendTransaction({
        transaction: serialized,
        wallet: sourceWallet,
        chain: SOLANA_CHAIN as `solana:${string}`,
        options: { uiOptions: { showWalletUIs: false } },
      });
      const signatureBase58 = bs58.encode(signature);
      await conn.confirmTransaction(
        { signature: signatureBase58, blockhash, lastValidBlockHeight },
        "confirmed",
      );
      return signatureBase58;
    },
    [getSolanaTradingAddress, solanaWallets, signAndSendTransaction],
  );

  // Gas-sponsored Solana trade execution (equivalent of sendBatchTx for Base)
  const sendSolanaTransaction = useCallback(
    async (tx: Transaction | VersionedTransaction): Promise<string> => {
      assertSolanaEnabled();
      if (!solanaEmbedded) {
        throw new Error("Solana embedded wallet not ready");
      }

      const serialized = tx instanceof VersionedTransaction
        ? tx.serialize()
        : tx.serialize({ requireAllSignatures: false, verifySignatures: false });

      const result = await signAndSendTransaction({
        transaction: serialized,
        wallet: solanaEmbedded,
        chain: SOLANA_CHAIN as `solana:${string}`,
        options: {
          sponsor: true,
          uiOptions: { showWalletUIs: false },
        },
      });

      return typeof result.signature === "string"
        ? result.signature
        : bs58.encode(result.signature);
    },
    [solanaEmbedded, signAndSendTransaction],
  );

  // SPL USDC transfer from embedded Solana wallet to an external Solana wallet
  const sendSolanaWithdraw = useCallback(
    async (
      toAddress: string,
      amount: bigint,
      token: "usdc" | "tslax" = "usdc",
    ): Promise<string> => {
      assertSolanaEnabled();
      if (!solanaEmbedded || !solanaAddress) {
        throw new Error("Solana embedded wallet not ready");
      }
      if (!SOLANA_RPC_URL) {
        throw new Error("Solana RPC URL not configured");
      }

      const conn = new Connection(SOLANA_RPC_URL);
      const splConfig = getSplMintConfig(token);
      const mint = toPublicKey(splConfig.mint, `${splConfig.label} mint`);
      const sender = toPublicKey(solanaAddress, "sender");
      const receiver = toPublicKey(toAddress, "receiver");
      const tokenProgram = await getMintTokenProgram(
        conn,
        mint,
        splConfig.label,
      );

      const destAta = await getAssociatedTokenAddress(
        mint, receiver, false, tokenProgram, ASSOCIATED_TOKEN_PROGRAM_ID,
      );

      const sourceAccount = await findTokenAccountForMint(
        conn,
        sender,
        mint,
        tokenProgram,
        true,
      );
      if (!sourceAccount) {
        throw new Error(
          `No ${splConfig.label} balance found in your Solana trading account.`,
        );
      }

      const tx = new Transaction();
      const destAccount = await conn.getAccountInfo(destAta);
      if (!destAccount) {
        tx.add(
          createAssociatedTokenAccountInstruction(
            sender, destAta, receiver, mint,
            tokenProgram, ASSOCIATED_TOKEN_PROGRAM_ID,
          ),
        );
      }
      tx.add(
        createTransferCheckedInstruction(
          sourceAccount,
          mint,
          destAta,
          sender,
          amount,
          splConfig.decimals,
          [],
          tokenProgram,
        ),
      );
      const { blockhash } = await conn.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = sender;

      return sendSolanaTransaction(tx);
    },
    [solanaAddress, solanaEmbedded, sendSolanaTransaction],
  );

  // Native SOL transfer from embedded Solana wallet to an external Solana wallet
  const sendSolanaSolWithdraw = useCallback(
    async (toAddress: string, lamports: bigint): Promise<string> => {
      assertSolanaEnabled();
      if (!solanaAddress) {
        throw new Error("Solana embedded wallet not ready");
      }
      const sender = toPublicKey(solanaAddress, "sender");
      const receiver = toPublicKey(toAddress, "receiver");
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: sender,
          toPubkey: receiver,
          lamports,
        }),
      );
      if (!solanaConnection) {
        throw new Error("Solana RPC not configured");
      }
      const { blockhash } = await solanaConnection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = sender;
      return sendSolanaTransaction(tx);
    },
    [solanaAddress, sendSolanaTransaction],
  );

  // Sign a Solana transaction without broadcasting (for bridge pre-signing)
  const signSolanaTransaction = useCallback(
    async (serializedTx: Uint8Array): Promise<Uint8Array> => {
      assertSolanaEnabled();
      if (!solanaEmbedded) {
        throw new Error("Solana embedded wallet not ready");
      }
      const result = await privySignSolanaTx({
        transaction: serializedTx,
        wallet: solanaEmbedded,
        chain: SOLANA_CHAIN as `solana:${string}`,
      });
      return result.signedTransaction;
    },
    [solanaEmbedded, privySignSolanaTx],
  );

  // Prepare the user's internal Base trading wallet. External wallets such
  // as Rabby are funding sources and may belong to another Privy login, so
  // activation must not try to link them to the current Privy user.
  const activateSmartWallet = useCallback(async () => {
    if (address) return;
    if (!ready) {
      throw new Error("Wallet session is still loading. Please try again.");
    }
    if (!authenticated || !user?.id) {
      throw new Error("Connect Base wallet first.");
    }
    if (!embeddedWallet) {
      await createEvmWallet();
    }
  }, [
    address,
    authenticated,
    createEvmWallet,
    embeddedWallet,
    ready,
    user?.id,
  ]);

  const disconnect = useCallback(async () => {
    for (const w of wallets) {
      try {
        const provider = await w.getEthereumProvider();
        await provider.request({
          method: "wallet_revokePermissions",
          params: [{ eth_accounts: {} }],
        });
      } catch (err) {
        console.warn("[disconnect] Could not revoke permissions:", err);
      }
    }
    try {
      await logout();
    } catch (err) {
      console.error("[disconnect] logout failed:", err);
    }
  }, [wallets, logout]);

  return {
    address,
    fundingAddress,
    withdrawAddress,
    hasExternalWallet: !!externalWallet,
    solanaAddress,
    externalWallets: externalWalletsList,
    portfolioAddresses,
    sendBatchTx,
    sendFundingTx,
    sendSolanaDeposit,
    sendSolanaSolDeposit,
    sendSolanaWithdraw,
    sendSolanaSolWithdraw,
    sendSolanaTransaction,
    signSolanaTransaction,
    // True when any wallet (external or embedded) is available.
    // Use hasExternalWallet to guard outbound transfers.
    isConnected: !!(fundingAddress || solanaAddress),
    isReady: ready,
    connectWallet,
    activateSmartWallet,
    disconnect,
  };
}
