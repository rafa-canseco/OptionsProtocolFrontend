import Image from "next/image";
import { Repeat2 } from "lucide-react";
import { cn } from "@/lib/utils";

function EthMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      aria-hidden="true"
      className={cn("drop-shadow-[0_18px_34px_rgb(59_130_246_/_0.28)]", className)}
    >
      <path d="M60 8 24 66l36-16 36 16L60 8Z" fill="#6f8fff" />
      <path d="M24 66 60 50v-42L24 66Z" fill="#9db5ff" opacity="0.95" />
      <path d="M60 50v-42l36 58-36-16Z" fill="#627fea" opacity="0.92" />
      <path d="M60 57 24 73l36 39 36-39-36-16Z" fill="#5f7af2" />
      <path d="M24 73 60 89v23L24 73Z" fill="#3046a7" opacity="0.9" />
      <path d="M60 89 96 73l-36 39V89Z" fill="#7695ff" opacity="0.92" />
    </svg>
  );
}

export function VaultIcon({
  icon,
  className,
}: {
  icon: string;
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

  if (icon === "usdc" || icon === "btc") {
    return (
      <Image
        src={icon === "usdc" ? "/usdc.svg" : "/cbbtc.webp"}
        alt=""
        width={160}
        height={160}
        aria-hidden="true"
        className={cn("rounded-full object-contain", className)}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid place-items-center rounded-full bg-[var(--vault-selected)] font-mono text-sm font-bold uppercase text-[var(--vault-text-muted)]",
        className,
      )}
    >
      {icon.charAt(0)}
    </span>
  );
}
