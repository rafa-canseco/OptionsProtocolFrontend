"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronsUpDown, Check } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { ASSETS, ASSET_SLUGS, type AssetConfig } from "@/lib/assets";

const ASSET_COLORS: Record<string, string> = {
  eth: "#627eea",
  btc: "#f7931a",
};

function AssetIcon({
  slug,
  size = 20,
}: {
  slug: string;
  size?: number;
}) {
  const color = ASSET_COLORS[slug] ?? "#888";
  const symbol = ASSETS[slug]?.symbol ?? slug.toUpperCase();
  return (
    <div
      className="rounded-full flex items-center justify-center
        text-white font-bold shrink-0"
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        fontSize: size * 0.4,
      }}
    >
      {symbol.charAt(0)}
    </div>
  );
}

export function AssetSelector({
  current,
  spot,
}: {
  current: AssetConfig;
  spot?: number;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="flex items-center gap-2.5 rounded-xl border
            border-[var(--border)] bg-[var(--surface)] px-4 py-2.5
            hover:border-[var(--accent)] transition-colors duration-200"
        >
          <AssetIcon slug={current.slug} />
          <span className="text-base font-semibold text-[var(--bone)]">
            {current.symbol}
          </span>
          {spot != null && (
            <span className="text-sm text-[var(--text-secondary)] font-mono">
              ${spot.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          )}
          <ChevronsUpDown className="size-4 text-[var(--text-secondary)]" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[220px] p-0 border-[var(--border)]
          bg-[var(--bg)]"
        align="start"
      >
        <Command className="bg-transparent">
          <CommandInput
            placeholder="Search asset..."
            className="text-[var(--text)]"
          />
          <CommandList>
            <CommandEmpty className="text-[var(--text-secondary)]">
              No asset found.
            </CommandEmpty>
            <CommandGroup>
              {ASSET_SLUGS.map((slug) => {
                const asset = ASSETS[slug];
                const isActive = slug === current.slug;
                const disabled = !!asset.comingSoon;
                return (
                  <CommandItem
                    key={slug}
                    value={`${asset.symbol} ${asset.name}`}
                    disabled={disabled}
                    onSelect={() => {
                      if (disabled) return;
                      if (!isActive) {
                        router.push(`/earn/${slug}`);
                      }
                      setOpen(false);
                    }}
                    className={`flex items-center gap-2.5 px-3 py-2.5
                      text-[var(--text)]
                      data-[selected=true]:bg-[var(--surface)]
                      ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <AssetIcon slug={slug} size={18} />
                    <span className="font-medium">{asset.symbol}</span>
                    <span className="text-xs text-[var(--text-secondary)]">
                      {asset.name}
                    </span>
                    {disabled && (
                      <span className="ml-auto text-[10px] font-medium
                        text-[var(--text-secondary)] bg-[var(--surface)]
                        px-1.5 py-0.5 rounded">
                        Soon
                      </span>
                    )}
                    {!disabled && isActive && (
                      <Check className="ml-auto size-4 text-[var(--accent)]" />
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export { AssetIcon };
