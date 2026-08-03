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
  BASE_SEPOLIA_CSP_FUND,
  type TrustedFundDeployment,
} from "@/lib/fundDeployment";
import {
  CSP_VAULT_CARD,
  type VaultCardMetadata,
} from "@/lib/vaults";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { invalidateData } from "@/lib/dataInvalidation";

type DialogAction = "deposit" | "redeem";
type TxStatus = "idle" | "submitting" | "confirmed";

const amount = new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 });
const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const strikeCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const optionAmount = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 8,
});
const cycleDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
});

function feePercent(bps: number): string {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(
    bps / 100,
  )}%`;
}

type VaultDialogProps = {
  vault?: VaultCardMetadata;
  deployment?: TrustedFundDeployment;
  summary: FundSummaryResponse | null;
  position: FundPositionResponse | null;
  config: FundConfigResponse | null;
  loadError: string | null;
  smartAssetRaw?: bigint;
  /** @deprecated Use smartAssetRaw. */
  smartUsdcRaw?: bigint;
  onRefetch: () => Promise<void>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type ResolvedVaultDialogProps = Omit<
  VaultDialogProps,
  "vault" | "deployment" | "smartAssetRaw"
> & {
  vault: VaultCardMetadata;
  deployment: TrustedFundDeployment;
  smartAssetRaw: bigint;
};

export function VaultDialog(props: VaultDialogProps) {
  const resolved: ResolvedVaultDialogProps = {
    ...props,
    vault: props.vault ?? CSP_VAULT_CARD,
    deployment: props.deployment ?? BASE_SEPOLIA_CSP_FUND,
    smartAssetRaw: props.smartAssetRaw ?? props.smartUsdcRaw ?? BigInt(0),
  };
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="vault-dialog max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-[1040px] overflow-y-auto rounded-[28px] border border-[var(--vault-border-strong)] bg-[var(--vault-bg)] p-0 sm:max-w-[1040px]"
      >
        <DialogTitle className="sr-only">
          Manage {resolved.vault.name} Fund
        </DialogTitle>
        <DialogDescription className="sr-only">
          Deposit {resolved.vault.accountingAssetSymbol} or manage an
          accounting-asset redemption.
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
          <FundOverview
            vault={resolved.vault}
            summary={props.summary}
            position={props.position}
          />
          <FundActionPanel {...resolved} />
        </div>
        <StrategyExplanation vault={resolved.vault} config={props.config} />
      </DialogContent>
    </Dialog>
  );
}

function StrategyExplanation({
  vault,
  config,
}: {
  vault: VaultCardMetadata;
  config: FundConfigResponse | null;
}) {
  return (
    <details className="group mx-6 mb-6 rounded-2xl border border-[var(--vault-border)] bg-[var(--vault-surface-soft)] sm:mx-8 sm:mb-8">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 px-4 text-sm font-medium text-[var(--vault-text-muted)] [&::-webkit-details-marker]:hidden">
        How this vault works
        <ChevronDown className="size-4 transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <div className="border-t border-[var(--vault-border)] px-4 py-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--vault-accent)]">
              Current Base Sepolia strategy
            </p>
            <p className="mt-1 text-sm leading-6 text-[var(--vault-text-muted)]">
              {vault.policy.intro}
            </p>
          </div>
          <span className="mt-2 w-fit rounded-full border border-[var(--vault-border)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--vault-text-subtle)] sm:mt-0">
            Automatic loop
          </span>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[var(--vault-border)] bg-[var(--vault-border)] sm:grid-cols-4">
          <StrategyFact label="Strike" value={vault.policy.strike} />
          <StrategyFact label="Duration" value={vault.policy.duration} />
          <StrategyFact label="Allocation" value={vault.policy.allocation} />
          <StrategyFact label="Positions" value={vault.policy.positionLimit} />
        </dl>

        {config?.fees ? (
          <section
            aria-label="Vault fees"
            className="mt-5 rounded-xl border border-[var(--vault-border)] bg-[var(--vault-bg)] p-4"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--vault-accent)]">
              Active fees
            </p>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
              <StrategyFact
                label="Management"
                value={`${feePercent(config.fees.managementFeeBps)} annually`}
              />
              <StrategyFact
                label="Performance"
                value={feePercent(config.fees.performanceFeeBps)}
              />
              <StrategyFact
                label="Option premium"
                value={feePercent(config.fees.premiumFeeBps)}
              />
            </dl>
            <p className="mt-3 text-xs leading-5 text-[var(--vault-text-muted)]">
              Performance fees apply only to gains in NAV per share above the
              previous high-water mark. Premium and earnings shown here are net
              of the fee charged on gross option premium.
            </p>
          </section>
        ) : null}

        <ol className="mt-5 space-y-3 text-sm leading-6 text-[var(--vault-text-muted)]">
          {vault.policy.steps.map((step, index) => (
            <StrategyStep
              key={step}
              number={String(index + 1)}
              text={step}
            />
          ))}
        </ol>
      </div>
    </details>
  );
}

function StrategyFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[var(--vault-bg)] px-3 py-3">
      <dt className="text-[10px] uppercase tracking-[0.12em] text-[var(--vault-text-subtle)]">
        {label}
      </dt>
      <dd className="mt-1 font-mono text-xs text-[var(--vault-text)]">
        {value}
      </dd>
    </div>
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
  vault,
  summary,
  position,
}: {
  vault: VaultCardMetadata;
  summary: FundSummaryResponse | null;
  position: FundPositionResponse | null;
}) {
  const assetDecimals = summary?.fund.accountingAsset.decimals ?? 6;
  const shareDecimals = summary?.fund.shareToken.decimals ?? 18;
  const composition = summary?.composition;
  const valuation = summary ? fundValuation(summary) : null;
  const assignedWethValue = valuation?.assignedWethValueAssets;
  const idleHelp =
    vault.strategyKind === "covered_call"
      ? `New positions secure up to 80% of the available ${vault.accountingAssetSymbol} at the start of each cycle. The remaining 20% stays liquid, and an open position is not resized mid-cycle.`
      : `${vault.accountingAssetSymbol} that is not locked as option collateral. It remains available for the next position or redemption processing.`;
  return (
    <section className="border-b border-[var(--vault-border)] p-6 sm:p-8 lg:border-b-0 lg:border-r lg:p-10">
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--vault-accent)]">
        {vault.strategyKind === "covered_call" ? "ETH CALL" : "ETH CSP"} ·{" "}
        {vault.accountingAssetSymbol}
      </p>
      <h2 className="mt-3 pr-12 text-3xl font-semibold tracking-[-0.04em]">
        Your fund position
      </h2>
      <p className="mt-8 text-sm text-[var(--vault-text-muted)]">Accounting value</p>
      <p className="mt-2 font-mono text-4xl tracking-[-0.05em]">
        {assetValue(
          position?.accountingValue,
          assetDecimals,
          vault.accountingAssetSymbol,
        )}
      </p>
      <p className="mt-2 font-mono text-xs text-[var(--vault-text-subtle)]">
        {amount.format(rawFundAmount(position?.shares, shareDecimals))} fund shares
      </p>
      <OptionCycle vault={vault} summary={summary} />
      <dl className="mt-10 grid grid-cols-2 gap-5 text-sm">
        <OverviewMetric
          label="Gross assets"
          value={assetValue(
            valuation?.grossAssets,
            assetDecimals,
            vault.accountingAssetSymbol,
          )}
          help={`Everything the fund owns before deducting the open ${vault.strategyKind === "covered_call" ? "call" : "put"} obligation and settlement costs.`}
        />
        <OverviewMetric
          label={`Idle ${vault.accountingAssetSymbol}`}
          value={assetValue(
            composition?.idleAssets,
            assetDecimals,
            vault.accountingAssetSymbol,
          )}
          help={idleHelp}
        />
        <OverviewMetric
          label="Locked collateral"
          value={assetValue(
            valuation?.lockedCollateralAssets,
            assetDecimals,
            vault.accountingAssetSymbol,
          )}
          help={`${vault.accountingAssetSymbol} securing the open option. It still belongs to the fund and is not a loss.`}
        />
        <OverviewMetric
          label={`Fair ${vault.strategyKind === "covered_call" ? "call" : "put"} liability`}
          value={liabilityValue(
            valuation?.fairOptionLiabilityAssets,
            assetDecimals,
            vault.accountingAssetSymbol,
          )}
          help={`The estimated value of the fund's open ${vault.strategyKind === "covered_call" ? "call" : "put"} obligation. This amount—not the collateral—is deducted to calculate NAV.`}
        />
        {vault.strategyKind === "covered_call" &&
        isPositiveRaw(composition?.transientUsdc) ? (
          <OverviewMetric
            label="Premium awaiting conversion"
            value={`${amount.format(rawFundAmount(composition?.transientUsdc, 6))} USDC`}
            detail={`≈ ${optionalAssetValue(
              composition?.transientUsdcValueAssets,
              assetDecimals,
              vault.accountingAssetSymbol,
            )} in NAV`}
            help="Covered-call premiums arrive in USDC. The vault includes their WETH-equivalent value in NAV and converts them to WETH after settlement before opening the next cycle."
          />
        ) : null}
        {isPositiveRaw(assignedWethValue) ? (
          <OverviewMetric
            label="Assigned WETH"
            value={optionalAssetValue(
              assignedWethValue,
              assetDecimals,
              vault.accountingAssetSymbol,
            )}
            detail={`${amount.format(rawFundAmount(composition?.assignedWeth, 18))} WETH`}
            help="WETH received after a put assignment. It remains inside the fund and is included in your share value."
          />
        ) : null}
      </dl>
      <ValuationDetails vault={vault} summary={summary} />
    </section>
  );
}

