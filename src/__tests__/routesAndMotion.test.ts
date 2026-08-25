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
  it("removes movement, continuous loading motion, and dialog/popover animation", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    const reducedMotion = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));

    expect(reducedMotion).toContain(".animate-shimmer-pulse");
    expect(reducedMotion).toContain(".animate-ping");
    expect(reducedMotion).toContain(".animate-pulse");
    expect(reducedMotion).toContain('[data-slot="dialog-content"]');
    expect(reducedMotion).toContain('[data-slot="popover-content"]');
    expect(reducedMotion).toContain("animation: none !important");
    expect(reducedMotion).toContain("transform: none !important");
  });
});
