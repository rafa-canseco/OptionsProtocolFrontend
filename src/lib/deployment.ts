import { ASSETS } from "@/lib/assets";

export type DeploymentChain = "base" | "solana" | "multi";
export type DeploymentEnv = "mainnet" | "testnet" | "devnet";

const BASE_SUBDOMAIN = "https://app.b1nary.app";
const SOLANA_SUBDOMAIN = "https://solana.b1nary.app";

export function getDeploymentChain(): DeploymentChain {
  const raw = process.env.NEXT_PUBLIC_DEPLOYMENT_CHAIN;
  if (raw === "base" || raw === "solana" || raw === "multi") return raw;
  return "multi";
}

export function getDeploymentEnv(): DeploymentEnv {
  const raw = process.env.NEXT_PUBLIC_DEPLOYMENT_ENV;
  if (raw === "mainnet" || raw === "testnet" || raw === "devnet") return raw;
  return "mainnet";
}

export function isDevnet(): boolean {
  return getDeploymentEnv() === "devnet";
}

export function getFeaturedAssetSlug(): string {
  const override = process.env.NEXT_PUBLIC_FEATURED_ASSET;
  if (override && override in ASSETS) return override;
  return getDeploymentChain() === "solana" ? "sol" : "eth";
}

export function getChainLabel(): string {
  switch (getDeploymentChain()) {
    case "base":
      return "Base";
    case "solana":
      return "Solana";
    default:
      return "Base + Solana";
  }
}

export function getHeroChainLine(): string {
  const chain = getDeploymentChain();
  const env = getDeploymentEnv();
  if (chain === "solana" && env === "devnet") {
    return "Solana devnet preview. Base mainnet live.";
  }
  if (chain === "solana" && env === "mainnet") {
    return "Now live on Solana. Base mainnet live.";
  }
  if (chain === "base" && env === "mainnet") {
    return "Now live on Base. Solana devnet preview.";
  }
  if (chain === "base" && env === "testnet") {
    return "Base testnet. Solana devnet preview.";
  }
  return "Live on Base. Solana devnet preview.";
}

export function getOtherSubdomain():
  | { label: string; href: string }
  | null {
  const chain = getDeploymentChain();
  if (chain === "base") {
    return { label: "Solana devnet →", href: SOLANA_SUBDOMAIN };
  }
  if (chain === "solana") {
    return { label: "Base (live) →", href: BASE_SUBDOMAIN };
  }
  return null;
}
