import Image from "next/image";
import Link from "next/link";

const PREVIEWS = [
  {
    symbol: "ETH",
    icon: "/eth.png",
    title: "ETH Cash-Secured Put",
    collateral: "USDC",
    description: "Earn income while waiting to buy ETH at a lower price.",
  },
  {
    symbol: "ETH",
    icon: "/eth.png",
    title: "ETH Covered Call",
    collateral: "WETH",
    description: "Earn income on ETH you already own.",
  },
  {
    symbol: "cbBTC",
    icon: "/cbbtc.webp",
    title: "cbBTC Cash-Secured Put",
    collateral: "USDC",
    description: "Earn income while waiting to buy cbBTC at a lower price.",
  },
  {
    symbol: "cbBTC",
    icon: "/cbbtc.webp",
    title: "cbBTC Covered Call",
    collateral: "cbBTC",
    description: "Earn income on cbBTC you already own.",
  },
] as const;

export function VaultsPage({ view: _view }: { view?: "catalog" | "my" } = {}) {
  void _view;
  return (
    <div className="vault-experience min-h-dvh bg-[var(--vault-bg)] text-[var(--vault-text)]">
      <header className="border-b border-[var(--vault-border)]">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/earn/eth" className="font-mono text-lg font-bold tracking-[-0.04em] text-[var(--bone)]">
            b<span className="text-[var(--vault-accent)]">1</span>nary
          </Link>
          <nav aria-label="Primary navigation" className="flex items-center gap-1 text-sm">
            <Link href="/earn/eth" className="flex min-h-11 items-center rounded-lg px-3 font-medium text-[var(--vault-text-muted)] hover:text-[var(--vault-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vault-accent)]">Earn</Link>
            <Link href="/positions" className="flex min-h-11 items-center rounded-lg px-3 font-medium text-[var(--vault-text-muted)] hover:text-[var(--vault-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vault-accent)]">Positions</Link>
            <span aria-current="page" className="flex min-h-11 items-center rounded-lg bg-[var(--vault-surface-soft)] px-3 text-xs font-semibold text-[var(--vault-text)]">Vaults · Soon</span>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1180px] px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="max-w-2xl">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--vault-accent)]">Automated strategies · Coming soon</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">Vaults are being prepared.</h1>
          <p className="mt-4 text-base leading-7 text-[var(--vault-text-muted)]">
            Vaults will automate the same plain-language ETH and cbBTC strategies available in Earn. Preview what is planned below. Deposits and management are not open yet.
          </p>
          <Link href="/earn/eth" className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-[var(--vault-accent)] px-5 text-sm font-semibold text-[var(--vault-accent-contrast)] transition-[background-color,transform] duration-150 hover:bg-[var(--vault-accent-hover)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vault-accent)] focus-visible:ring-offset-2">
            Earn manually now
          </Link>
        </div>

        <section aria-label="Planned vault strategies" className="mt-10 grid gap-4 sm:grid-cols-2">
          {PREVIEWS.map((preview) => (
            <article key={preview.title} className="rounded-2xl border border-[var(--vault-border)] bg-[var(--vault-surface)] p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <span className="flex items-center gap-3">
                  <Image src={preview.icon} alt="" aria-hidden="true" width={36} height={36} className="size-9 rounded-full" />
                  <span>
                    <span className="block font-mono text-xs text-[var(--vault-text-subtle)]">{preview.symbol} · Base</span>
                    <h2 className="mt-1 text-lg font-semibold">{preview.title}</h2>
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-[var(--vault-accent-dim)] px-2.5 py-1 text-xs font-semibold text-[var(--vault-accent)]">Soon</span>
              </div>
              <p className="mt-5 leading-6 text-[var(--vault-text-muted)]">{preview.description}</p>
              <dl className="mt-5 border-t border-[var(--vault-border)] pt-4 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--vault-text-subtle)]">Planned deposit asset</dt>
                  <dd className="font-mono font-medium">{preview.collateral}</dd>
                </div>
              </dl>
              <button type="button" disabled className="mt-5 min-h-11 w-full cursor-not-allowed rounded-xl bg-[var(--vault-disabled)] px-4 text-sm font-semibold text-[var(--vault-text-subtle)]" aria-label={`${preview.title}: Coming soon`}>
                Coming soon
              </button>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
