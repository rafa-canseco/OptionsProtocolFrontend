"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "./ConnectButton";

const LINKS = [
  { href: "/earn", label: "Earn" },
  { href: "/positions", label: "My earnings" },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
      <div className="flex items-center gap-6">
        <Link href="/" className="text-lg font-bold tracking-tight text-[var(--text)]">
          loot
        </Link>
        <nav className="flex gap-4 text-sm">
          {LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`transition-colors ${
                pathname === href
                  ? "text-[var(--text)] font-medium"
                  : "text-[var(--text-secondary)] hover:text-[var(--text)]"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
      <ConnectButton />
    </header>
  );
}
