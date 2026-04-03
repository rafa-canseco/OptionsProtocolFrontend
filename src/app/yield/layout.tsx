import type { Metadata } from "next";
import { NavBar } from "@/components/NavBar";
import { AppFooter } from "@/components/AppFooter";

export const metadata: Metadata = {
  title: "Yield | b1nary",
  description:
    "Track your Aave yield earned on collateral. View pending and delivered distributions.",
};

export default function YieldLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <div className="flex-1">{children}</div>
      <AppFooter />
    </div>
  );
}
