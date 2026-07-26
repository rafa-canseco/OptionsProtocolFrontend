"use client";

import { useEffect, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import type { Address } from "viem";
import { useWallet } from "@/hooks/useWallet";
import type {
  FundConfigResponse,
  FundPositionResponse,
  FundSummaryResponse,
} from "@/lib/api";
import { ERC20_ABI, publicClient } from "@/lib/contracts";
import {
  assertFundWriteAllowed,
  buildFundActionCall,
  buildFundDepositCalls,
  fundAction,
  parseFundAmount,
  rawFundAmount,
  sharesForAccountingAssets,
  sharesForDeposit,
  transactionHashFromResult,
  type FundActionKey,
} from "@/lib/fundVault";
import { fundValuation } from "@/lib/fundValuation";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

type DialogAction = "deposit" | "redeem";
type TxStatus = "idle" | "submitting" | "confirmed";

const amount = new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 });
const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function VaultDialog(props: {
  summary: FundSummaryResponse | null;
  position: FundPositionResponse | null;
  config: FundConfigResponse | null;
  loadError: string | null;
  smartUsdcRaw: bigint;
  onRefetch: () => Promise<void>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="vault-dialog max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-[1040px] overflow-y-auto rounded-[28px] border border-[var(--vault-border-strong)] bg-[var(--vault-bg)] p-0 sm:max-w-[1040px]"
      >
        <DialogTitle className="sr-only">Manage ETH Cash-Secured Put Fund</DialogTitle>
        <DialogDescription className="sr-only">
          Deposit USDC or manage an accounting-asset redemption.
        </DialogDescription>
        <DialogClose asChild>
          <button
            type="button"
            aria-label="Close fund"
            className="absolute right-4 top-4 z-20 grid size-11 place-items-center rounded-full border border-[var(--vault-border)] bg-[var(--vault-surface-soft)] text-[var(--vault-text-muted)]"
          >
            <X className="size-5" />
          </button>
        </DialogClose>
        <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
          <FundOverview summary={props.summary} position={props.position} />
          <FundActionPanel {...props} />
        </div>
        <StrategyExplanation />
      </DialogContent>
    </Dialog>
  );
}

function StrategyExplanation() {
  return (
    <details className="group mx-6 mb-6 rounded-2xl border border-[var(--vault-border)] bg-[var(--vault-surface-soft)] sm:mx-8 sm:mb-8">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 px-4 text-sm font-medium text-[var(--vault-text-muted)] [&::-webkit-details-marker]:hidden">
        How this vault works
        <ChevronDown className="size-4 transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <ol className="space-y-3 border-t border-[var(--vault-border)] px-4 py-4 text-sm leading-6 text-[var(--vault-text-muted)]">
        <StrategyStep number="1" text="Deposit USDC and receive transferable fund shares." />
        <StrategyStep number="2" text="The fund uses part of its USDC to sell cash-secured ETH puts." />
        <StrategyStep number="3" text="Premium, liabilities, and any assigned WETH are reflected in the share price." />
        <StrategyStep number="4" text="To exit, request a redemption and claim USDC after it is processed." />
      </ol>
    </details>
  );
}

function StrategyStep({ number, text }: { number: string; text: string }) {
  return (
    <li className="flex gap-3">
      <span className="mt-1 grid size-5 shrink-0 place-items-center rounded-full bg-[var(--vault-bg)] font-mono text-[10px] text-[var(--vault-text-subtle)]">
        {number}
      </span>
      <span>{text}</span>
    </li>
  );
}