function OptionCycle({
  vault,
  summary,
}: {
  vault: VaultCardMetadata;
  summary: FundSummaryResponse | null;
}) {
  const strategy = summary?.strategy;
  const latest = strategy?.latestPosition;
  if (!summary || !strategy) return null;

  const isCurrent =
    latest?.lifecycle === "open" ||
    latest?.lifecycle === "awaiting_physical_delivery";
  const assetDecimals = summary.fund.accountingAsset.decimals;
  const premiumToken =
    vault.strategyKind === "covered_call"
      ? summary.fund.quoteAsset
      : summary.fund.accountingAsset;
  const premiumDecimals = premiumToken?.decimals ?? assetDecimals;
  const premiumSymbol =
    premiumToken?.symbol ??
    (vault.strategyKind === "covered_call" ? "USDC" : vault.accountingAssetSymbol);
  const expiry = latest?.expiryTimestamp
    ? cycleDate.format(new Date(latest.expiryTimestamp * 1000))
    : null;
  const strike = latest?.strikePriceUsd8
    ? strikeCurrency.format(rawFundAmount(latest.strikePriceUsd8, 8))
    : "ETH";

  const optionLabel = vault.strategyKind === "covered_call" ? "call" : "put";
  const cycleLabel =
    vault.strategyKind === "covered_call" ? "call cycle" : "CSP cycle";

  return (
    <div className="mt-8 rounded-2xl border border-[var(--vault-border)] bg-[var(--vault-surface-soft)] p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center text-xs text-[var(--vault-text-subtle)]">
            <span>
              {isCurrent ? "Current" : "Latest"} {cycleLabel}
            </span>
            <InfoTooltip
              title={`${optionLabel === "call" ? "Covered call" : "CSP"} cycle`}
              text={`The most recently opened ETH ${optionLabel} and the ${vault.accountingAssetSymbol} committed to it.`}
            />
          </div>
          <p className="mt-1 font-mono text-lg text-[var(--vault-text)]">
            {latest ? `${strike} ${optionLabel}` : `No ${optionLabel} opened yet`}
          </p>
        </div>
        <span className="rounded-full border border-[var(--vault-border)] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--vault-accent)]">
          {latest ? cycleStatus(latest.lifecycle) : "Waiting"}
        </span>
      </div>
      {latest ? (
        <p className="mt-2 text-xs leading-5 text-[var(--vault-text-muted)]">
          {optionAmount.format(rawFundAmount(latest.optionAmount8, 8))} ETH
          {" · "}
          {assetValue(
            latest.collateralAssets,
            assetDecimals,
            vault.accountingAssetSymbol,
          )}{" "}
          secured
          {expiry ? ` · Expires ${expiry}` : ""}
        </p>
      ) : (
        <p className="mt-2 text-xs leading-5 text-[var(--vault-text-muted)]">
          The first eligible position opens automatically after the vault has
          enough {vault.accountingAssetSymbol}, a current NAV and a valid quote.
        </p>
      )}
      <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-[var(--vault-border)] pt-4 text-sm">
        <div>
          <dt className="flex items-center text-xs text-[var(--vault-text-subtle)]">
            <span>Net premium</span>
            <InfoTooltip
              title="Net premium"
              text={`${premiumSymbol} retained after the protocol fee across this vault's ${optionLabel} cycles. It remains accounted inside the fund and is included in NAV.`}
            />
          </dt>
          <dd className="mt-1 font-mono text-[var(--vault-text)]">
            {tokenValue(
              strategy.totalPremiumCollectedAssets,
              premiumDecimals,
            )}{" "}
            {premiumSymbol}
          </dd>
        </div>
        <div>
          <dt className="flex items-center text-xs text-[var(--vault-text-subtle)]">
            <span>Next position</span>
            <InfoTooltip
              title="Next position"
              text={`The earliest opening window. The vault must first settle the current ${optionLabel}, then have a current NAV and an eligible quote.`}
            />
          </dt>
          <dd className="mt-1 text-[var(--vault-text)]">
            {nextPositionLabel(
              strategy.nextOpenCondition,
              strategy.nextOpenAfter,
            )}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function FundActionPanel(props: ResolvedVaultDialogProps) {
  const [action, setAction] = useState<DialogAction>("deposit");
  const [value, setValue] = useState("");
  const transaction = useFundTransaction(props, action, value, setValue);
  const plan = exitPlan(
    props.position,
    props.vault.accountingAssetSymbol,
  );
  const decimals = props.summary?.fund.accountingAsset.decimals ?? 6;
  const availableRaw = action === "deposit"
    ? props.smartAssetRaw
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
          {amount.format(rawFundAmount(availableRaw, decimals))}{" "}
          {props.vault.accountingAssetSymbol} · MAX
        </button>
      </div>
      {needsAmount ? (
        <div className="mt-3 flex min-h-24 items-center rounded-[22px] border border-[var(--vault-border-strong)] bg-[var(--vault-surface-soft)] px-5 focus-within:border-[var(--vault-accent)]">
          <input value={value} onChange={(event) => setValue(event.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder="0.00" aria-label={`${props.vault.accountingAssetSymbol} amount`} className="min-w-0 flex-1 bg-transparent font-mono text-3xl outline-none" />
          <span className="font-mono">{props.vault.accountingAssetSymbol}</span>
        </div>
      ) : (
        <p className="mt-3 rounded-[22px] border border-[var(--vault-border-strong)] bg-[var(--vault-surface-soft)] px-5 py-5 text-sm leading-6 text-[var(--vault-text-muted)]">{plan.description}</p>
      )}
      {action === "deposit" && props.summary && expectedShares > BigInt(0) ? (
        <DepositNavPreview
          summary={props.summary}
          expectedShares={expectedShares}
          assetSymbol={props.vault.accountingAssetSymbol}
        />
      ) : null}
      <button type="button" disabled={disabled} onClick={() => void transaction.submit(plan.key)} className="mt-6 min-h-14 w-full rounded-2xl border border-[var(--vault-accent)] text-base font-semibold text-[var(--vault-accent)] hover:bg-[var(--vault-accent-dim)] disabled:cursor-not-allowed disabled:border-[var(--vault-border)] disabled:text-[var(--vault-text-subtle)]">
        {transaction.status === "submitting"
          ? "Confirming..."
          : action === "deposit"
            ? `Deposit ${props.vault.accountingAssetSymbol}`
            : plan.label}
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
      assertFundWriteAllowed(
        summary,
        props.config,
        position,
        key,
        address as Address,
        props.deployment,
      );
      const calls = action === "deposit"
        ? await depositCalls(
            summary!,
            address as Address,
            value,
            props.smartAssetRaw,
          )
        : [exitCall(summary!, position!, exitAction, address as Address, value)];
      const confirmedHash = await sendAndWait(sendBatchTx(calls));
      setHash(confirmedHash);
      setStatus("confirmed");
      clearValue("");
      invalidateData(["balances", "vault"], "vault-transaction-confirmed");
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
  if (rawAssets > balance) {
    throw new Error(
      `Insufficient ${summary.fund.accountingAsset.symbol} in smart wallet.`,
    );
  }
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

function exitPlan(
  position: FundPositionResponse | null,
  assetSymbol: string,
): {
  key: Exclude<FundActionKey, "deposit">;
  label: string;
  description: string;
} {
  if (position?.actions.claimRedemption.available) {
    return {
      key: "claimRedemption",
      label: `Claim ${assetSymbol}`,
      description: `Processed ${assetSymbol} is ready for your smart wallet.`,
    };
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
  return message ? (
    <p className="mt-3 text-xs leading-5 text-[var(--vault-text-subtle)]">
      {actionMessage(message)}
    </p>
  ) : null;
}

function DepositNavPreview({
  summary,
  expectedShares,
  assetSymbol,
}: {
  summary: FundSummaryResponse;
  expectedShares: bigint;
  assetSymbol: string;
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
        Estimated using the current NAV price of{" "}
        {assetValue(
          valuation.navPriceAssets,
          assetDecimals,
          assetSymbol,
        )}. Your transaction includes minimum-share protection.
      </p>
    </div>
  );
}

function ValuationDetails({
  vault,
  summary,
}: {
  vault: VaultCardMetadata;
  summary: FundSummaryResponse | null;
}) {
  if (!summary) {
    return (
      <p className="mt-8 border-t border-[var(--vault-border)] pt-5 text-xs leading-5 text-[var(--vault-text-subtle)]">
        Share price —
      </p>
    );
  }
  const valuation = fundValuation(summary);
  const decimals = summary.fund.accountingAsset.decimals;
  return (
    <div className="mt-8 flex items-end justify-between gap-6 border-t border-[var(--vault-border)] pt-5">
      <ValuationPrice
        label="NAV price"
        value={assetValue(
          valuation.navPriceAssets,
          decimals,
          vault.accountingAssetSymbol,
        )}
        help="The current value of one fund share, calculated from everything the fund owns minus its option obligation and settlement costs."
      />
      <div className="text-right">
        <div className="flex items-center justify-end">
          <span
            className={`size-1.5 rounded-full ${
              valuation.stale
                ? "bg-[var(--vault-text-subtle)]"
                : "bg-[var(--vault-accent)]"
            }`}
            aria-hidden="true"
          />
          <span className="ml-2 text-xs text-[var(--vault-text-muted)]">
            {valuation.stale ? "Price updating" : "Price current"}
          </span>
          <InfoTooltip
            title="Price status"
            text="Deposits and exits pause while the fund publishes an updated share price. They reopen automatically when the price is current."
          />
        </div>
      </div>
    </div>
  );
}

function ValuationPrice({
  label,
  value,
  help,
}: {
  label: string;
  value: string;
  help: string;
}) {
  return (
    <div>
      <div className="flex items-center text-xs text-[var(--vault-text-subtle)]">
        <span>{label}</span>
        <InfoTooltip title={label} text={help} />
      </div>
      <span className="mt-1 block font-mono text-sm text-[var(--vault-text)]">
        {value}
      </span>
    </div>
  );
}

function OverviewMetric({
  label,
  value,
  detail,
  help,
}: {
  label: string;
  value: string;
  detail?: string;
  help: string;
}) {
  return (
    <div>
      <dt className="flex items-center text-[var(--vault-text-subtle)]">
        <span>{label}</span>
        <InfoTooltip title={label} text={help} />
      </dt>
      <dd className="mt-1 font-mono text-[var(--vault-text)]">{value}</dd>
      {detail ? (
        <dd className="mt-1 text-[10px] text-[var(--vault-text-subtle)]">
          {detail}
        </dd>
      ) : null}
    </div>
  );
}

function assetValue(
  raw: string | undefined,
  decimals: number,
  symbol = "USDC",
): string {
  const value = rawFundAmount(raw, decimals);
  if (symbol === "USDC") return currency.format(value);
  return `${amount.format(value)} ${symbol}`;
}

function optionalAssetValue(
  raw: string | null | undefined,
  decimals: number,
  symbol = "USDC",
): string {
  return raw == null ? "—" : assetValue(raw, decimals, symbol);
}

function liabilityValue(
  raw: string | null | undefined,
  decimals: number,
  symbol = "USDC",
): string {
  if (raw == null) return "—";
  const value = rawFundAmount(raw, decimals);
  if (value === 0) return assetValue("0", decimals, symbol);
  if (symbol === "USDC" && value < 0.01) return "−<$0.01";
  return `−${assetValue(raw, decimals, symbol)}`;
}

function isPositiveRaw(raw: string | null | undefined): boolean {
  if (!raw) return false;
  try {
    return BigInt(raw) > BigInt(0);
  } catch {
    return false;
  }
}

function tokenValue(raw: string | null | undefined, decimals: number): string {
  if (raw == null) return "—";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: decimals,
  }).format(rawFundAmount(raw, decimals));
}

function cycleStatus(lifecycle: string): string {
  const labels: Record<string, string> = {
    open: "Open",
    awaiting_physical_delivery: "Settling",
    settled_otm: "Settled OTM",
    settled_itm: "Settled ITM",
    called_away: "Called away",
    normalizing_usdc: "Returning to WETH",
  };
  return labels[lifecycle] ?? lifecycle.replaceAll("_", " ");
}

function nextPositionLabel(condition: string, nextOpenAfter: number | null): string {
  if (condition === "after_current_settlement") {
    return nextOpenAfter
      ? `After ${cycleDate.format(new Date(nextOpenAfter * 1000))} settlement`
      : "After current settlement";
  }
  if (condition === "when_pricing_is_ready") {
    return "When pricing is ready";
  }
  if (condition === "awaiting_physical_delivery") {
    return "After settlement completes";
  }
  if (condition === "after_usdc_normalization") {
    return "After USDC returns to WETH";
  }
  if (condition === "when_funded_and_pricing_is_ready") {
    return "When WETH and pricing are ready";
  }
  return "After funding and pricing";
}

function actionMessage(message: string): string {
  const normalized = message.trim().toUpperCase();
  if (
    normalized === "NAV_NOT_ACTIVE" ||
    normalized === "STALE_SNAPSHOT" ||
    normalized === "NAV_STALE"
  ) {
    return "Price is updating. Deposits and exits will reopen automatically.";
  }
  if (normalized === "DEPOSITS_PAUSED") {
    return "Deposits are temporarily paused.";
  }
  if (normalized === "REDEMPTIONS_PAUSED") {
    return "Exits are temporarily paused.";
  }
  return message.replaceAll("_", " ").toLowerCase();
}

function formatInput(raw: bigint, decimals: number): string {
  return rawFundAmount(raw, decimals).toFixed(decimals).replace(/\.?0+$/, "");
}
