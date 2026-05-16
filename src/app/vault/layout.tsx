import type { Metadata } from "next";
import { NavBar } from "@/components/NavBar";
import { AppFooter } from "@/components/AppFooter";

export const metadata: Metadata = {
  title: "Agent Vault",
  description:
    "Allocate smart wallet USDC into the b1nary Agent Vault and track the Arc lifecycle.",
  openGraph: {
    title: "Agent Vault | b1nary",
    description:
      "Allocate smart wallet USDC into the b1nary Agent Vault and track the Arc lifecycle.",
  },
};

export default function VaultLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="bg-[var(--accent)]/10 text-center py-2 text-xs text-[var(--accent)] font-medium">
        Agora preview
      </div>
      <NavBar />
      <div className="flex-1">{children}</div>
      <AppFooter />
    </div>
  );
}
