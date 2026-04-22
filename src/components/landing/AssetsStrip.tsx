const ASSET_ROWS = [
  { symbol: "ETH", chain: "Base", chainKey: "base", isNew: false },
  { symbol: "cbBTC", chain: "Base", chainKey: "base", isNew: false },
  { symbol: "SOL", chain: "Solana", chainKey: "solana", isNew: false },
  { symbol: "TSLAx", chain: "Solana", chainKey: "solana", isNew: true },
] as const;

export function AssetsStrip() {
  return (
    <section className="py-12 relative z-[3] border-t border-b border-[var(--border)]/40">
      <div className="max-w-5xl mx-auto px-6">
        <p className="text-center text-[10px] font-mono uppercase tracking-[0.22em] text-[var(--text-secondary)] mb-6">
          Four assets <span className="opacity-40 mx-1">·</span> Two chains
        </p>

        <ul className="grid grid-cols-4 max-w-[720px] mx-auto list-none">
          {ASSET_ROWS.map((asset, i) => {
            const label = asset.isNew
              ? `${asset.symbol} on ${asset.chain}, new`
              : `${asset.symbol} on ${asset.chain}`;
            const isLast = i === ASSET_ROWS.length - 1;
            const dotClass =
              asset.chainKey === "base"
                ? "bg-[#3b82f6]"
                : "bg-[#a855f7]";

            return (
              <li
                key={asset.symbol}
                aria-label={label}
                className={`text-center px-3 py-2 relative ${
                  isLast ? "" : "border-r border-[var(--border)]/60"
                }`}
              >
                <div
                  className={`font-mono text-[22px] leading-none mb-1.5 ${
                    asset.isNew ? "text-[var(--accent)]" : "text-[var(--bone)]"
                  }`}
                >
                  {asset.symbol}
                </div>
                <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--text-secondary)]">
                  <span
                    aria-hidden="true"
                    className={`inline-block w-[4px] h-[4px] rounded-full align-middle mr-1.5 ${dotClass}`}
                  />
                  {asset.chain}
                  {asset.isNew ? (
                    <>
                      {" "}
                      <span className="opacity-40">·</span>{" "}
                      <span className="text-[var(--accent)]">New</span>
                    </>
                  ) : null}
                </div>
                {asset.isNew ? (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-0 left-[20%] right-[20%] h-px bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent"
                    style={{ boxShadow: "0 0 12px rgba(34,211,238,0.5)" }}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
