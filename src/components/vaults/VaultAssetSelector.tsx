"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { ASSETS } from "@/lib/assets";
import { VAULT_CATALOG_ASSET_SLUGS } from "@/lib/vaults";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { VaultIcon } from "./VaultIcon";

export function VaultAssetSelector({
  currentSlug,
  onChange,
}: {
  currentSlug: string;
  onChange: (slug: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = ASSETS[currentSlug] ?? ASSETS.eth;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Select vault asset. Current asset ${current.symbol}`}
          className="flex min-h-11 items-center gap-2.5 rounded-full border border-[var(--vault-border-strong)] bg-[var(--vault-surface)] px-3.5 text-sm font-semibold text-[var(--vault-text)] transition-colors hover:border-[var(--vault-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vault-accent)]"
        >
          <VaultIcon icon={current.slug} className="size-6" />
          <span>{current.symbol}</span>
          <ChevronDown
            aria-hidden="true"
            className={`size-3.5 text-[var(--vault-text-subtle)] transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        aria-label="Available vault assets"
        className="w-72 border-[var(--vault-border)] bg-[var(--vault-surface)] p-2 text-[var(--vault-text)]"
      >
        <p className="px-2 pb-2 pt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--vault-text-subtle)]">
          Base assets
        </p>
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {VAULT_CATALOG_ASSET_SLUGS.map((slug) => {
            const asset = ASSETS[slug];
            const selected = slug === current.slug;
            return (
              <button
                key={slug}
                type="button"
                aria-label={`Select ${asset.symbol}`}
                aria-pressed={selected}
                onClick={() => {
                  onChange(slug);
                  setOpen(false);
                }}
                className="flex min-h-12 w-full items-center gap-3 rounded-xl px-2.5 text-left transition-colors hover:bg-[var(--vault-surface-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--vault-accent)]"
              >
                <VaultIcon icon={slug} className="size-7" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{asset.symbol}</span>
                  <span className="block truncate text-[11px] text-[var(--vault-text-subtle)]">
                    {asset.name}
                  </span>
                </span>
                {selected ? (
                  <Check
                    aria-hidden="true"
                    className="size-4 text-[var(--vault-accent)]"
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
