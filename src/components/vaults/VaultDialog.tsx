"use client";

import { useEffect, useState } from "react";
import { ArrowRight, ChevronDown, Info, X } from "lucide-react";
import type { VaultConfig } from "@/lib/vaults";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { VaultIcon } from "./VaultIcon";

type VaultAction = "deposit" | "withdraw";

const usdCompact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const amount = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

export function VaultDialog({
  vault,
  open,
  onOpenChange,
}: {
  vault: VaultConfig | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [action, setAction] = useState<VaultAction>("deposit");
  const [value, setValue] = useState("");
  const [strategyOpen, setStrategyOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setAction("deposit");
      setValue("");
      setStrategyOpen(false);
    }
  }, [open]);

  if (!vault) return null;

  const asset = vault.asset === "USDC + WETH" ? "USDC" : vault.asset;
  const numericValue = Number(value);
  const canSubmit = Number.isFinite(numericValue) && numericValue > 0;
  const available = action === "deposit" ? vault.availableBalance : vault.balance;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="vault-dialog max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-[1180px] overflow-y-auto rounded-[28px] border border-[var(--vault-border-strong)] bg-[var(--vault-bg)] p-0 shadow-[0_28px_90px_rgb(0_0_0_/_0.62),0_0_0_1px_rgb(34_211_238_/_0.08)] ring-1 ring-white/[0.04] sm:max-w-[1180px]"
      >
        <DialogTitle className="sr-only">Manage {vault.name}</DialogTitle>
        <DialogDescription className="sr-only">
          Deposit into or withdraw from the {vault.name} vault.
        </DialogDescription>
        <DialogClose asChild>
          <button
            type="button"
            aria-label="Close vault"
            className="absolute right-4 top-4 z-20 grid size-11 place-items-center rounded-full border border-[var(--vault-border)] bg-[var(--vault-surface-soft)] text-[var(--vault-text-muted)] transition-colors hover:text-[var(--vault-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vault-accent)]"
          >
            <X className="size-5" />
          </button>
        </DialogClose>

        <div className="grid lg:grid-cols-[0.86fr_1.14fr]">
          <section className="border-b border-[var(--vault-border)] p-6 sm:p-8 lg:border-b-0 lg:border-r lg:p-10">
            <div className="flex items-center gap-5">
              <VaultIcon icon={vault.icon} className="size-20 shrink-0 sm:size-24" />
              <div>
                <p className="text-sm text-[var(--vault-text-muted)]">Your assets</p>
                <p className="mt-1 font-mono text-3xl font-medium tracking-[-0.04em] text-[var(--vault-text)] sm:text-4xl">
                  {amount.format(vault.balance)} {asset}
                </p>
                <p className="mt-1 font-mono text-sm text-[var(--vault-text-subtle)]">
                  $0.00
                </p>
              </div>
            </div>

            <dl className="mt-8 grid grid-cols-2 gap-6">
              <div>
                <dt className="text-sm text-[var(--vault-text-muted)]">Est. APY</dt>
                <dd className="mt-2 font-mono text-2xl text-[var(--vault-text)]">
                  {vault.apy?.toFixed(2) ?? "—"}%
                </dd>
              </div>
              <div>
                <dt className="text-sm text-[var(--vault-text-muted)]">Vault total</dt>
                <dd className="mt-2 font-mono text-2xl text-[var(--vault-text)]">
                  {usdCompact.format(vault.totalManagedUsd)}
                </dd>
              </div>
            </dl>

            <Collapsible
              open={strategyOpen}
              onOpenChange={setStrategyOpen}
              className="mt-8"
            >
              <CollapsibleTrigger className="flex min-h-11 items-center gap-3 rounded-xl text-sm font-medium text-[var(--vault-text-muted)] transition-colors hover:text-[var(--vault-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vault-accent)]">
                View strategy details
                <span className="grid size-8 place-items-center rounded-full border border-[var(--vault-border)] bg-[var(--vault-surface-soft)]">
                  <ChevronDown
                    className={`size-4 transition-transform duration-200 ${
                      strategyOpen ? "rotate-180" : ""
                    }`}
                  />
                </span>
              </CollapsibleTrigger>
              <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
                <div className="mt-3 rounded-2xl border border-[var(--vault-border-strong)] bg-[linear-gradient(180deg,rgb(21_25_32_/_0.98),rgb(12_15_20_/_0.98))] p-4 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.04)]">
                  <p className="text-sm leading-6 text-[var(--vault-text-muted)]">
                    {vault.strategySummary}
                  </p>
                  <div
                    className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]"
                    aria-label={`${vault.name} strategy flow`}
                  >
                    {vault.strategyFlow.map((step, index) => (
                      <div key={step.label} className="contents">
                        <div className="rounded-xl border border-[var(--vault-border)] bg-[rgb(8_9_11_/_0.62)] p-3">
                          <p className="font-mono text-[11px] uppercase text-[var(--vault-accent)]">
                            {step.label}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-[var(--vault-text-subtle)]">
                            {step.detail}
                          </p>
                        </div>
                        {index < vault.strategyFlow.length - 1 ? (
                          <div className="grid place-items-center text-[var(--vault-text-subtle)] max-sm:hidden">
                            <ArrowRight className="size-4" aria-hidden="true" />
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                  <ol className="mt-4 space-y-3">
                    {vault.strategySteps.map((step, index) => (
                      <li key={step} className="flex items-start gap-3 text-sm text-[var(--vault-text-muted)]">
                        <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[var(--vault-accent-dim)] font-mono text-[11px] text-[var(--vault-accent)]">
                          {index + 1}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ol>
                  <p className="mt-4 border-t border-[var(--vault-border)] pt-4 text-xs leading-5 text-[var(--vault-text-subtle)]">
                    {vault.riskNote}
                  </p>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </section>

          <section className="p-6 sm:p-8 lg:p-10">
            <div
              className="inline-grid grid-cols-2 rounded-2xl bg-[var(--vault-surface-soft)] p-1"
              role="tablist"
              aria-label="Vault action"
            >
              {(["deposit", "withdraw"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  role="tab"
                  aria-selected={action === item}
                  onClick={() => {
                    setAction(item);
                    setValue("");
                  }}
                  className={`min-h-11 rounded-xl px-7 text-sm font-medium capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vault-accent)] ${
                    action === item
                      ? "bg-[var(--vault-selected)] text-[var(--vault-text)]"
                      : "text-[var(--vault-text-muted)] hover:text-[var(--vault-text)]"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>

            <div className="mt-8 flex items-center justify-between gap-4 text-sm">
              <label htmlFor="vault-amount" className="font-medium text-[var(--vault-text-muted)]">
                {action === "deposit" ? "Deposit" : "Withdraw"}
              </label>
              <div className="flex items-center gap-3 font-mono text-[var(--vault-text)]">
                <span>{amount.format(available)} {asset}</span>
                <button
                  type="button"
                  onClick={() => setValue(String(available))}
                  className="min-h-11 rounded-lg px-1 text-[var(--vault-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vault-accent)]"
                >
                  MAX
                </button>
              </div>
            </div>

            <div className="mt-3 flex min-h-24 items-center gap-3 rounded-[22px] border border-[var(--vault-border-strong)] bg-[var(--vault-surface-soft)] px-5 focus-within:border-[var(--vault-accent)] focus-within:ring-1 focus-within:ring-[var(--vault-accent)]">
              <input
                id="vault-amount"
                value={value}
                onChange={(event) => setValue(event.target.value.replace(/[^0-9.]/g, ""))}
                inputMode="decimal"
                autoComplete="off"
                placeholder="0.00"
                aria-describedby="vault-cycle-note"
                className="min-w-0 flex-1 bg-transparent font-mono text-3xl text-[var(--vault-text)] outline-none placeholder:text-[var(--vault-text-subtle)]"
              />
              <span className="font-mono text-base text-[var(--vault-text)]">{asset}</span>
            </div>

            <button
              type="button"
              disabled={!canSubmit}
              className="mt-6 min-h-14 w-full rounded-2xl border border-[var(--vault-accent)] text-base font-semibold text-[var(--vault-accent)] transition-colors hover:bg-[var(--vault-accent-dim)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vault-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--vault-bg)] disabled:cursor-not-allowed disabled:border-[var(--vault-border)] disabled:text-[var(--vault-text-subtle)]"
            >
              {action === "deposit" ? "Deposit" : "Request withdrawal"}
            </button>
          </section>
        </div>

        <div
          id="vault-cycle-note"
          className="mx-6 mb-6 flex items-start gap-3 rounded-2xl border border-[var(--vault-border)] bg-[var(--vault-surface-soft)] px-4 py-3 text-sm leading-6 text-[var(--vault-text-muted)] sm:mx-8 sm:mb-8 lg:mx-10"
        >
          <Info className="mt-0.5 size-4 shrink-0 text-[var(--vault-accent)]" />
          <span>
            Deposits join the next vault cycle. Exit requests settle at the end of the current epoch.
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
