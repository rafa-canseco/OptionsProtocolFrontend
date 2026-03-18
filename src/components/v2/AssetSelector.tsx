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
import Image from "next/image";
import { ASSETS, ASSET_SLUGS, type AssetConfig } from "@/lib/assets";

const ASSET_LOGOS: Record<string, { src: string; type: "svg" | "png" }> = {
  eth: { src: "/eth.svg", type: "svg" },
  btc: { src: "/cbbtc.png", type: "png" },
};

function AssetIcon({
  slug,
  size = 20,
}: {
  slug: string;
  size?: number;
}) {
  const logo = ASSET_LOGOS[slug];
  if (logo) {
    return (
      <Image
        src={logo.src}
        alt={ASSETS[slug]?.symbol ?? slug}
        width={size}
        height={size}
        className="shrink-0 rounded-full"
      />
    );
  }
  return (
    <div
      className="rounded-full flex items-center justify-center
        text-white font-bold shrink-0 bg-[#888]"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {(ASSETS[slug]?.symbol ?? slug).charAt(0)}
    </div>
  );
}

export function AssetSelector({
  current,
}: {
  current: AssetConfig;
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
                return (
                  <CommandItem
                    key={slug}
                    value={`${asset.symbol} ${asset.name}`}
                    onSelect={() => {
                      if (!isActive) {
                        router.push(`/earn/${slug}`);
                      }
                      setOpen(false);
                    }}
                    className="flex items-center gap-2.5 px-3 py-2.5
                      cursor-pointer text-[var(--text)]
                      data-[selected=true]:bg-[var(--surface)]
                      data-[selected=true]:text-[var(--text)]"
                  >
                    <AssetIcon slug={slug} size={18} />
                    <span className="font-medium">{asset.symbol}</span>
                    <span className="text-xs text-[var(--text-secondary)]">
                      {asset.name}
                    </span>
                    {isActive && (
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
