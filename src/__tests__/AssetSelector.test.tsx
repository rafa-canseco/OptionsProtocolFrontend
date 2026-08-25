import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AssetSelector } from "@/components/v2/AssetSelector";
import { ASSETS } from "@/lib/assets";

const push = vi.fn();
beforeAll(() => { Element.prototype.scrollIntoView = vi.fn(); });
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

describe("AssetSelector", () => {
  beforeEach(() => push.mockClear());
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
