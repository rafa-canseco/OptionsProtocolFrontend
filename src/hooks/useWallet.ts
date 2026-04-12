"use client";

import { usePrivy, useWallets, useConnectWallet } from "@privy-io/react-auth";
import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import {
  useWallets as useSolanaWallets,
  useSignAndSendTransaction,
  useSignTransaction as useSolanaSignTransaction,
} from "@privy-io/react-auth/solana";
import { createWalletClient, custom, type Address } from "viem";
import { useCallback, useMemo } from "react";
import {
  Connection, PublicKey, Transaction, VersionedTransaction, SystemProgram,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const bs58 = require("bs58") as { encode(data: Uint8Array): string };
import { CHAIN } from "@/lib/contracts";
import {
  SOLANA_RPC_URL,
  SOLANA_USDC_MINT,
  SOLANA_CHAIN,
  solanaConnection,
  toPublicKey,
} from "@/lib/solana";

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

function prettyWalletName(raw: string): string {
  return WALLET_NAMES[raw] ?? raw;
}

export function useWallet() {
  const { logout, ready } = usePrivy();
  const { connectWallet } = useConnectWallet();
  const { wallets } = useWallets();
  const { client } = useSmartWallets();
  const { wallets: solanaWallets } = useSolanaWallets();
  const { signAndSendTransaction } = useSignAndSendTransaction();
  const { signTransaction: privySignSolanaTx } = useSolanaSignTransaction();
  // --- EVM wallets ---
  const externalWallet = wallets.find((w) => w.walletClientType !== "privy");
  const embeddedWallet = wallets.find((w) => w.walletClientType === "privy");
  const fundingWallet = externalWallet ?? embeddedWallet;

  // Trading address: always the smart wallet (gas-sponsored, batched)
  const address = client?.account?.address as Address | undefined;

  // Funding address: the connected EOA (for deposits, withdrawals)
  const fundingAddress = fundingWallet?.address as Address | undefined;

  // --- Solana wallets ---
  const solanaEmbedded = solanaWallets.find(
    (w) => "isPrivyWallet" in w.standardWallet,
  );
  const solanaAddress = solanaEmbedded?.address;

  // --- Unified external wallets list ---
  const externalWalletsList = useMemo<ExternalWallet[]>(() => {
    const list: ExternalWallet[] = [];

    // EVM external wallets (or embedded as fallback for email-login users)
    const evmWallet = externalWallet ?? embeddedWallet;
    if (evmWallet) {
      list.push({
        address: evmWallet.address,
        chain: "base",
        name: prettyWalletName(evmWallet.walletClientType),
        walletClientType: evmWallet.walletClientType,
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
  }, [externalWallet, embeddedWallet, solanaWallets]);

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
    async (call: BatchCall): Promise<`0x${string}`> => {
      if (!fundingWallet) {
        throw new Error("No funding wallet connected");
      }
      await fundingWallet.switchChain(CHAIN.id);
      const provider = await fundingWallet.getEthereumProvider();
      const walletClient = createWalletClient({
        account: fundingWallet.address as Address,
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
    [fundingWallet],
  );

  // SPL USDC transfer from external Solana wallet to embedded Solana wallet
  const sendSolanaDeposit = useCallback(
    async (fromAddress: string, amount: bigint): Promise<void> => {
      if (!solanaAddress) {
        throw new Error("Solana embedded wallet not ready");
      }
      if (!SOLANA_USDC_MINT || !SOLANA_RPC_URL) {
        throw new Error(
          "Solana USDC mint or RPC URL not configured",
        );
      }

      const sourceWallet = solanaWallets.find(
        (w) => w.address === fromAddress,
      );
      if (!sourceWallet) {
        throw new Error("Solana wallet not found: " + fromAddress);
      }

      const conn = new Connection(SOLANA_RPC_URL);
      const mint = toPublicKey(SOLANA_USDC_MINT, "USDC mint");
      const sender = toPublicKey(fromAddress, "sender");
      const receiver = toPublicKey(solanaAddress, "receiver");

      const sourceAta = await getAssociatedTokenAddress(
        mint, sender, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
      );
      const destAta = await getAssociatedTokenAddress(
        mint, receiver, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
      );

      // Verify source token account exists and has enough balance
      const sourceAccount = await conn.getAccountInfo(sourceAta);
      if (!sourceAccount) {
        throw new Error(
          "No USDC token account found for this wallet. " +
            "Send USDC to this wallet first.",
        );
      }

      const tx = new Transaction();

      // Create destination ATA if it doesn't exist
      const destAccount = await conn.getAccountInfo(destAta);
      if (!destAccount) {
        tx.add(
          createAssociatedTokenAccountInstruction(
            sender, destAta, receiver, mint,
            TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
          ),
        );
      }

      tx.add(
        createTransferInstruction(
          sourceAta, destAta, sender, amount,
          [], TOKEN_PROGRAM_ID,
        ),
      );

      const { blockhash } = await conn.getLatestBlockhash();
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
        solanaAddress,
        "amount:",
        amount.toString(),
      );

      await signAndSendTransaction({
        transaction: serialized,
        wallet: sourceWallet,
        chain: SOLANA_CHAIN as `solana:${string}`,
      });
    },
    [solanaAddress, solanaWallets, signAndSendTransaction],
  );

  // Native SOL transfer from external Solana wallet to embedded wallet
  const sendSolanaSolDeposit = useCallback(
    async (fromAddress: string, lamports: bigint): Promise<void> => {
      if (!solanaAddress) {
        throw new Error("Solana embedded wallet not ready");
      }
      if (!SOLANA_RPC_URL) {
        throw new Error("Solana RPC URL not configured");
      }

      const sourceWallet = solanaWallets.find(
        (w) => w.address === fromAddress,
      );
      if (!sourceWallet) {
        throw new Error("Solana wallet not found: " + fromAddress);
      }

      const conn = new Connection(SOLANA_RPC_URL);
      const sender = toPublicKey(fromAddress, "sender");
      const receiver = toPublicKey(solanaAddress, "receiver");

      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: sender,
          toPubkey: receiver,
          lamports,
        }),
      );

      const { blockhash } = await conn.getLatestBlockhash();
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
        solanaAddress,
        "lamports:",
        lamports.toString(),
      );

      await signAndSendTransaction({
        transaction: serialized,
        wallet: sourceWallet,
        chain: SOLANA_CHAIN as `solana:${string}`,
      });
    },
    [solanaAddress, solanaWallets, signAndSendTransaction],
  );

  // Gas-sponsored Solana trade execution (equivalent of sendBatchTx for Base)
  const sendSolanaTransaction = useCallback(
    async (tx: Transaction | VersionedTransaction): Promise<string> => {
      if (!solanaEmbedded) {
        throw new Error("Solana embedded wallet not ready");
      }
      if (!solanaConnection) {
        throw new Error("Solana RPC not configured");
      }

      // Privy's client-side sponsor flow fails on v0 transactions that use
      // address lookup tables. Sign locally, then submit via our RPC instead.
      const unsignedTx = tx instanceof VersionedTransaction
        ? tx.serialize()
        : tx.serialize({ requireAllSignatures: false, verifySignatures: false });
      const { signedTransaction } = await privySignSolanaTx({
        transaction: unsignedTx,
        wallet: solanaEmbedded,
        chain: SOLANA_CHAIN as `solana:${string}`,
      });
      const signature = await solanaConnection.sendRawTransaction(
        Buffer.from(signedTransaction),
        { preflightCommitment: "confirmed" },
      );
      await solanaConnection.confirmTransaction(signature, "confirmed");
      return signature;
    },
    [solanaEmbedded, privySignSolanaTx],
  );

  // Sign a Solana transaction without broadcasting (for bridge pre-signing)
  const signSolanaTransaction = useCallback(
    async (serializedTx: Uint8Array): Promise<Uint8Array> => {
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

  // Authenticate the connected wallet to create a smart wallet.
  const activateSmartWallet = useCallback(async () => {
    if (!fundingWallet) throw new Error("No wallet connected");
    await fundingWallet.loginOrLink();
  }, [fundingWallet]);

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
    solanaAddress,
    externalWallets: externalWalletsList,
    sendBatchTx,
    sendFundingTx,
    sendSolanaDeposit,
    sendSolanaSolDeposit,
    sendSolanaTransaction,
    signSolanaTransaction,
    isConnected: !!(fundingAddress || solanaAddress),
    isReady: ready,
    connectWallet,
    activateSmartWallet,
    disconnect,
  };
}
