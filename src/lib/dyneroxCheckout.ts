export type DyneroxCheckoutDirection = "on-ramp" | "off-ramp";

export interface DyneroxCheckoutConfig {
  baseUrl: string;
  tenantCode: string;
}

interface DyneroxPreviewEnvironment {
  deploymentEnv?: string;
  nodeEnv?: string;
}

const DYNEROX_STAGE_ORIGIN = "https://stage-app.dynerox.com";
const PREVIEW_DEPLOYMENT_ENVS = new Set(["devnet", "staging", "testnet"]);
const TENANT_CODE_PATTERN = /^[A-Za-z0-9_-]+$/;

function isValidTenantCode(tenantCode: string): boolean {
  return TENANT_CODE_PATTERN.test(tenantCode);
}

export function isDyneroxPreviewEnvironment({
  deploymentEnv,
  nodeEnv,
}: DyneroxPreviewEnvironment): boolean {
  if (deploymentEnv === "mainnet") return false;
  return nodeEnv === "development" || PREVIEW_DEPLOYMENT_ENVS.has(deploymentEnv ?? "");
}

function parseStageBaseUrl(rawBaseUrl: string): URL | null {
  try {
    const url = new URL(rawBaseUrl);
    if (
      url.origin !== DYNEROX_STAGE_ORIGIN ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

export function resolveDyneroxCheckoutConfig({
  baseUrl,
  tenantCode,
  deploymentEnv,
  nodeEnv,
}: {
  baseUrl?: string;
  tenantCode?: string;
} & DyneroxPreviewEnvironment): DyneroxCheckoutConfig | null {
  if (!isDyneroxPreviewEnvironment({ deploymentEnv, nodeEnv })) return null;

  if (!tenantCode || !isValidTenantCode(tenantCode) || !parseStageBaseUrl(baseUrl?.trim() ?? "")) {
    return null;
  }

  return {
    baseUrl: DYNEROX_STAGE_ORIGIN,
    tenantCode,
  };
}

export function getDyneroxCheckoutConfig(): DyneroxCheckoutConfig | null {
  return resolveDyneroxCheckoutConfig({
    baseUrl: process.env.NEXT_PUBLIC_DYNEROX_CHECKOUT_BASE_URL,
    tenantCode: process.env.NEXT_PUBLIC_DYNEROX_TENANT_CODE,
    deploymentEnv: process.env.NEXT_PUBLIC_DEPLOYMENT_ENV,
    nodeEnv: process.env.NODE_ENV,
  });
}

export function buildDyneroxCheckoutUrl(
  config: DyneroxCheckoutConfig,
  direction: DyneroxCheckoutDirection,
): string {
  const trustedBaseUrl = parseStageBaseUrl(config.baseUrl);
  const tenantCode = config.tenantCode;
  if (!trustedBaseUrl || !isValidTenantCode(tenantCode)) {
    throw new Error("Dynerox Checkout configuration is invalid.");
  }

  const url = new URL(`/c/${encodeURIComponent(tenantCode)}`, trustedBaseUrl);
  const route = direction === "on-ramp"
    ? {
        fromCurrency: "MXN",
        fromNetwork: "SPEI",
        toCurrency: "USDC",
        toNetwork: "ethereum",
      }
    : {
        fromCurrency: "USDC",
        fromNetwork: "ethereum",
        toCurrency: "MXN",
        toNetwork: "SPEI",
      };

  url.search = new URLSearchParams({
    from_currency: route.fromCurrency,
    from_network: route.fromNetwork,
    to_currency: route.toCurrency,
    to_network: route.toNetwork,
  }).toString();

  return url.toString();
}