function FundOverview({
  summary,
  position,
}: {
  summary: FundSummaryResponse | null;
  position: FundPositionResponse | null;
}) {
  const assetDecimals = summary?.fund.accountingAsset.decimals ?? 6;
  const shareDecimals = summary?.fund.shareToken.decimals ?? 18;
  const composition = summary?.composition;
  const valuation = summary ? fundValuation(summary) : null;
  return (
    <section className="border-b border-[var(--vault-border)] p-6 sm:p-8 lg:border-b-0 lg:border-r lg:p-10">
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--vault-accent)]">
        ETH CSP · USDC
      </p>
      <h2 className="mt-3 pr-12 text-3xl font-semibold tracking-[-0.04em]">
        Your fund position
      </h2>
      <p className="mt-8 text-sm text-[var(--vault-text-muted)]">Accounting value</p>
      <p className="mt-2 font-mono text-4xl tracking-[-0.05em]">
        {currency.format(rawFundAmount(position?.accountingValue, assetDecimals))}
      </p>
      <p className="mt-2 font-mono text-xs text-[var(--vault-text-subtle)]">
        {amount.format(rawFundAmount(position?.shares, shareDecimals))} fund shares
      </p>
      <dl className="mt-10 grid grid-cols-2 gap-5 text-sm">
        <OverviewMetric
          label="Gross assets"
          value={assetValue(valuation?.grossAssets, assetDecimals)}
        />
        <OverviewMetric label="Idle USDC" value={assetValue(composition?.idleAssets, assetDecimals)} />
        <OverviewMetric
          label="Locked collateral"
          value={assetValue(valuation?.lockedCollateralAssets, assetDecimals)}
          detail="Fund asset · not a loss"
        />
        <OverviewMetric
          label="Fair put liability"
          value={liabilityValue(
            valuation?.fairOptionLiabilityAssets,
            assetDecimals,
          )}
        />
        <OverviewMetric
          label="Assigned WETH value"
          value={optionalAssetValue(
            valuation?.assignedWethValueAssets,
            assetDecimals,
          )}
          detail={`${amount.format(rawFundAmount(composition?.assignedWeth, 18))} WETH`}
        />
        <OverviewMetric
          label="Settlement costs"
          value={optionalAssetValue(
            valuation?.settlementCostAssets,
            assetDecimals,
          )}
        />
      </dl>
      <ValuationDetails summary={summary} />
    </section>
  );
}

