"use client";

import { usePathname } from "next/navigation";
import { PrivyProvider, dataSuffix } from "@privy-io/react-auth";
import type { PrivyClientConfig } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import { SmartWalletsProvider } from "@privy-io/react-auth/smart-wallets";
import { Attribution } from "ox/erc8021";
import { CHAIN } from "@/lib/contracts";
import { SOLANA_CHAIN, SOLANA_RPC_URL, solanaWsUrl } from "@/lib/solana";
import { createSolanaRpc, createSolanaRpcSubscriptions } from "@solana/kit";
import { B1naryAccountOnboarding } from "@/components/B1naryAccountOnboarding";
import { useAppPreferences, type AppTheme } from "@/lib/preferences";

const B1NARY_ACCOUNT_ROUTES = ["/earn", "/positions"];

function getPrivyAppId(): string {
  const id = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  if (!id) {
    throw new Error(
      "NEXT_PUBLIC_PRIVY_APP_ID is not set. Add it to your .env.local file.",
    );
  }
  return id;
}

export function buildPrivyConfig(theme: AppTheme = "dark"): PrivyClientConfig {
  const BUILDER_CODE = process.env.NEXT_PUBLIC_BUILDER_CODE;
  const plugins = BUILDER_CODE
    ? [dataSuffix(Attribution.toDataSuffix({ codes: [BUILDER_CODE] }))]
    : [];

  return {
    loginMethods: ["wallet"],
    appearance: {
      theme,
      accentColor: theme === "dark" ? "#7890FF" : "#3157F6",
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
        createOnLogin: "off",
      },
      solana: {
        createOnLogin: "off",
      },
    },
    plugins,
  };
}

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { theme } = useAppPreferences();
  const showB1naryAccountOnboarding = B1NARY_ACCOUNT_ROUTES.some((route) =>
    pathname?.startsWith(route),
  );

  // The public landing page does not need wallet infrastructure. Keeping Privy
  // off this route also allows local HTTP preview; embedded wallets require HTTPS.
  if (pathname === "/") return children;

  return (
    <PrivyProvider appId={getPrivyAppId()} config={buildPrivyConfig(theme)}>
      <SmartWalletsProvider>
        {children}
        {showB1naryAccountOnboarding && <B1naryAccountOnboarding />}
      </SmartWalletsProvider>
    </PrivyProvider>
  );
}
