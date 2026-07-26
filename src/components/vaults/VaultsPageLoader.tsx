"use client";

import dynamic from "next/dynamic";

const VaultsPage = dynamic(
  () => import("./VaultsPage").then((module) => module.VaultsPage),
  {
    ssr: false,
    loading: () => (
      <div className="vault-experience min-h-dvh bg-[var(--vault-bg)] text-[var(--vault-text)]">
        <header className="border-b border-[var(--vault-border)]">
          <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
            <div className="h-7 w-28 rounded-full bg-[var(--vault-surface-soft)]" />
            <div className="h-11 w-24 rounded-full bg-[var(--vault-surface-soft)]" />
          </div>
        </header>
        <main className="mx-auto max-w-[1280px] px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
          <div className="mb-8 sm:mb-10">
            <div className="h-3 w-44 rounded-full bg-[var(--vault-surface-soft)]" />
            <div className="mt-4 h-12 w-40 rounded-2xl bg-[var(--vault-surface-soft)]" />
            <div className="mt-4 h-5 w-full max-w-xl rounded-full bg-[var(--vault-surface-soft)]" />
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            <div className="min-h-[520px] rounded-[32px] border border-[var(--vault-border)] bg-[var(--vault-card)]" />
            <div className="min-h-[520px] rounded-[32px] border border-[var(--vault-border)] bg-[var(--vault-card)]" />
            <div className="min-h-[520px] rounded-[32px] border border-[var(--vault-border)] bg-[var(--vault-card)]" />
          </div>
        </main>
      </div>
    ),
  },
);

export function VaultsPageLoader({ view = "catalog" }: { view?: "catalog" | "my" }) {
  return <VaultsPage view={view} />;
}
