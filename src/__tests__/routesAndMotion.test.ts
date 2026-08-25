import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

const { redirect } = vi.hoisted(() => ({ redirect: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect }));

describe("primary route redirects", () => {
  it("routes root, Earn index, and My Vaults to their approved destinations", async () => {
    const [{ default: Home }, { default: Earn }, { default: MyVaults }] = await Promise.all([
      import("@/app/page"),
      import("@/app/earn/page"),
      import("@/app/vaults/my/page"),
    ]);

    Home();
    Earn();
    MyVaults();
    expect(redirect.mock.calls).toEqual([
      ["/earn/eth"],
      ["/earn/eth"],
      ["/vaults"],
    ]);
  });
});

describe("reduced motion contract", () => {
  it("removes movement from active overlays while retaining non-motion feedback elsewhere", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    const reducedMotion = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));

    expect(reducedMotion).toContain(".animate-shimmer-pulse");
    expect(reducedMotion).toContain(".animate-ping");
    expect(reducedMotion).toContain(".animate-pulse");
    for (const slot of [
      "dialog-content",
      "popover-content",
      "sheet-overlay",
      "sheet-content",
      "tooltip-content",
    ]) {
      expect(reducedMotion).toContain(`[data-slot="${slot}"]`);
    }
    expect(reducedMotion).toContain("animation: none !important");
    expect(reducedMotion).toContain("transition: none !important");
    expect(reducedMotion).toMatch(
      /\[data-slot="sheet-content"\],[\s\S]*?\[data-slot="tooltip-content"\][\s\S]*?transform: none !important/,
    );
  });
});
