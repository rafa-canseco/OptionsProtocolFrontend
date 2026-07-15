import Image from "next/image";
import { Repeat2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VaultConfig } from "@/lib/vaults";

function EthMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      aria-hidden="true"
      className={cn("drop-shadow-[0_18px_34px_rgb(59_130_246_/_0.28)]", className)}
    >
      <defs>
        <linearGradient id="eth-mark-top" x1="22" x2="98" y1="18" y2="96">
          <stop stopColor="#c7d7ff" />
          <stop offset="0.54" stopColor="#6f8fff" />
          <stop offset="1" stopColor="#3b57c4" />
        </linearGradient>
        <linearGradient id="eth-mark-bottom" x1="36" x2="84" y1="62" y2="108">
          <stop stopColor="#425cc8" />
          <stop offset="1" stopColor="#85a2ff" />
        </linearGradient>
      </defs>
      <path d="M60 8 24 66l36-16 36 16L60 8Z" fill="url(#eth-mark-top)" />
      <path d="M24 66 60 50v-42L24 66Z" fill="#9db5ff" opacity="0.95" />
      <path d="M60 50v-42l36 58-36-16Z" fill="#627fea" opacity="0.92" />
      <path d="M60 57 24 73l36 39 36-39-36-16Z" fill="url(#eth-mark-bottom)" />
      <path d="M24 73 60 89v23L24 73Z" fill="#3046a7" opacity="0.9" />
      <path d="M60 89 96 73l-36 39V89Z" fill="#7695ff" opacity="0.92" />
    </svg>
  );
}

export function VaultIcon({
  icon,
  className,
}: {
  icon: VaultConfig["icon"];
  className?: string;
}) {
  if (icon === "wheel") {
    return (
      <div
        className={cn(
          "relative grid place-items-center rounded-full border border-[var(--vault-border-strong)] bg-[var(--vault-surface-soft)]",
          className,
        )}
        aria-hidden="true"
      >
        <Repeat2 className="absolute size-[72%] text-[var(--vault-text-muted)]" strokeWidth={1.4} />
        <div className="relative z-10 flex items-center gap-1 rounded-full border border-[var(--vault-border)] bg-[var(--vault-bg)] p-2">
          <Image src="/usdc.svg" alt="" width={24} height={24} className="size-6" />
          <EthMark className="size-6" />
        </div>
      </div>
    );
  }

  if (icon === "eth") {
    return <EthMark className={className} />;
  }

  return (
    <Image
      src="/usdc.svg"
      alt=""
      width={160}
      height={160}
      aria-hidden="true"
      className={cn("object-contain", className)}
    />
  );
}
