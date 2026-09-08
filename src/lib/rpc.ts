import { base, baseSepolia } from "viem/chains";

export const BASE_MAINNET_GATEWAY_URL =
  "https://baserpcgateway-production.up.railway.app";

type BrowserRpcEnv = {
  NEXT_PUBLIC_CHAIN_ID?: string;
  NEXT_PUBLIC_DEPLOYMENT_ENV?: string;
  NEXT_PUBLIC_RPC_URL?: string;
};

export function resolveBrowserRpcConfig(env: BrowserRpcEnv) {
  const rawChainId = env.NEXT_PUBLIC_CHAIN_ID ?? "84532";
  const chainId = Number(rawChainId);

  if (chainId !== base.id && chainId !== baseSepolia.id) {
    throw new Error(
      `[rpc] NEXT_PUBLIC_CHAIN_ID="${rawChainId}" must be 8453 (Base) or 84532 (Base Sepolia).`,
    );
  }

  const deploymentEnv = env.NEXT_PUBLIC_DEPLOYMENT_ENV;
  if (
    deploymentEnv !== "mainnet" &&
    deploymentEnv !== "testnet" &&
    deploymentEnv !== "devnet"
  ) {
    throw new Error(
      "[rpc] NEXT_PUBLIC_DEPLOYMENT_ENV must be mainnet, testnet, or devnet.",
    );
  }

  if (deploymentEnv === "mainnet" && chainId !== base.id) {
    throw new Error("[rpc] Mainnet deployments must use NEXT_PUBLIC_CHAIN_ID=8453.");
  }
  if (chainId === base.id && deploymentEnv !== "mainnet") {
    throw new Error("[rpc] Base mainnet requires NEXT_PUBLIC_DEPLOYMENT_ENV=mainnet.");
  }

  const rpcUrl = env.NEXT_PUBLIC_RPC_URL;
  if (!rpcUrl) {
    throw new Error("[rpc] NEXT_PUBLIC_RPC_URL is required; public RPC fallback is disabled.");
  }

  if (
    deploymentEnv === "mainnet" &&
    rpcUrl !== BASE_MAINNET_GATEWAY_URL
  ) {
    throw new Error(
      `[rpc] Mainnet browser reads must use ${BASE_MAINNET_GATEWAY_URL}.`,
    );
  }

  return { chain: chainId === base.id ? base : baseSepolia, rpcUrl };
}

export const { chain: CHAIN, rpcUrl: RPC_URL } = resolveBrowserRpcConfig({
  NEXT_PUBLIC_CHAIN_ID: process.env.NEXT_PUBLIC_CHAIN_ID,
  NEXT_PUBLIC_DEPLOYMENT_ENV: process.env.NEXT_PUBLIC_DEPLOYMENT_ENV,
  NEXT_PUBLIC_RPC_URL: process.env.NEXT_PUBLIC_RPC_URL,
});
