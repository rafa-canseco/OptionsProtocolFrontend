"use client";

import { usePrivy, useWallets, useConnectWallet } from "@privy-io/react-auth";
import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import {
  useWallets as useSolanaWallets,
  useSignAndSendTransaction,
} from "@privy-io/react-auth/solana";
import { createWalletClient, custom, type Address } from "viem";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { CHAIN } from "@/lib/contracts";

const SOLANA_RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const USDC_MINT = process.env.NEXT_PUBLIC_SOLANA_USDC_MINT ?? "";

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
  const [chainError, setChainError] = useState<string | null>(null);

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

    // Solana external wallets (not the embedded Privy wallet)
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

  useEffect(() => {
    if (!fundingWallet) return;
    fundingWallet
      .switchChain(CHAIN.id)
      .then(() => setChainError(null))
      .catch((err) => {
        console.error("[useWallet] Failed to switch chain:", err);
        setChainError(
          "Failed to switch to the required chain. Transactions will fail.",
        );
      });
  }, [fundingWallet]);

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
      if (!USDC_MINT) {
        throw new Error("NEXT_PUBLIC_SOLANA_USDC_MINT not configured");
      }

      const sourceWallet = solanaWallets.find(
        (w) => w.address === fromAddress,
      );
      if (!sourceWallet) {
        throw new Error("Solana wallet not found: " + fromAddress);
      }

      const conn = new Connection(SOLANA_RPC_URL);
      const mint = new PublicKey(USDC_MINT);
      const sender = new PublicKey(fromAddress);
      const receiver = new PublicKey(solanaAddress);

      const sourceAta = await getAssociatedTokenAddress(
        mint, sender, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
      );
      const destAta = await getAssociatedTokenAddress(
        mint, receiver, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
      );

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
        chain: "solana:devnet",
      });
    },
    [solanaAddress, solanaWallets, signAndSendTransaction],
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
    chainError,
    isConnected: !!fundingAddress,
    isReady: ready,
    connectWallet,
    activateSmartWallet,
    disconnect,
  };
}
