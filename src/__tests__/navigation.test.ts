import { describe, expect, it } from "vitest";
import { TRADING_NAV_LINKS } from "@/lib/navigation";

describe("trading navigation", () => {
  it("provides a direct way back to the v2 vault experience", () => {
    expect(TRADING_NAV_LINKS[0]).toEqual({
      href: "/vaults",
      label: "Vaults v2",
    });
  });
});
