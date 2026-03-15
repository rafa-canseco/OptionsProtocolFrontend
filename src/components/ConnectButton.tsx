"use client";

import { useState, useRef, useEffect } from "react";
import { useWallet } from "@/hooks/useWallet";

export function ConnectButton() {
  const { address, isConnected, isReady, login, logout } = useWallet();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  if (!isReady) return <div className="h-9 w-24 animate-pulse rounded-full bg-[var(--surface)]" />;

  if (isConnected && address) {
    const short = `${address.slice(0, 6)}...${address.slice(-4)}`;

    return (
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          className="rounded-full border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text)] hover:border-[var(--text-secondary)] transition-colors flex items-center gap-1.5"
        >
          <img src="/base.svg" alt="Base" className="w-4 h-4" />
          {short}
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-[var(--border)] bg-[var(--bg)] shadow-lg overflow-hidden z-50">
            <button
              onClick={() => {
                navigator.clipboard.writeText(address);
                setOpen(false);
              }}
              className="w-full px-4 py-2.5 text-left text-sm text-[var(--text-secondary)] hover:bg-[var(--surface)] hover:text-[var(--text)] transition-colors"
            >
              Copy address
            </button>
            <button
              onClick={() => {
                setOpen(false);
                logout();
              }}
              className="w-full px-4 py-2.5 text-left text-sm text-[var(--danger)] hover:bg-[var(--surface)] transition-colors"
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={login}
      className="rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-[var(--bg)] hover:bg-[var(--accent-hover)] transition-colors"
    >
      Connect
    </button>
  );
}
