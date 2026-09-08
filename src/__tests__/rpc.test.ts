import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };
const GATEWAY = "https://baserpcgateway-production.up.railway.app";

async function loadRpcModule() {
  process.env.NEXT_PUBLIC_CHAIN_ID = "8453";
  process.env.NEXT_PUBLIC_DEPLOYMENT_ENV = "mainnet";
  process.env.NEXT_PUBLIC_RPC_URL = GATEWAY;
  vi.resetModules();
  return import("@/lib/rpc");
}

describe("browser RPC configuration", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("accepts the public gateway on Base mainnet", async () => {
    const { resolveBrowserRpcConfig } = await loadRpcModule();

    expect(
      resolveBrowserRpcConfig({
        NEXT_PUBLIC_CHAIN_ID: "8453",
        NEXT_PUBLIC_DEPLOYMENT_ENV: "mainnet",
        NEXT_PUBLIC_RPC_URL: GATEWAY,
      }),
    ).toMatchObject({ chain: { id: 8453 }, rpcUrl: GATEWAY });
  });

  it("rejects a missing RPC instead of falling back", async () => {
    const { resolveBrowserRpcConfig } = await loadRpcModule();

    expect(() =>
      resolveBrowserRpcConfig({
        NEXT_PUBLIC_CHAIN_ID: "8453",
        NEXT_PUBLIC_DEPLOYMENT_ENV: "mainnet",
      }),
    ).toThrow("public RPC fallback is disabled");
  });

  it.each([undefined, "production"])(
    "rejects missing or unknown deployment env %s",
    async (deploymentEnv) => {
      const { resolveBrowserRpcConfig } = await loadRpcModule();

      expect(() =>
        resolveBrowserRpcConfig({
          NEXT_PUBLIC_CHAIN_ID: "8453",
          NEXT_PUBLIC_DEPLOYMENT_ENV: deploymentEnv,
          NEXT_PUBLIC_RPC_URL: GATEWAY,
        }),
      ).toThrow("NEXT_PUBLIC_DEPLOYMENT_ENV must be");
    },
  );

  it("rejects unsupported chains", async () => {
    const { resolveBrowserRpcConfig } = await loadRpcModule();

    expect(() =>
      resolveBrowserRpcConfig({
        NEXT_PUBLIC_CHAIN_ID: "1",
        NEXT_PUBLIC_DEPLOYMENT_ENV: "mainnet",
        NEXT_PUBLIC_RPC_URL: GATEWAY,
      }),
    ).toThrow("must be 8453");
  });

  it("rejects a non-mainnet chain in a mainnet deployment", async () => {
    const { resolveBrowserRpcConfig } = await loadRpcModule();

    expect(() =>
      resolveBrowserRpcConfig({
        NEXT_PUBLIC_CHAIN_ID: "84532",
        NEXT_PUBLIC_DEPLOYMENT_ENV: "mainnet",
        NEXT_PUBLIC_RPC_URL: GATEWAY,
      }),
    ).toThrow("must use NEXT_PUBLIC_CHAIN_ID=8453");
  });

  it("rejects direct or fallback RPCs in a mainnet deployment", async () => {
    const { resolveBrowserRpcConfig } = await loadRpcModule();

    expect(() =>
      resolveBrowserRpcConfig({
        NEXT_PUBLIC_CHAIN_ID: "8453",
        NEXT_PUBLIC_DEPLOYMENT_ENV: "mainnet",
        NEXT_PUBLIC_RPC_URL: "https://mainnet.base.org",
      }),
    ).toThrow("Mainnet browser reads must use");
  });
});
