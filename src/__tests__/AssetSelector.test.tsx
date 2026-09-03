import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AssetSelector } from "@/components/v2/AssetSelector";
import { ASSETS } from "@/lib/assets";

const push = vi.fn();
let nvdacCapacity: import("@/lib/api").Capacity | null = null;
beforeAll(() => { Element.prototype.scrollIntoView = vi.fn(); });
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/hooks/useCapacity", () => ({
  useCapacity: () => ({ capacity: nvdacCapacity, loading: false }),
}));

describe("AssetSelector", () => {
  beforeEach(() => {
    push.mockClear();
    nvdacCapacity = null;
  });
  it("shows scalable Base asset details and routes only to an active asset", async () => {
    const user = userEvent.setup();
    render(<AssetSelector current={ASSETS.eth} />);

    const trigger = screen.getByRole("button", { name: "Select asset. Current asset ETH" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveTextContent("Ethereum · Base");

    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveAttribute("aria-current", "page");
    expect(options[0]).toHaveTextContent("ETH");
    expect(options[1]).toHaveTextContent("cbBTC");
    expect(screen.queryByText(/^SOL$/)).not.toBeInTheDocument();
    expect(screen.queryByText("TSLAx")).not.toBeInTheDocument();

    await user.keyboard("{ArrowDown}{Enter}");
    expect(push).toHaveBeenCalledWith("/earn/btc");
  });

  it("exposes canonical Base NVDAc only after affirmative backend and route readiness", async () => {
    nvdacCapacity = {
      capacity: 1,
      capacity_usd: 1,
      market_open: true,
      market_status: "active",
      max_position: 1,
      mm_count: 1,
      updated_at: "2026-09-03T00:00:00Z",
      asset_chain: "base",
      asset_address: ASSETS.nvdac.address,
      backend_ready: true,
      route_active: true,
      route_qualified: true,
      readiness_status: "ready",
    };
    const user = userEvent.setup();
    render(<AssetSelector current={ASSETS.eth} />);

    await user.click(screen.getByRole("button", { name: "Select asset. Current asset ETH" }));
    expect(screen.getByRole("option", { name: /NVDAc/ })).toHaveTextContent("Base · Trading open");
  });

  it("opens and closes from the keyboard and restores focus to the trigger", async () => {
    const user = userEvent.setup();
    render(<AssetSelector current={ASSETS.eth} />);
    const trigger = screen.getByRole("button", { name: "Select asset. Current asset ETH" });

    trigger.focus();
    await user.keyboard("{Enter}");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("combobox", { name: "Search assets" })).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
    expect(push).not.toHaveBeenCalled();
  });
});
