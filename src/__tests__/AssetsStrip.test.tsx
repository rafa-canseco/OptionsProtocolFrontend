import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AssetsStrip } from "@/components/landing/AssetsStrip";

describe("AssetsStrip", () => {
  it("renders all four asset symbols", () => {
    render(<AssetsStrip />);
    expect(screen.getByText("ETH")).toBeInTheDocument();
    expect(screen.getByText("cbBTC")).toBeInTheDocument();
    expect(screen.getByText("SOL")).toBeInTheDocument();
    expect(screen.getByText("TSLAx")).toBeInTheDocument();
  });

  it("labels each asset with its chain", () => {
    render(<AssetsStrip />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(4);

    const [eth, btc, sol, tslax] = items;
    expect(eth).toHaveTextContent("ETH");
    expect(eth).toHaveTextContent(/base/i);
    expect(btc).toHaveTextContent("cbBTC");
    expect(btc).toHaveTextContent(/base/i);
    expect(sol).toHaveTextContent("SOL");
    expect(sol).toHaveTextContent(/solana/i);
    expect(tslax).toHaveTextContent("TSLAx");
    expect(tslax).toHaveTextContent(/solana/i);
  });

  it("marks TSLAx as new", () => {
    render(<AssetsStrip />);
    const tslaxItem = screen.getByRole("listitem", { name: /tslax/i });
    expect(tslaxItem).toHaveTextContent(/new/i);
  });

  it("only flags TSLAx as new", () => {
    render(<AssetsStrip />);
    const ethItem = screen.getByRole("listitem", { name: /eth on base/i });
    const btcItem = screen.getByRole("listitem", { name: /cbbtc on base/i });
    const solItem = screen.getByRole("listitem", { name: /sol on solana/i });
    expect(ethItem).not.toHaveTextContent(/new/i);
    expect(btcItem).not.toHaveTextContent(/new/i);
    expect(solItem).not.toHaveTextContent(/new/i);
  });

  it("renders a kicker describing scope", () => {
    render(<AssetsStrip />);
    expect(screen.getByText(/four assets/i)).toBeInTheDocument();
    expect(screen.getByText(/two chains/i)).toBeInTheDocument();
  });
});
