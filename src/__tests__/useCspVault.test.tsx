import { act, renderHook } from "@testing-library/react";
import type { Address } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCspVault } from "@/hooks/useCspVault";

const mocks = vi.hoisted(() => ({
  getVault: vi.fn(),
  getPosition: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  api: {
    getCspVault: mocks.getVault,
    getCspVaultPosition: mocks.getPosition,
  },
}));

vi.mock("@/lib/cspVault", () => ({
  CSP_VAULT_KEY: "base-sepolia:eth-usdc-csp",
  CSP_VAULT_ADDRESS: "0x1111111111111111111111111111111111111111",
  assertCspSnapshotTrusted: vi.fn(),
}));

const USER = "0x4444444444444444444444444444444444444444" as Address;

async function flushRequests() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("useCspVault refresh policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getVault.mockResolvedValue({ vaultKey: "base-sepolia:eth-usdc-csp" });
    mocks.getPosition.mockResolvedValue({ address: USER });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("refreshes on lifecycle events and manual requests without polling", async () => {
    const intervalSpy = vi.spyOn(window, "setInterval");
    const { result, rerender } = renderHook(
      ({ address }: { address: Address | undefined }) => useCspVault(address),
      { initialProps: { address: undefined as Address | undefined } },
    );

    await flushRequests();
    expect(mocks.getVault).toHaveBeenCalledTimes(1);
    expect(mocks.getPosition).not.toHaveBeenCalled();

    rerender({ address: USER });
    await flushRequests();
    expect(mocks.getPosition).toHaveBeenCalledTimes(1);

    act(() => window.dispatchEvent(new Event("focus")));
    await flushRequests();
    expect(mocks.getPosition).toHaveBeenCalledTimes(2);

    const visibilitySpy = vi.spyOn(document, "visibilityState", "get");
    visibilitySpy.mockReturnValue("hidden");
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(mocks.getPosition).toHaveBeenCalledTimes(2);

    visibilitySpy.mockReturnValue("visible");
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    await flushRequests();
    expect(mocks.getPosition).toHaveBeenCalledTimes(3);

    await act(async () => result.current.refetch());
    expect(mocks.getPosition).toHaveBeenCalledTimes(4);

    act(() => window.dispatchEvent(new Event("csp-vault:refetch")));
    await flushRequests();
    expect(mocks.getPosition).toHaveBeenCalledTimes(5);

    expect(intervalSpy).not.toHaveBeenCalled();
  });
});