function FundActionPanel(props: {
  summary: FundSummaryResponse | null;
  position: FundPositionResponse | null;
  config: FundConfigResponse | null;
  loadError: string | null;
  smartUsdcRaw: bigint;
  onRefetch: () => Promise<void>;
  open: boolean;
}) {
  const [action, setAction] = useState<DialogAction>("deposit");
  const [value, setValue] = useState("");
  const transaction = useFundTransaction(props, action, value, setValue);
  const plan = exitPlan(props.position);
  const decimals = props.summary?.fund.accountingAsset.decimals ?? 6;
  const availableRaw = action === "deposit"
    ? props.smartUsdcRaw
    : BigInt(props.position?.accountingValue ?? "0");
  const needsAmount = action === "deposit" || plan.key === "requestRedemption";
  const availability = action === "deposit"
    ? fundAction(props.summary?.actions, "deposit")
    : fundAction(props.position?.actions, plan.key);
  const rawInput = parseFundAmount(value, decimals);
  const expectedShares =
    action === "deposit" && props.summary && rawInput > BigInt(0)
      ? sharesForDeposit(rawInput, props.summary)
      : BigInt(0);
  const disabled = Boolean(
    props.loadError ||
    props.summary?.stale ||
    props.position?.stale ||
    !props.config?.writesEnabled ||
    !availability.available ||
    transaction.status === "submitting" ||
    (needsAmount && (rawInput <= BigInt(0) || rawInput > availableRaw)),
  );

  useEffect(() => {
    if (!props.open) {
      setAction("deposit");
      setValue("");
      transaction.reset();
    }
  }, [props.open]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="p-6 sm:p-8 lg:p-10">
      <ActionTabs action={action} onChange={(next) => { setAction(next); setValue(""); transaction.reset(); }} />
      <div className="mt-8 flex items-center justify-between text-sm">
        <span className="text-[var(--vault-text-muted)]">{action === "deposit" ? "Smart wallet" : "Available value"}</span>
        <button type="button" onClick={() => setValue(formatInput(availableRaw, decimals))} disabled={!needsAmount} className="min-h-11 font-mono text-[var(--vault-accent)] disabled:opacity-40">
          {amount.format(rawFundAmount(availableRaw, decimals))} USDC · MAX
        </button>
      </div>
      {needsAmount ? (
        <div className="mt-3 flex min-h-24 items-center rounded-[22px] border border-[var(--vault-border-strong)] bg-[var(--vault-surface-soft)] px-5 focus-within:border-[var(--vault-accent)]">
          <input value={value} onChange={(event) => setValue(event.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder="0.00" aria-label="USDC amount" className="min-w-0 flex-1 bg-transparent font-mono text-3xl outline-none" />
          <span className="font-mono">USDC</span>
        </div>
      ) : (
        <p className="mt-3 rounded-[22px] border border-[var(--vault-border-strong)] bg-[var(--vault-surface-soft)] px-5 py-5 text-sm leading-6 text-[var(--vault-text-muted)]">{plan.description}</p>
      )}
      {action === "deposit" && props.summary && expectedShares > BigInt(0) ? (
        <DepositNavPreview
          summary={props.summary}
          expectedShares={expectedShares}
        />
      ) : null}
      <button type="button" disabled={disabled} onClick={() => void transaction.submit(plan.key)} className="mt-6 min-h-14 w-full rounded-2xl border border-[var(--vault-accent)] text-base font-semibold text-[var(--vault-accent)] hover:bg-[var(--vault-accent-dim)] disabled:cursor-not-allowed disabled:border-[var(--vault-border)] disabled:text-[var(--vault-text-subtle)]">
        {transaction.status === "submitting" ? "Confirming..." : action === "deposit" ? "Deposit USDC" : plan.label}
      </button>
      <ActionStatus loadError={props.loadError} availability={availability} transaction={transaction} />
    </section>
  );
}

function useFundTransaction(
  props: Parameters<typeof FundActionPanel>[0],
  action: DialogAction,
  value: string,
  clearValue: (value: string) => void,
) {
  const { address, sendBatchTx } = useWallet();
  const [status, setStatus] = useState<TxStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [hash, setHash] = useState<string | null>(null);

  async function submit(exitAction: Exclude<FundActionKey, "deposit">) {
    if (!address) return setError("Smart wallet not ready.");
    setStatus("submitting");
    setError(null);
    try {
      const summary = props.summary;
      const position = props.position;
      const key = action === "deposit" ? "deposit" : exitAction;
      assertFundWriteAllowed(summary, props.config, position, key, address as Address);
      const calls = action === "deposit"
        ? await depositCalls(summary!, address as Address, value, props.smartUsdcRaw)
        : [exitCall(summary!, position!, exitAction, address as Address, value)];
      const confirmedHash = await sendAndWait(sendBatchTx(calls));
      setHash(confirmedHash);
      setStatus("confirmed");
      clearValue("");
      window.dispatchEvent(new Event("balance:refetch"));
      await props.onRefetch();
    } catch (cause) {
      setStatus("idle");
      setError(cause instanceof Error ? cause.message : "Fund transaction failed.");
    }
  }

  function reset() {
    setStatus("idle");
    setError(null);
    setHash(null);
  }
  return { status, error, hash, submit, reset };
}

async function depositCalls(
  summary: FundSummaryResponse,
  receiver: Address,
  value: string,
  balance: bigint,
) {
  const rawAssets = parseFundAmount(value, summary.fund.accountingAsset.decimals);
  if (rawAssets <= BigInt(0)) throw new Error("Enter a deposit amount.");
  if (rawAssets > balance) throw new Error("Insufficient USDC in smart wallet.");
  const currentAllowance = await publicClient.readContract({
    address: summary.fund.accountingAsset.address as Address,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [receiver, summary.fund.fundAddress as Address],
  });
  return buildFundDepositCalls({ summary, receiver, rawAssets, currentAllowance });
}

function exitCall(
  summary: FundSummaryResponse,
  position: FundPositionResponse,
  action: Exclude<FundActionKey, "deposit">,
  controller: Address,
  value: string,
) {
  const rawAssets = parseFundAmount(value, summary.fund.accountingAsset.decimals);
  const shares = action === "requestRedemption"
    ? sharesForAccountingAssets(rawAssets, position)
    : undefined;
  if (action === "requestRedemption" && (!shares || shares <= BigInt(0))) {
    throw new Error("Enter a valid redemption amount.");
  }
  return buildFundActionCall({ summary, position, actionKey: action, controller, shares });
}

async function sendAndWait(result: Promise<unknown>): Promise<string> {
  const hash = transactionHashFromResult(await result);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Fund transaction reverted.");
  return hash;
}

function exitPlan(position: FundPositionResponse | null): {
  key: Exclude<FundActionKey, "deposit">;
  label: string;
  description: string;
} {
  if (position?.actions.claimRedemption.available) {
    return { key: "claimRedemption", label: "Claim USDC", description: "Processed USDC is ready for your smart wallet." };
  }
  if (BigInt(position?.redemption.pendingShares ?? "0") > BigInt(0)) {
    return { key: "cancelRedemption", label: "Cancel request", description: "Cancel all pending shares while the current batch still permits it." };
  }
  return { key: "requestRedemption", label: "Request redemption", description: "Request an accounting-asset exit." };
}

function ActionTabs({ action, onChange }: { action: DialogAction; onChange: (action: DialogAction) => void }) {
  return (
    <div role="tablist" aria-label="Fund action" className="inline-grid grid-cols-2 rounded-2xl bg-[var(--vault-surface-soft)] p-1">
      {(["deposit", "redeem"] as const).map((item) => (
        <button key={item} type="button" role="tab" aria-selected={action === item} onClick={() => onChange(item)} className={`min-h-11 rounded-xl px-6 text-sm font-medium capitalize ${action === item ? "bg-[var(--vault-selected)]" : "text-[var(--vault-text-muted)]"}`}>{item === "redeem" ? "Exit" : "Deposit"}</button>
      ))}
    </div>
  );
}

function ActionStatus({ loadError, availability, transaction }: {
  loadError: string | null;
  availability: { available: boolean; reasonCode: string | null };
  transaction: ReturnType<typeof useFundTransaction>;
}) {
  const message = transaction.error ?? loadError ?? (!availability.available ? availability.reasonCode : null);
  if (transaction.status === "confirmed") {
    return <p className="mt-3 break-all font-mono text-xs text-[var(--vault-accent)]">Confirmed: {transaction.hash}</p>;
  }
  return message ? <p className="mt-3 text-xs leading-5 text-[var(--vault-text-subtle)]">{message.replaceAll("_", " ").toLowerCase()}</p> : null;
}

function DepositNavPreview({
  summary,
  expectedShares,
}: {
  summary: FundSummaryResponse;
  expectedShares: bigint;
}) {
  const valuation = fundValuation(summary);
  const assetDecimals = summary.fund.accountingAsset.decimals;
  const shareDecimals = summary.fund.shareToken.decimals;
  return (
    <div
      aria-label="Deposit share preview"
      className="mt-4 rounded-2xl border border-[var(--vault-border)] bg-[var(--vault-surface-soft)] px-4 py-3"
    >
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="text-[var(--vault-text-muted)]">Estimated shares</span>
        <span className="font-mono text-[var(--vault-text)]">
          {amount.format(rawFundAmount(expectedShares, shareDecimals))}
        </span>
      </div>
      <p className="mt-2 text-xs leading-5 text-[var(--vault-text-subtle)]">
        Minted synchronously at the current NAV price of{" "}
        {currency.format(
          rawFundAmount(valuation.navPriceAssets, assetDecimals),
        )}. Market and stress prices are display-only.
      </p>
    </div>
  );
}

function ValuationDetails({
  summary,
}: {
  summary: FundSummaryResponse | null;
}) {
  if (!summary) {
    return (
      <p className="mt-8 border-t border-[var(--vault-border)] pt-5 text-xs leading-5 text-[var(--vault-text-subtle)]">
        NAV report —
      </p>
    );
  }
  const valuation = fundValuation(summary);
  const decimals = summary.fund.accountingAsset.decimals;
  return (
    <div className="mt-8 border-t border-[var(--vault-border)] pt-5 text-xs leading-5 text-[var(--vault-text-subtle)]">
      <div className="grid grid-cols-3 gap-3">
        <ValuationPrice
          label="NAV price"
          value={assetValue(valuation.navPriceAssets, decimals)}
        />
        <ValuationPrice
          label="Market"
          value={optionalAssetValue(valuation.marketPriceAssets, decimals)}
        />
        <ValuationPrice
          label="Stress"
          value={optionalAssetValue(valuation.stressPriceAssets, decimals)}
        />
      </div>
      <p className="mt-4">
        {valuation.stale ? "Stale" : "Fresh"} · {valuation.methodology}
        {valuation.modelVersion ? ` · ${valuation.modelVersion}` : ""}
        {valuation.sourceQuality ? ` · ${valuation.sourceQuality}` : ""}
      </p>
      <p>
        Report {summary.nav.reportNonce} · block {summary.asOfBlock ?? "—"}
        {valuation.observedAt
          ? ` · ${formatObservedAt(valuation.observedAt)}`
          : ""}
      </p>
    </div>
  );
}

function ValuationPrice({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <span className="mt-0.5 block font-mono text-[var(--vault-text)]">
        {value}
      </span>
    </div>
  );
}

function OverviewMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div>
      <dt className="text-[var(--vault-text-subtle)]">{label}</dt>
      <dd className="mt-1 font-mono text-[var(--vault-text)]">{value}</dd>
      {detail ? (
        <dd className="mt-1 text-[10px] text-[var(--vault-text-subtle)]">
          {detail}
        </dd>
      ) : null}
    </div>
  );
}

function assetValue(raw: string | undefined, decimals: number): string {
  return currency.format(rawFundAmount(raw, decimals));
}

function optionalAssetValue(
  raw: string | null | undefined,
  decimals: number,
): string {
  return raw == null ? "—" : assetValue(raw, decimals);
}

function liabilityValue(
  raw: string | null | undefined,
  decimals: number,
): string {
  return raw == null ? "—" : `−${assetValue(raw, decimals)}`;
}

function formatObservedAt(value: string): string {
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime())
    ? value
    : timestamp.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
      });
}

function formatInput(raw: bigint, decimals: number): string {
  return rawFundAmount(raw, decimals).toFixed(decimals).replace(/\.?0+$/, "");
}
