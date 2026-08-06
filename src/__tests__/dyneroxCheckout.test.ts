import { describe, expect, it } from "vitest";
import {
  buildDyneroxCheckoutUrl,
  isDyneroxPreviewEnvironment,
  resolveDyneroxCheckoutConfig,
} from "@/lib/dyneroxCheckout";

const CONFIG = {
  baseUrl: "https://stage-app.dynerox.com",
  tenantCode: "tenbin",
};

describe("Dynerox Checkout preview", () => {
  it("builds the documented on-ramp corridor", () => {
    expect(buildDyneroxCheckoutUrl(CONFIG, "on-ramp")).toBe(
      "https://stage-app.dynerox.com/c/tenbin?from_currency=MXN&from_network=SPEI&to_currency=USDC&to_network=ethereum",
    );
  });

  it("builds the documented off-ramp corridor", () => {
    expect(buildDyneroxCheckoutUrl(CONFIG, "off-ramp")).toBe(
      "https://stage-app.dynerox.com/c/tenbin?from_currency=USDC&from_network=ethereum&to_currency=MXN&to_network=SPEI",
    );
  });

  it("accepts a conservative tenant code as exactly one path segment", () => {
    expect(
      buildDyneroxCheckoutUrl(
        { ...CONFIG, tenantCode: "b1nary_stage-1" },
        "on-ramp",
      ),
    ).toContain("/c/b1nary_stage-1?");
  });

  it.each([".", "..", "tenant.name", "tenant/name", " tenant", "tenant ", "tenant%2Fname"])(
    "rejects unsafe tenant path value %s",
    (tenantCode) => {
      expect(
        resolveDyneroxCheckoutConfig({
          ...CONFIG,
          tenantCode,
          deploymentEnv: "testnet",
          nodeEnv: "production",
        }),
      ).toBeNull();
      expect(() =>
        buildDyneroxCheckoutUrl({ ...CONFIG, tenantCode }, "on-ramp"),
      ).toThrow("Dynerox Checkout configuration is invalid.");
    },
  );

  it("fails closed for untrusted or malformed Checkout hosts", () => {
    for (const baseUrl of [
      "http://stage-app.dynerox.com",
      "https://stage-app.dynerox.com.evil.example",
      "https://stage-app.dynerox.com/checkout",
      "not-a-url",
    ]) {
      expect(
        resolveDyneroxCheckoutConfig({
          baseUrl,
          tenantCode: "tenbin",
          deploymentEnv: "testnet",
          nodeEnv: "production",
        }),
      ).toBeNull();
    }
  });

  it("is enabled only for configured local or preview deployments", () => {
    expect(
      isDyneroxPreviewEnvironment({
        deploymentEnv: "testnet",
        nodeEnv: "production",
      }),
    ).toBe(true);
    expect(
      isDyneroxPreviewEnvironment({
        deploymentEnv: undefined,
        nodeEnv: "development",
      }),
    ).toBe(true);
    expect(
      isDyneroxPreviewEnvironment({
        deploymentEnv: "mainnet",
        nodeEnv: "development",
      }),
    ).toBe(false);
    expect(
      isDyneroxPreviewEnvironment({
        deploymentEnv: undefined,
        nodeEnv: "production",
      }),
    ).toBe(false);
  });

  it("requires both public configuration values", () => {
    expect(
      resolveDyneroxCheckoutConfig({
        baseUrl: CONFIG.baseUrl,
        deploymentEnv: "testnet",
        nodeEnv: "production",
      }),
    ).toBeNull();
    expect(
      resolveDyneroxCheckoutConfig({
        tenantCode: CONFIG.tenantCode,
        deploymentEnv: "testnet",
        nodeEnv: "production",
      }),
    ).toBeNull();
  });
});
