import { describe, expect, it } from "vitest";
import { TRADING_NAV_LINKS } from "@/lib/navigation";

import { ACTIVE_ASSET_SLUGS, getDefaultAssetSlug, isActiveAssetSlug } from "@/lib/assets";

describe("reopened trading navigation", () => {
  it("prioritizes Earn and Positions and marks vaults as secondary", () => {
    expect(TRADING_NAV_LINKS.map(({ href, label, primary }) => ({ href, label, primary }))).toEqual([
      { href: "/earn/eth", label: "Earn", primary: true },
      { href: "/positions", label: "Positions", primary: true },
      { href: "/vaults", label: "Vaults · Soon", primary: false },
    ]);
  });

  it("exposes only ETH and cbBTC and always defaults to ETH", () => {
    expect(ACTIVE_ASSET_SLUGS).toEqual(["eth", "btc"]);
    expect(isActiveAssetSlug("eth")).toBe(true);
    expect(isActiveAssetSlug("btc")).toBe(true);
    expect(isActiveAssetSlug("sol")).toBe(false);
    expect(isActiveAssetSlug("tslax")).toBe(false);
    expect(getDefaultAssetSlug("solana.b1nary.app")).toBe("eth");
  });
});
