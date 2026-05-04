import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { createElement, type ReactNode } from "react";

const ORIGINAL_ENV = { ...process.env };

const privyProviderSpy = vi.fn();

vi.mock("@privy-io/react-auth", () => ({
  PrivyProvider: (props: { config: unknown; children: ReactNode }) => {
    privyProviderSpy(props);
    return null;
  },
  dataSuffix: (value: unknown) => ({ __dataSuffix: value }),
}));

vi.mock("@privy-io/react-auth/solana", () => ({
  toSolanaWalletConnectors: () => ({ __connectors: true }),
}));

vi.mock("@privy-io/react-auth/smart-wallets", () => ({
  SmartWalletsProvider: (props: { children: ReactNode }) =>
    createElement("div", null, props.children),
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
  SOLANA_CHAIN: "solana:mainnet",
  SOLANA_RPC_URL: "https://api.devnet.solana.com",
  solanaWsUrl: () => "wss://api.devnet.solana.com",
}));

type PrivyConfig = {
  embeddedWallets?: {
    solana?: { createOnLogin?: string };
    ethereum?: { createOnLogin?: string };
  };
  solana?: {
    rpcs?: Record<string, unknown>;
  };
};

async function loadProvidersModule() {
  vi.resetModules();
  return import("@/lib/providers");
}

describe("buildPrivyConfig", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.NEXT_PUBLIC_DEPLOYMENT_ENV;
    delete process.env.NEXT_PUBLIC_SOLANA_ENABLED;
    delete process.env.NEXT_PUBLIC_BUILDER_CODE;
    privyProviderSpy.mockClear();
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
    expect(config.solana?.rpcs).toHaveProperty("solana:mainnet");
  });

  it("keeps Solana embedded wallet creation on in devnet", async () => {
    process.env.NEXT_PUBLIC_DEPLOYMENT_ENV = "devnet";
    const mod = await loadProvidersModule();

    const config = mod.buildPrivyConfig();

    expect(config.embeddedWallets?.solana?.createOnLogin).toBe("all-users");
  });

  it("keeps Solana embedded wallet creation on in mainnet when explicitly enabled", async () => {
    process.env.NEXT_PUBLIC_DEPLOYMENT_ENV = "mainnet";
    process.env.NEXT_PUBLIC_SOLANA_ENABLED = "true";
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

describe("Providers hands the buildPrivyConfig output to PrivyProvider", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.NEXT_PUBLIC_DEPLOYMENT_ENV;
    delete process.env.NEXT_PUBLIC_SOLANA_ENABLED;
    delete process.env.NEXT_PUBLIC_BUILDER_CODE;
    process.env.NEXT_PUBLIC_PRIVY_APP_ID = "test-app-id";
    privyProviderSpy.mockClear();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("passes createOnLogin off to PrivyProvider in mainnet", async () => {
    process.env.NEXT_PUBLIC_DEPLOYMENT_ENV = "mainnet";
    const { Providers } = await loadProvidersModule();

    render(
      createElement(
        Providers,
        null as unknown as { children: ReactNode },
        createElement("div", null, "child"),
      ),
    );

    expect(privyProviderSpy).toHaveBeenCalledTimes(1);
    const call = privyProviderSpy.mock.calls[0][0] as { config: PrivyConfig };
    expect(call.config.embeddedWallets?.solana?.createOnLogin).toBe("off");
  });

  it("passes createOnLogin all-users to PrivyProvider in devnet", async () => {
    process.env.NEXT_PUBLIC_DEPLOYMENT_ENV = "devnet";
    const { Providers } = await loadProvidersModule();

    render(
      createElement(
        Providers,
        null as unknown as { children: ReactNode },
        createElement("div", null, "child"),
      ),
    );

    expect(privyProviderSpy).toHaveBeenCalledTimes(1);
    const call = privyProviderSpy.mock.calls[0][0] as { config: PrivyConfig };
    expect(call.config.embeddedWallets?.solana?.createOnLogin).toBe("all-users");
  });
});
