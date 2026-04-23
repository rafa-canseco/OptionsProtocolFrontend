import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

vi.mock("@privy-io/react-auth", () => ({
  PrivyProvider: () => null,
  dataSuffix: (value: unknown) => ({ __dataSuffix: value }),
}));

vi.mock("@privy-io/react-auth/solana", () => ({
  toSolanaWalletConnectors: () => ({ __connectors: true }),
}));

vi.mock("@privy-io/react-auth/smart-wallets", () => ({
  SmartWalletsProvider: () => null,
}));

vi.mock("ox/erc8021", () => ({
  Attribution: { toDataSuffix: (input: unknown) => ({ input }) },
}));

vi.mock("@solana/kit", () => ({
  createSolanaRpc: (url: string) => ({ __rpc: url }),
  createSolanaRpcSubscriptions: (url: string) => ({ __sub: url }),
}));

vi.mock("@/lib/contracts", () => ({
  CHAIN: { id: 8453, name: "base" },
}));

vi.mock("@/lib/solana", () => ({
  SOLANA_RPC_URL: "https://api.devnet.solana.com",
}));

async function loadProvidersModule() {
  vi.resetModules();
  return import("@/lib/providers");
}

describe("buildPrivyConfig", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.NEXT_PUBLIC_DEPLOYMENT_ENV;
    delete process.env.NEXT_PUBLIC_BUILDER_CODE;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("disables Solana embedded wallet creation in mainnet", async () => {
    process.env.NEXT_PUBLIC_DEPLOYMENT_ENV = "mainnet";
    const mod = await loadProvidersModule();

    const config = mod.buildPrivyConfig();

    expect(config.embeddedWallets?.solana?.createOnLogin).toBe("off");
    expect(config.embeddedWallets?.ethereum?.createOnLogin).toBe("all-users");
  });

  it("keeps Solana embedded wallet creation on in devnet", async () => {
    process.env.NEXT_PUBLIC_DEPLOYMENT_ENV = "devnet";
    const mod = await loadProvidersModule();

    const config = mod.buildPrivyConfig();

    expect(config.embeddedWallets?.solana?.createOnLogin).toBe("all-users");
  });

  it("keeps Solana embedded wallet creation on in testnet", async () => {
    process.env.NEXT_PUBLIC_DEPLOYMENT_ENV = "testnet";
    const mod = await loadProvidersModule();

    const config = mod.buildPrivyConfig();

    expect(config.embeddedWallets?.solana?.createOnLogin).toBe("all-users");
  });
});
