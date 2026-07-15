import Image from "next/image";
import { Repeat2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VaultConfig } from "@/lib/vaults";

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
          <Image src="/weth.png" alt="" width={24} height={24} className="size-6" />
        </div>
      </div>
    );
  }

  return (
    <Image
      src={icon === "usdc" ? "/usdc.svg" : "/weth.png"}
      alt=""
      width={160}
      height={160}
      aria-hidden="true"
      className={cn("object-contain", className)}
    />
  );
}
