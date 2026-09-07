"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useLogin } from "@privy-io/react-auth";
import { usePrices } from "@/hooks/usePrices";
import { useSpot } from "@/hooks/useSpot";
import { useCapacity } from "@/hooks/useCapacity";
import { useWallet } from "@/hooks/useWallet";
import { useBalances } from "@/hooks/useBalances";
import { useB1naryAccount } from "@/hooks/useB1naryAccount";
import { AcceptModal } from "../AcceptModal";
import { LivePrice } from "../LivePrice";
import { HowItWorksDrawer } from "../HowItWorksDrawer";
import { InfoTooltip } from "../ui/InfoTooltip";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { OutcomeCards } from "./OutcomeCards";
import { CHAIN } from "@/lib/contracts";
import {
  getAssetActionBlockReason,
  isCanonicalQuoteForAsset,
  isExecutableQuote,
  isProductionReadOnlyAsset,
  reconcileSelectedQuote,
} from "@/lib/marketState";
import { fmtUsd, floorTo, buildTweetUrl } from "@/lib/utils";
import type { PriceQuote } from "@/lib/api";
import { isBackendGatedAssetSlug, type AssetConfig } from "@/lib/assets";
import type { Address } from "viem";
import { AssetSelector } from "./AssetSelector";
import { RangeEarn } from "./RangeEarn";
import { YieldToggle, type YieldMetric } from "../YieldToggle";
import { computeAPR, computeROI } from "@/lib/execution";
import { startBuyTour, startSellTour, startRangeTour } from "./EarnTutorial";
import { useAppPreferences } from "@/lib/preferences";

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function parseLocalDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day); // month is 0-indexed; uses local time
}

