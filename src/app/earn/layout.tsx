import { NavBar } from "@/components/NavBar";

export default function EarnLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="bg-[var(--accent)]/10 text-center py-2 text-xs text-[var(--accent)] font-medium">
        Closed Beta — Test tokens, not real money
      </div>
      <NavBar />
      {children}
    </>
  );
}
