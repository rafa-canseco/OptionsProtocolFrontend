"use client";

import Image from "next/image";
import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ACTIVE_ASSET_SLUGS, ASSETS, GATED_BASE_ASSET_SLUGS, type AssetConfig } from "@/lib/assets";
import { useCapacity } from "@/hooks/useCapacity";
import { getAssetActionBlockReason } from "@/lib/marketState";

const ASSET_LOGOS: Record<string, string> = {
  eth: "/eth.png",
  btc: "/cbbtc.webp",
};

function AssetIcon({ slug, size = 20 }: { slug: string; size?: number }) {
  const logo = ASSET_LOGOS[slug];
  return logo ? (
    <Image
      src={logo}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className="shrink-0 rounded-full"
    />
  ) : (
    <span
      aria-hidden="true"
      style={{ width: size, height: size }}
      className="grid shrink-0 place-items-center rounded-full bg-emerald-400/15 text-[9px] font-bold text-emerald-300"
    >
      {ASSETS[slug]?.symbol.charAt(0) ?? "?"}
    </span>
  );
}

export function AssetSelector({ current }: { current: AssetConfig }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { capacity: nvdacCapacity } = useCapacity("nvdac");
  const { capacity: cbzecCapacity } = useCapacity("cbzec");
  const { capacity: cbhypeCapacity } = useCapacity("cbhype");
  const { capacity: vvvCapacity } = useCapacity("vvv");
  const capacities = {
    nvdac: nvdacCapacity,
    cbzec: cbzecCapacity,
    cbhype: cbhypeCapacity,
    vvv: vvvCapacity,
  };
  const visibleSlugs = [
    ...ACTIVE_ASSET_SLUGS,
    ...GATED_BASE_ASSET_SLUGS.filter(
      (slug) => !getAssetActionBlockReason(ASSETS[slug], capacities[slug]),
    ),
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Select asset. Current asset ${current.symbol}`}
          aria-expanded={open}
          className="flex min-h-11 max-w-full items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 text-left transition-[border-color,transform] duration-150 hover:border-[var(--accent)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          <AssetIcon slug={current.slug} />
          <span className="min-w-0">
            <span className="block truncate text-base font-semibold text-[var(--bone)]">{current.symbol}</span>
            <span className="block truncate text-[10px] text-[var(--text-secondary)]">{current.name} · Base</span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-[var(--text-secondary)]" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(22rem,calc(100vw-2rem))] border-[var(--border)] bg-[var(--bg)] p-0" align="start">
        <Command label="Search assets" className="bg-transparent">
          <CommandInput placeholder="Search assets" aria-label="Search assets" className="text-[var(--text)]" />
          <CommandList>
            <CommandEmpty className="text-[var(--text-secondary)]">No asset found.</CommandEmpty>
            <CommandGroup heading="Available on Base">
              {visibleSlugs.map((slug) => {
                const asset = ASSETS[slug];
                const isActive = slug === current.slug;
                return (
                  <CommandItem
                    key={slug}
                    value={`${asset.symbol} ${asset.name} Base`}
                    aria-current={isActive ? "page" : undefined}
                    onSelect={() => {
                      if (!isActive) router.push(`/earn/${slug}`);
                      setOpen(false);
                    }}
                    className="min-h-14 cursor-pointer gap-3 px-3 text-[var(--text)] data-[selected=true]:bg-[var(--surface)] data-[selected=true]:text-[var(--text)]"
                  >
                    <AssetIcon slug={slug} size={24} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className="font-semibold">{asset.symbol}</span>
                        <span className="truncate text-xs text-[var(--text-secondary)]">{asset.name}</span>
                      </span>
                      <span className="text-[10px] font-medium text-blue-400">Base · Trading open</span>
                    </span>
                    {isActive ? <Check className="size-4 shrink-0 text-[var(--accent)]" aria-label="Selected" /> : null}
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