function expiryLabel(expiryDate: string): string {
  const d = parseLocalDate(expiryDate);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function daysUntil(expiryDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = parseLocalDate(expiryDate);
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

const PERCENT_SHORTCUTS = [25, 50, 75, 100] as const;
const MIN_DISPLAY_APR = 3;
const PREVIEW_STRIKE_MULTIPLIERS = {
  put: [0.97, 0.95, 0.93, 0.9, 0.87],
  call: [1.03, 1.05, 1.08, 1.1, 1.13],
} as const;
const PREVIEW_EXPIRY_DAYS = [1, 3, 7] as const;

function isoDateAfter(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function strikeStepForAsset(asset: AssetConfig): number {
  return asset.slug === "btc" ? 500 : 25;
}

function roundStrikeForAsset(value: number, asset: AssetConfig): number {
  const step = strikeStepForAsset(asset);
  return Math.max(step, Math.round(value / step) * step);
}

function previewStrikesForAsset(asset: AssetConfig, spot: number, optionType: "put" | "call"): number[] {
  const step = strikeStepForAsset(asset);
  const used = new Set<number>();

  return PREVIEW_STRIKE_MULTIPLIERS[optionType].map((multiplier) => {
    let strike = roundStrikeForAsset(spot * multiplier, asset);
    while (
      used.has(strike) ||
      (optionType === "put" ? strike >= spot : strike <= spot)
    ) {
      const nextStrike = strike + (optionType === "put" ? -step : step);
      if (nextStrike < step) break;
      strike = nextStrike;
    }
    used.add(strike);
    return strike;
  });
}

function previewPremium(strike: number, spot: number, optionType: "put" | "call", expiryDays: number) {
  const distance = Math.abs(strike - spot) / spot;
  const baseRoi = optionType === "put"
    ? Math.max(0.00035, 0.0022 - distance * 0.014)
    : Math.max(0.0003, 0.0019 - distance * 0.012);
  const durationScale = Math.sqrt(expiryDays);
  return Number((strike * baseRoi * durationScale).toFixed(4));
}

function buildPreviewQuotes(asset: AssetConfig, spot: number): PriceQuote[] {
  if (!Number.isFinite(spot) || spot <= 0) return [];

  return PREVIEW_EXPIRY_DAYS.flatMap((expiryDays) => {
    const expiryDate = isoDateAfter(expiryDays);
    const expiresAt = Math.floor(parseLocalDate(expiryDate).getTime() / 1000);

    return (["put", "call"] as const).flatMap((optionType) =>
      previewStrikesForAsset(asset, spot, optionType).map((strike) => {
        return {
          option_type: optionType,
          strike,
          expiry_days: expiryDays,
          expiry_date: expiryDate,
          premium: previewPremium(strike, spot, optionType, expiryDays),
          delta: optionType === "put" ? -0.25 : 0.25,
          iv: 0,
          spot,
          ttl: 0,
          expires_at: expiresAt,
          available_amount: asset.maxAmount,
          otoken_address: null,
          signature: null,
          mm_address: null,
          bid_price_raw: null,
          deadline: null,
          quote_id: null,
          max_amount_raw: null,
          maker_nonce: null,
          position_count: 0,
          chain: asset.chain,
        } satisfies PriceQuote;
      }),
    );
  });
}

function fmtYield(apr: number, roi: number, metric: YieldMetric): string {
  return metric === "apr"
    ? `${Math.round(apr)}% APR`
    : `${roi.toFixed(1)}% ROI`;
}

function StrikeCard({
  quote,
  side,
  amount,
  isSelected,
  onSelect,
  assetSymbol: symbol,
  spot,
  yieldMetric,
  positionCount,
}: {
  quote: PriceQuote;
  side: "buy" | "sell";
  amount: number;
  isSelected: boolean;
  onSelect: () => void;
  assetSymbol: string;
  spot?: number;
  yieldMetric: YieldMetric;
  positionCount: number;
}) {
  const apr = computeAPR(quote.premium, quote.strike, quote.expiry_days);
  const roi = computeROI(quote.premium, quote.strike);
  const disabled = quote.available_amount <= 0;

  const isBuy = side === "buy";
  const earnings = amount > 0
    ? isBuy
      ? (quote.premium * amount) / quote.strike
      : quote.premium * amount
    : 0;

  const distancePct = spot && spot > 0
    ? ((quote.strike - spot) / spot) * 100
    : null;

  return (
    <button
      onClick={onSelect}
      disabled={disabled}
      className={`group grid min-h-14 w-full grid-cols-[1fr_auto_1fr] items-center px-5 py-4 text-left transition-[background-color,border-color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
        disabled
          ? "opacity-40 cursor-not-allowed"
          : isSelected
            ? "bg-[var(--accent)]/8 border-l-2 border-l-[var(--accent)] cursor-pointer"
            : "cursor-pointer hover:bg-[var(--surface)] active:bg-[var(--surface)]"
      }`}
    >
      {/* Left: strike + distance */}
      <div>
        <span className={`inline-block text-base font-semibold font-mono ${isSelected ? "text-[var(--accent)]" : "text-[var(--bone)]"}`}>
          ${quote.strike.toLocaleString()}/{symbol}
        </span>
        {distancePct != null && (
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5 font-mono cursor-default">
                {distancePct > 0 ? "+" : ""}{distancePct.toFixed(1)}%
              </p>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Distance from current price</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      {/* Center: position count */}
      <div className="flex items-center justify-center px-3">
        {positionCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex items-center gap-1.5 cursor-default">
                <span className="w-2 h-2 rounded-full bg-[var(--accent)]/60 inline-block" />
                <span className="text-xs font-mono text-[var(--text-secondary)]">{positionCount}</span>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Total open positions at this strike price</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      {/* Right: earnings / APR */}
      <div className="text-right">
        {earnings > 0 ? (
          <span className="text-base font-bold text-[var(--accent)] font-mono">
            ${fmtUsd(earnings)}
          </span>
        ) : (
          <span className="text-base font-bold text-[var(--accent)] font-mono">
            {fmtYield(apr, roi, yieldMetric)}
          </span>
        )}
        {earnings > 0 && (
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">{fmtYield(apr, roi, yieldMetric)}</p>
        )}
      </div>
    </button>
  );
}

export function PriceMenuV2({ asset }: { asset: AssetConfig }) {
  const { locale } = useAppPreferences();
  const t = (en: string, es: string) => locale === "es" ? es : en;
  const { prices, loading, error, refresh } = usePrices(asset.slug);
  const { capacity } = useCapacity(asset.slug);
  const { spot: spotFromEndpoint } = useSpot(asset.slug, 5_000);
  const canonicalPrices = useMemo(
    () => prices.filter((quote) => isCanonicalQuoteForAsset(quote, asset)),
    [asset, prices],
  );
  const spot = spotFromEndpoint ?? canonicalPrices[0]?.spot ?? asset.fallbackSpot;
  const displayPrices = useMemo(
    () => canonicalPrices.length > 0
      ? canonicalPrices
      : asset.address
        ? []
        : buildPreviewQuotes(asset, spot),
    [asset, canonicalPrices, spot],
  );
  const indicativeQuotesActive = displayPrices.some((quote) => !isExecutableQuote(quote));
  const { address, isConnected } = useWallet();
  const { login } = useLogin();
  const { wallets: b1naryWallets } = useB1naryAccount({
    autoSyncTrustedWallets: false,
  });
  const b1naryTradingWallets = b1naryWallets.filter((wallet) =>
    wallet.role === "trading" &&
    wallet.verified_at &&
    wallet.chain === "base" &&
    wallet.wallet_type === "smart",
  );
  const b1naryBaseAddresses = b1naryTradingWallets
    .filter((wallet) => wallet.chain === "base")
    .map((wallet) => wallet.address as Address);
  const { usd, eth, weth, wbtc } = useBalances(
    b1naryBaseAddresses.length > 0 ? b1naryBaseAddresses : address,
  );
  const searchParams = useSearchParams();
  const sideParam = searchParams.get("side");
  const amountParam = searchParams.get("amount");
  const initialSide = isBackendGatedAssetSlug(asset.slug)
    ? "buy"
    : sideParam === "sell" ? "sell" : sideParam === "range" ? "range" : "buy";
  const [side, setSide] = useState<"buy" | "sell" | "range">(initialSide);
  const [selectedQuote, setSelectedQuote] = useState<PriceQuote | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [accepted, setAccepted] = useState<{ quote: PriceQuote; side: "buy" | "sell"; amount: number; txHash: string | null } | null>(null);
  const [rangeAccepted, setRangeAccepted] = useState<{
    putStrike: number; callStrike: number;
    totalPremium: number; combinedApr: number;
    amount: number; expiryDays: number;
    putTxHash: string | null; callTxHash: string | null;
  } | null>(null);

  const [amountStr, setAmountStr] = useState(amountParam ?? "");
  const amount = Number(amountStr) || 0;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [yieldMetric, setYieldMetric] = useState<YieldMetric>("apr");

  const isBuy = side === "buy";
  const isBtc = asset.slug === "btc";
  const readinessBlockReason = getAssetActionBlockReason(asset, capacity);
  const marketReadOnly = isProductionReadOnlyAsset(asset) || !!readinessBlockReason;
  const walletBalance = isBuy ? usd : isBtc ? wbtc : eth + weth;

  const expiries = useMemo(() => {
    const seen = new Set<string>();
    for (const p of displayPrices) {
      seen.add(p.expiry_date);
    }
    return [...seen].sort();   // ISO strings sort correctly lexicographically
  }, [displayPrices]);

  const [selectedExpiry, setSelectedExpiry] = useState<string | null>(null);
  const activeExpiry = selectedExpiry ?? expiries[0] ?? null;

  const marketClosed = capacity !== null && (!capacity.market_open || capacity.market_status === "full");
  const marketDegraded = capacity !== null && capacity.market_status === "degraded";
  const capEth = capacity?.max_position ?? asset.maxAmount;
  const capUsd = spot ? Math.min(asset.maxAmountUsd, capEth * spot) : asset.maxAmountUsd;
  const capacityLabel = capacity?.market_status === "full"
    ? "MM at capacity"
    : marketClosed
      ? "Market closed"
      : marketDegraded
        ? "Limited capacity"
        : "Open";

  const filteredPrices = useMemo(() => {
    return displayPrices
      .filter(
        (p) =>
          p.option_type === (side === "buy" ? "put" : "call") &&
          p.expiry_date === activeExpiry &&
          (side === "buy" ? p.strike < (spot ?? Infinity) : p.strike > (spot ?? -Infinity)) &&
          computeAPR(p.premium, p.strike, p.expiry_days) >= MIN_DISPLAY_APR
      )
      .sort((a, b) => side === "buy" ? b.strike - a.strike : a.strike - b.strike);
  }, [displayPrices, side, activeExpiry, spot]);

  // Total open positions for this expiry (puts in buy, calls in sell)
  const totalPositionsForExpiry = useMemo(() => {
    const optionType = side === "buy" ? "put" : "call";
    return displayPrices
      .filter(p => p.expiry_date === activeExpiry && p.option_type === optionType)
      .reduce((sum, p) => sum + p.position_count, 0);
  }, [displayPrices, activeExpiry, side]);

  // When filters change, try to keep the same strike selected
  useEffect(() => {
    setSelectedQuote((prev) => reconcileSelectedQuote(prev, filteredPrices));
  }, [filteredPrices]);

  const selectedEarnings =
    selectedQuote && amount > 0 && selectedQuote.strike > 0
      ? isBuy
        ? (selectedQuote.premium * amount) / selectedQuote.strike
        : selectedQuote.premium * amount
      : 0;

  const selectedApr = selectedQuote
    ? computeAPR(selectedQuote.premium, selectedQuote.strike, selectedQuote.expiry_days)
    : 0;

  const canAccept = !!(
    !marketReadOnly &&
    !marketClosed &&
    selectedQuote &&
    amount > 0 &&
    isExecutableQuote(selectedQuote)
  );
  const selectedQuoteIsPreview = !!selectedQuote && !isExecutableQuote(selectedQuote);
  const executionBlocked = marketReadOnly || marketClosed || selectedQuoteIsPreview || !canAccept;

  function handleStartTutorial() {
    const onComplete = () => {};

    if (side === "range") {
      setTimeout(() => startRangeTour(asset.symbol, onComplete), 150);
      return;
    }

    // Pre-fill for buy/sell so cards show real numbers
    const sellPreFill = String(Number(asset.amountPlaceholder) / 10 || 0.05);
    setAmountStr(isBuy ? "100" : sellPreFill);
    if (filteredPrices.length > 0) {
      setSelectedQuote(filteredPrices[0]);
    }

    setTimeout(() => {
      if (side === "sell") {
        startSellTour(asset.symbol, onComplete);
      } else {
        startBuyTour(asset.symbol, onComplete);
      }
    }, 200);
  }

  function handlePrimaryAction() {
    if (!isConnected) {
      login();
      return;
    }
    if (!executionBlocked) setConfirming(true);
  }

  function handlePercentShortcut(pct: number) {
    const raw = walletBalance * (pct / 100);
    if (isBuy) {
      const truncated = floorTo(raw, 2);
      setAmountStr((Number.isFinite(capUsd) ? Math.min(truncated, capUsd) : truncated).toString());
    } else {
      const truncated = floorTo(raw, asset.displayDecimals);
      setAmountStr(Math.min(truncated, capEth).toString());
    }
  }

  if (loading && prices.length === 0 && !spot) {
    return (
      <div className="space-y-3">
        <div className="h-14 w-48 animate-pulse rounded-xl bg-[var(--surface)]" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-xl bg-[var(--surface)]" />
        ))}
      </div>
    );
  }

  if (error && displayPrices.length === 0 && !asset.disclosure) {
    return (
      <div className="rounded-2xl bg-[var(--surface)] p-5 text-sm text-[var(--text-secondary)] text-center">
        {t("Could not load prices. Is the backend running?", "No se pudieron cargar los precios.")}
      </div>
    );
  }

  if (accepted) {
    const { quote: aq, side: as_, amount: aa, txHash: aTxHash } = accepted;
    const abuy = as_ === "buy";
    const premium = abuy ? (aq.premium * aa) / aq.strike : aq.premium * aa;
    const commitLabel = abuy ? `$${aa.toLocaleString()}` : `${aa} ${asset.symbol}`;
    const apr = computeAPR(aq.premium, aq.strike, aq.expiry_days);
    const roi = computeROI(aq.premium, aq.strike);
    const explorerUrl = CHAIN.blockExplorers?.default.url;

    return (
      <div className="text-center space-y-5 py-10 animate-fade-in-up">
        <div>
          <p className="text-4xl font-bold text-[var(--accent)] font-mono">
            ${fmtUsd(premium)}
          </p>
          <p className="text-base text-[var(--text-secondary)] mt-2">{t("earned. Yours to keep.", "recibidos. Son tuyos.")}</p>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          {fmtYield(apr, roi, yieldMetric)}
        </p>
        <div className="h-px bg-[var(--border)]" />
        <div className="space-y-2 text-sm text-[var(--text-secondary)]">
          <p>{commitLabel} {t("committed for", "comprometidos por")} {aq.expiry_days} {t("days", "días")}</p>
          <p>{abuy ? t("Buy", "Comprar") : t("Sell", "Vender")} {asset.symbol} {t("at", "a")} ${aq.strike.toLocaleString()}/{asset.symbol}</p>
        </div>
        {aTxHash && (
          <a
            href={`${explorerUrl}/tx/${aTxHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-sm text-[var(--accent)] hover:underline"
          >
            {t("View transaction ↗", "Ver transacción ↗")}
          </a>
        )}
        {/* Share on X — primary shareability CTA */}
        <button
          onClick={() =>
            window.open(
              buildTweetUrl(apr, asset.symbol, abuy ? "buy" : "sell"),
              "_blank",
              "noopener,noreferrer",
            )
          }
          className="flex items-center justify-center gap-2 mx-auto max-w-xs w-full rounded-xl border border-[var(--border)] py-3.5 text-sm font-semibold text-[var(--text)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
        >
          <XIcon />
          Share on X
        </button>
        <a
          href="/positions"
          className="block mx-auto max-w-xs rounded-xl bg-[var(--accent)] py-3.5 text-sm font-semibold text-[var(--bg)] hover:bg-[var(--accent-hover)] transition-colors"
        >
          View my positions
        </a>
        <button
          onClick={() => { setAccepted(null); setSelectedQuote(null); setAmountStr(""); refresh(); }}
          className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors"
        >
          {t("Accept another price", "Aceptar otro precio")}
        </button>
      </div>
    );
  }

  if (rangeAccepted) {
    const explorerUrl = CHAIN.blockExplorers?.default.url;
    return (
      <div className="text-center space-y-5 py-10 animate-fade-in-up">
        <div>
          <p className="text-4xl font-bold text-[var(--accent)] font-mono">
            ${fmtUsd(rangeAccepted.totalPremium)}
          </p>
          <p className="text-base text-[var(--text-secondary)] mt-2">{t("earned from both sides. Yours to keep.", "recibidos de ambos lados. Son tuyos.")}</p>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          {fmtYield(
            rangeAccepted.combinedApr,
            rangeAccepted.combinedApr * rangeAccepted.expiryDays / 365,
            yieldMetric,
          )}
        </p>
        <div className="h-px bg-[var(--border)]" />
        <div className="space-y-2 text-sm text-[var(--text-secondary)]">
          <p>{t("Range", "Rango")}: ${rangeAccepted.putStrike.toLocaleString()} – ${rangeAccepted.callStrike.toLocaleString()}</p>
          <p>${rangeAccepted.amount.toLocaleString()} {t("committed for", "comprometidos por")} {rangeAccepted.expiryDays} {t("days", "días")}</p>
        </div>
        {(rangeAccepted.putTxHash || rangeAccepted.callTxHash) && (
          <div className="flex justify-center gap-3 text-sm">
            {rangeAccepted.putTxHash && (
              <a
                href={`${explorerUrl}/tx/${rangeAccepted.putTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--accent)] hover:underline"
              >
                {t("Lower tx ↗", "Transacción inferior ↗")}
              </a>
            )}
            {rangeAccepted.callTxHash && (
              <a
                href={`${explorerUrl}/tx/${rangeAccepted.callTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--accent)] hover:underline"
              >
                {t("Upper tx ↗", "Transacción superior ↗")}
              </a>
            )}
          </div>
        )}
        {/* Share on X — primary shareability CTA */}
        <button
          onClick={() =>
            window.open(
              buildTweetUrl(rangeAccepted.combinedApr, asset.symbol, "range"),
              "_blank",
              "noopener,noreferrer",
            )
          }
          className="flex items-center justify-center gap-2 mx-auto max-w-xs w-full rounded-xl border border-[var(--border)] py-3.5 text-sm font-semibold text-[var(--text)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
        >
          <XIcon />
          Share on X
        </button>
        <a
          href="/positions"
          className="block mx-auto max-w-xs rounded-xl bg-[var(--accent)] py-3.5 text-sm font-semibold text-[var(--bg)] hover:bg-[var(--accent-hover)] transition-colors"
        >
          View my positions
        </a>
        <button
          onClick={() => { setRangeAccepted(null); setSide("range"); refresh(); }}
          className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors"
        >
          {t("Set another range", "Definir otro rango")}
        </button>
      </div>
    );
  }

  const acceptButtonLabel = readinessBlockReason
    ? t("Action unavailable", "Acción no disponible")
    : marketReadOnly
      ? t("Coming soon", "Próximamente")
    : marketClosed
      ? t("Market at capacity", "Mercado sin capacidad")
      : selectedQuoteIsPreview
        ? t("Preview only", "Solo vista previa")
        : !isConnected
          ? t("Connect wallet", "Conectar wallet")
          : !amount
            ? t("Enter an amount", "Ingresa un monto")
            : !selectedQuote
              ? t("Select a price", "Selecciona un precio")
              : t(`Accept: Earn $${fmtUsd(selectedEarnings)}`, `Aceptar: Recibe $${fmtUsd(selectedEarnings)}`);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-y-3">
        <div className="flex items-center gap-4">
          <AssetSelector current={asset} />
          <LivePrice spot={spot} />
        </div>
        <div className="flex items-center gap-3">
          <YieldToggle value={yieldMetric} onChange={setYieldMetric} />
          {marketReadOnly ? (
            <span className="text-xs font-medium text-amber-400">
              Coming soon
            </span>
          ) : capacity && (
            <span className={`text-xs font-medium ${
              marketClosed
                ? "text-[var(--danger)]"
                : marketDegraded
                  ? "text-amber-400"
                  : "text-[var(--accent)]"
            }`}>
              ● {capacityLabel}
            </span>
          )}
        </div>
      </div>

      {asset.disclosure && (
        <section className="space-y-2 rounded-xl border border-amber-400/25 bg-amber-400/5 p-4 text-xs text-[var(--text-secondary)]" aria-label={`${asset.symbol} disclosures`}>
          <p className="font-semibold text-[var(--bone)]">{asset.symbol} risk disclosure</p>
          <p>{asset.disclosure.instrument}</p>
          <p>{asset.disclosure.jurisdiction} {asset.disclosure.eligibility}</p>
          <p>{asset.disclosure.policyPause}</p>
          <p className="break-all font-mono">Base · {asset.address}</p>
          {readinessBlockReason && <p className="font-medium text-amber-300">{readinessBlockReason}</p>}
        </section>
      )}

      {/* Buy/Sell/Range toggle + content */}
      <div className="space-y-5">
        {/* 1. Buy / Sell / Range toggle */}
          <div className="flex rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1">
            <button
              data-tour="tab-buy"
              onClick={() => { setSide("buy"); setSelectedQuote(null); }}
              className={`min-h-11 flex-1 cursor-pointer rounded-lg py-2.5 text-base font-semibold transition-[background-color,color,transform] duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                side === "buy"
                  ? "bg-[var(--bg)] text-[var(--accent)] shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-[var(--text)]"
              }`}
            >
              {t("I have USD", "Tengo USD")}
            </button>
            {!isBackendGatedAssetSlug(asset.slug) && (
              <>
                <button
                  data-tour="tab-sell"
                  onClick={() => { setSide("sell"); setSelectedQuote(null); }}
                  className={`min-h-11 flex-1 cursor-pointer rounded-lg py-2.5 text-base font-semibold transition-[background-color,color,transform] duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                    side === "sell"
                      ? "bg-[var(--bg)] text-[var(--accent)] shadow-sm"
                      : "text-[var(--text-secondary)] hover:text-[var(--text)]"
                  }`}
                >
                  {t("I have", "Tengo")} {asset.symbol}
                </button>
                <button
                  onClick={() => { setSide("range"); setSelectedQuote(null); }}
                  className={`min-h-11 flex-1 cursor-pointer rounded-lg py-2.5 text-base font-semibold transition-[background-color,color,transform] duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                    side === "range"
                      ? "bg-[var(--bg)] text-[var(--accent)] shadow-sm"
                      : "text-[var(--text-secondary)] hover:text-[var(--text)]"
                  }`}
                >
                  {t("Range", "Rango")}
                </button>
              </>
            )}
          </div>

          {/* Context line — explains the benefit and why you get paid */}
          <div className="space-y-1" data-tour="context-line">
            {side === "buy" && (
              <>
                <p className="text-sm font-semibold text-[var(--bone)]">
                  {t(`Buy ${asset.symbol} cheaper.`, `Compra ${asset.symbol} más barato.`)}
                </p>
                <p className="text-sm text-[var(--text-secondary)]">
                  {t(
                    `Set a price you'd buy ${asset.symbol} at. A market participant pays you for that commitment. If the stage results in a purchase, you buy. Otherwise, your dollars come back. You keep the payment either way.`,
                    `Define un precio para comprar ${asset.symbol}. Un participante del mercado te paga por ese compromiso. Si la etapa termina en compra, compras. Si no, recuperas tus dólares. En cualquier caso, conservas el pago.`,
                  )}
                </p>
              </>
            )}
            {side === "sell" && (
              <>
                <p className="text-sm font-semibold text-[var(--bone)]">
                  {t(`Sell ${asset.symbol} higher.`, `Vende ${asset.symbol} más alto.`)}
                </p>
                <p className="text-sm text-[var(--text-secondary)]">
                  {t(
                    `Set a price you'd sell ${asset.symbol} at. A market participant pays you for that commitment. If the stage results in a sale, you sell at your price. Otherwise, your ${asset.symbol} comes back. You keep the payment either way.`,
                    `Define un precio para vender ${asset.symbol}. Un participante del mercado te paga por ese compromiso. Si la etapa termina en venta, vendes a tu precio. Si no, recuperas tu ${asset.symbol}. En cualquier caso, conservas el pago.`,
                  )}
                </p>
              </>
            )}
            {side === "range" && (
              <>
                <p className="text-sm font-semibold text-[var(--bone)]">
                  {t("Earn from both sides.", "Genera ingresos en ambos lados.")}
                </p>
                <p className="text-sm text-[var(--text-secondary)]">
                  {t(
                    `Set a buy price and a sell price. You earn from both commitments. If ${asset.symbol} stays in your range, everything comes back. You keep both payments.`,
                    `Define un precio de compra y otro de venta. Generas ingresos por ambos compromisos. Si ${asset.symbol} permanece en tu rango, recuperas todo y conservas ambos pagos.`,
                  )}
                </p>
              </>
            )}
          </div>

          {/* 2. Duration — button group */}
          {expiries.length > 0 && (
            <div data-tour="duration">
              <p className="text-sm text-[var(--text-secondary)] mb-2">{t("Duration", "Duración")}</p>
              <div className="flex flex-wrap gap-2">
                {expiries.map((d) => (
                  <button
                    key={d}
                    onClick={() => { setSelectedExpiry(d); }}
                    className={`min-h-11 cursor-pointer rounded-xl px-4 py-2 text-sm font-medium transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                      activeExpiry === d
                        ? "bg-[var(--accent)] text-[var(--bg)] shadow-sm"
                        : "bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] hover:border-[var(--accent)] hover:shadow-sm"
                    }`}
                  >
                    {expiryLabel(d)} ({daysUntil(d)}d)
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>{/* end toggle + duration wrapper */}

      {/* Range mode */}
      {side === "range" && (
        <RangeEarn
          asset={asset}
          prices={displayPrices}
          activeExpiry={activeExpiry}
          spot={spot}
          marketReadOnly={marketReadOnly || indicativeQuotesActive || marketClosed}
          walletBalance={usd}
          amountStr={amountStr}
          onAmountChange={setAmountStr}
          onAccepted={setRangeAccepted}
          yieldMetric={yieldMetric}
        />
      )}

      {/* Buy/Sell mode */}
      {side !== "range" && (
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(340px,1fr)_minmax(0,1fr)] gap-8">
        <div className="space-y-5">
          {/* 3. Amount input + % shortcuts */}
          <div data-tour="amount">
            <p className="text-sm text-[var(--text-secondary)] mb-2">
              {t("How much do you want to commit?", "¿Cuánto quieres comprometer?")}
            </p>
            <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 focus-within:border-[var(--accent)] transition-colors duration-200">
              <div className="flex items-center gap-1.5 shrink-0">
                <img
                  src={isBuy ? "/usdc.svg" : isBtc ? "/cbbtc.webp" : "/eth.png"}
                  alt={isBuy ? "USDC" : asset.symbol}
                  className="w-5 h-5 rounded-full"
                />
                <span className="text-sm font-bold text-[var(--bone)]">
                  {isBuy ? "USDC" : asset.symbol}
                </span>
              </div>
              <input
                type="text"
                inputMode="decimal"
                placeholder={isBuy ? "1,000" : asset.amountPlaceholder}
                value={amountStr}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "" || /^(0|[1-9]\d*)?\.?\d*$/.test(raw)) {
                    setAmountStr(raw);
                  }
                }}
                className="flex-1 bg-transparent text-[var(--text)] font-semibold text-base focus:outline-none font-mono text-right"
              />
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <p className="text-xs text-[var(--text-secondary)]">
                Balance: <span className="font-mono">{isBuy
                  ? `$${floorTo(walletBalance, 2).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : `${floorTo(walletBalance, asset.displayDecimals).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: asset.displayDecimals })} ${asset.symbol}`}</span>
              </p>
              <div className="flex gap-1.5">
                {PERCENT_SHORTCUTS.map((pct) => (
                  <button
                    key={pct}
                    onClick={() => handlePercentShortcut(pct)}
                    disabled={walletBalance <= 0}
                    className={`text-xs font-medium transition-colors duration-150 px-2 py-1 min-h-[28px] rounded bg-[var(--surface)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none ${
                      walletBalance > 0
                        ? "cursor-pointer text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10"
                        : "text-[var(--text-secondary)] opacity-40 cursor-not-allowed"
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 4. Strike price cards */}
          <div data-tour="strikes">
            <div className="text-sm text-[var(--text-secondary)] flex items-center justify-between mb-2">
              <span className="flex items-center">
                {amount > 0 ? t("Choose your price", "Elige tu precio") : t("Enter an amount to see earnings for each price", "Ingresa un monto para ver los ingresos por precio")}
                <InfoTooltip title="Strike price" text={`The price at which you commit to buy (or sell) ${asset.symbol}. Lower = safer, higher = more premium.`} />
              </span>
              {totalPositionsForExpiry > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex items-center gap-1.5 cursor-default">
                      <span className="w-2 h-2 rounded-full bg-[var(--accent)]/60 inline-block" />
                      <span className="text-xs font-mono">{totalPositionsForExpiry}</span>
                      <span className="text-xs text-[var(--text-secondary)]">open positions</span>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p>Open positions at this expiry</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            {filteredPrices.length > 0 ? (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] divide-y divide-[var(--border)] overflow-hidden">
                {filteredPrices.map((q) => (
                  <StrikeCard
                    key={`${q.strike}-${q.expiry_date}`}
                    quote={q}
                    side={side as "buy" | "sell"}
                    amount={amount}
                    isSelected={selectedQuote?.strike === q.strike}
                    onSelect={() => setSelectedQuote(q)}
                    assetSymbol={asset.symbol}
                    spot={spot}
                    yieldMetric={yieldMetric}
                    positionCount={q.position_count}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl bg-[var(--surface)] p-5 text-sm text-[var(--text-secondary)] text-center">
                {marketClosed ? "MM is at capacity. Check back soon." : "No prices available for this date."}
              </div>
            )}
          </div>

          {/* 5. Accept button — desktop only (mobile renders after outcome cards) */}
          <div className="hidden space-y-2 lg:block" data-tour="accept">
            <button
              onClick={handlePrimaryAction}
              disabled={marketReadOnly || marketClosed || selectedQuoteIsPreview || (!canAccept && isConnected)}
              className={`w-full rounded-xl py-3.5 text-sm font-semibold transition-[background-color,transform] duration-150 active:scale-[0.97] ${
                canAccept
                  ? "bg-[var(--accent)] text-[var(--bg)] hover:bg-[var(--accent-hover)]"
                  : "bg-[var(--accent)] text-[var(--bg)] disabled:opacity-40"
              }`}
            >
              {acceptButtonLabel}
            </button>
            {(readinessBlockReason || marketClosed) && (
              <p className="text-xs text-center text-[var(--text-secondary)]">
                {readinessBlockReason || "Quotes are visible for planning; trading is disabled while capacity is full."}
              </p>
            )}
          </div>
        </div>

        {/* RIGHT: Live preview — outcome cards */}
        <div className="lg:sticky lg:top-24 lg:self-start space-y-4">
          {selectedQuote && amount > 0 && (
            <div className="py-2 text-center">
              <div className="flex items-center justify-center gap-1">
                <p className="text-3xl font-bold text-[var(--accent)] font-mono">
                  ${fmtUsd(selectedEarnings)}
                </p>
                <InfoTooltip title="Premium" text="Paid to you upfront. Yours to keep no matter what happens with the price." />
              </div>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                {fmtYield(selectedApr, selectedQuote ? computeROI(selectedQuote.premium, selectedQuote.strike) : 0, yieldMetric)} · {activeExpiry ? daysUntil(activeExpiry) : 0}d
              </p>
            </div>
          )}
          {activeExpiry && (
            <div className="text-center">
              <p className="text-xs font-medium text-[var(--text-secondary)]">
                Settlement: <span className="font-mono text-[var(--bone)]">{parseLocalDate(activeExpiry).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · 8:00 AM UTC</span>
              </p>
              <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                The exact price at that moment decides the outcome.
              </p>
            </div>
          )}
          <OutcomeCards
            side={side as "buy" | "sell"}
            amount={amount > 0 ? amount : undefined}
            strike={selectedQuote?.strike}
            premium={selectedEarnings > 0 ? selectedEarnings : undefined}
            assetSymbol={asset.symbol}
          />

          {/* Accept button — mobile only, after outcome cards */}
          <div className="space-y-2 lg:hidden">
            <button
              onClick={handlePrimaryAction}
              disabled={marketReadOnly || marketClosed || selectedQuoteIsPreview || (!canAccept && isConnected)}
              className={`w-full rounded-xl py-3.5 text-sm font-semibold transition-[background-color,transform] duration-150 active:scale-[0.97] ${
                canAccept
                  ? "bg-[var(--accent)] text-[var(--bg)] hover:bg-[var(--accent-hover)]"
                  : "bg-[var(--accent)] text-[var(--bg)] disabled:opacity-40"
              }`}
            >
              {acceptButtonLabel}
            </button>
            {(readinessBlockReason || marketClosed) && (
              <p className="text-xs text-center text-[var(--text-secondary)]">
                {readinessBlockReason || "Quotes are visible for planning; trading is disabled while capacity is full."}
              </p>
            )}
          </div>
        </div>
      </div>
      )}

      {/* AcceptModal — only opens on Accept click, confirmation-only */}
      {confirming && selectedQuote && canAccept && (
        <AcceptModal
          quote={selectedQuote}
          side={side as "buy" | "sell"}
          initialAmount={amountStr}
          confirmOnly
          maxPositionEth={capacity?.max_position}
          assetSymbol={asset.symbol}
          assetSlug={asset.slug}
          yieldMetric={yieldMetric}
          onClose={() => setConfirming(false)}
          onQuoteInvalid={() => {
            setConfirming(false);
            setSelectedQuote(null);
            void refresh();
          }}
          onAccepted={({ amount: amt, txHash: hash }) => {
            setConfirming(false);
            setAccepted({ quote: selectedQuote, side: side as "buy" | "sell", amount: amt, txHash: hash });
          }}
        />
      )}

      <section aria-label={t("Trading help", "Ayuda para operar")} className="flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-5 text-sm">
        <span className="mr-1 text-[var(--text-secondary)]">{t("Need help?", "¿Necesitas ayuda?")}</span>
        <button
          type="button"
          onClick={handleStartTutorial}
          disabled={loading || displayPrices.length === 0 || (side !== "range" && filteredPrices.length === 0)}
          className="min-h-11 rounded-lg border border-[var(--border)] px-3 font-semibold text-[var(--text)] transition-colors hover:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t("Guide me", "Guíame")}
        </button>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="min-h-11 rounded-lg px-3 font-semibold text-[var(--text-secondary)] transition-colors hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          {t("How does this work?", "¿Cómo funciona?")}
        </button>
      </section>

      <HowItWorksDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
    </div>
  );
}
