import type { Metadata } from "next";
import { NavBar } from "@/components/NavBar";

export const metadata: Metadata = {
  title: "Earn Premium",
  description:
    "Browse live strike prices and earn premium by selling covered options on ETH. Get paid upfront every time.",
  openGraph: {
    title: "Earn Premium | b1nary",
    description:
      "Browse live strike prices and earn premium by selling covered options on ETH. Get paid upfront every time.",
  },
};

export default function EarnLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="bg-[var(--accent)]/10 text-center py-2 text-xs text-[var(--accent)] font-medium">
        Closed Beta. Test tokens, not real money.
      </div>
      <NavBar />
      {children}
    </>
  );
}
