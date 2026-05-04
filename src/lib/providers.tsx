"use client";

import { PrivyProvider, dataSuffix } from "@privy-io/react-auth";
import type { PrivyClientConfig } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import { SmartWalletsProvider } from "@privy-io/react-auth/smart-wallets";
import { Attribution } from "ox/erc8021";
import { CHAIN } from "@/lib/contracts";
import { SOLANA_CHAIN, SOLANA_RPC_URL, solanaWsUrl } from "@/lib/solana";
import { createSolanaRpc, createSolanaRpcSubscriptions } from "@solana/kit";

function getPrivyAppId(): string {
  const id = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  if (!id) {
    throw new Error(
      "NEXT_PUBLIC_PRIVY_APP_ID is not set. Add it to your .env.local file.",
    );
  }
  return id;
}

export function buildPrivyConfig(): PrivyClientConfig {
  const BUILDER_CODE = process.env.NEXT_PUBLIC_BUILDER_CODE;
  const plugins = BUILDER_CODE
    ? [dataSuffix(Attribution.toDataSuffix({ codes: [BUILDER_CODE] }))]
    : [];

  return {
    loginMethods: ["wallet"],
    appearance: {
      theme: "dark",
      accentColor: "#22D3EE",
      walletChainType: "ethereum-and-solana",
    },
    externalWallets: {
      solana: {
        connectors: toSolanaWalletConnectors(),
      },
    },
    supportedChains: [CHAIN],
    solana: {
      rpcs: {
        [SOLANA_CHAIN]: {
          rpc: createSolanaRpc(
            SOLANA_RPC_URL || "https://api.devnet.solana.com",
          ),
          rpcSubscriptions: createSolanaRpcSubscriptions(solanaWsUrl()),
        },
      },
    },
    embeddedWallets: {
      showWalletUIs: false,
      ethereum: {
        createOnLogin: "all-users",
      },
      solana: {
        createOnLogin: "off",
      },
    },
    plugins,
  };
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider appId={getPrivyAppId()} config={buildPrivyConfig()}>
      <SmartWalletsProvider>{children}</SmartWalletsProvider>
    </PrivyProvider>
  );
}
