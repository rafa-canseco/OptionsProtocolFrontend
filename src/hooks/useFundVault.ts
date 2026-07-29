"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Address } from "viem";
import type {
  FundConfigResponse,
  FundPositionResponse,
  FundSummaryResponse,
} from "@/lib/api";
import { api } from "@/lib/api";
import {
  applyOptimisticFundDeposits,
  FUND_DEPOSIT_FAST_POLL_MS,
  FUND_DEPOSIT_FAST_POLL_WINDOW_MS,
  loadOptimisticFundDeposits,
  persistOptimisticFundDeposits,
  unresolvedFundDeposits,
  upsertOptimisticFundDeposit,
  type FundVaultSnapshot,
  type OptimisticFundDeposit,
} from "@/lib/fundDepositReconciliation";
import {
  configuredFundAddress,
  configuredFundKey,
  fundTrustError,
} from "@/lib/fundVault";
import {
  BASE_SEPOLIA_CSP_FUND,
  type TrustedFundDeployment,
} from "@/lib/fundDeployment";

const FUND_REFRESH_INTERVAL_MS = 5_000;

export type FundVaultState = {
  summary: FundSummaryResponse | null;
  position: FundPositionResponse | null;
  canonicalSummary: FundSummaryResponse | null;
  canonicalPosition: FundPositionResponse | null;
  config: FundConfigResponse | null;
  optimisticDeposits: OptimisticFundDeposit[];
  loading: boolean;
  error: string | null;
  trustError: string | null;
  refetch: () => Promise<FundVaultSnapshot | null>;
  addConfirmedDeposit: (deposit: OptimisticFundDeposit) => void;
};

export function useFundVault(
  address: Address | undefined,
  deployment: TrustedFundDeployment = BASE_SEPOLIA_CSP_FUND,
): FundVaultState {
  const [canonicalSummary, setCanonicalSummary] =
    useState<FundSummaryResponse | null>(null);
  const [canonicalPosition, setCanonicalPosition] =
    useState<FundPositionResponse | null>(null);
  const [config, setConfig] = useState<FundConfigResponse | null>(null);
  const [optimisticDeposits, setOptimisticDeposits] = useState<
    OptimisticFundDeposit[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const fundKey = configuredFundKey(deployment);
  const fundAddress = configuredFundAddress(deployment);

  const refetch = useCallback(async () => {
    const nextRequestId = ++requestId.current;
    if (!fundKey || !fundAddress) {
      setError("Fund allowlist is not configured.");
      setLoading(false);
      return null;
    }
    setLoading(true);
    try {
      const [nextSummary, nextConfig, nextPosition] = await Promise.all([
        api.getFund(fundKey),
        api.getFundConfig(fundKey),
        address ? api.getFundPosition(fundKey, address) : null,
      ]);
      if (requestId.current !== nextRequestId) return null;
      const snapshot = {
        summary: nextSummary,
        position: nextPosition,
      } satisfies FundVaultSnapshot;
      setCanonicalSummary(nextSummary);
      setConfig(nextConfig);
      setCanonicalPosition(nextPosition);
      if (address) {
        setOptimisticDeposits((current) => {
          const scoped = current.filter(
            (deposit) =>
              deposit.fundKey === fundKey &&
              deposit.smartWallet.toLowerCase() === address.toLowerCase() &&
              deposit.fundAddress.toLowerCase() ===
                fundAddress.toLowerCase(),
          );
          const next = unresolvedFundDeposits(snapshot, scoped);
          if (
            next.length === current.length &&
            next.every(
              (deposit, index) =>
                deposit.transactionHash ===
                current[index]?.transactionHash,
            )
          ) {
            return current;
          }
          persistOptimisticFundDeposits(fundKey, address, next);
          return next;
        });
      }
      setError(null);
      return snapshot;
    } catch (cause) {
      if (requestId.current !== nextRequestId) return null;
      setError(cause instanceof Error ? cause.message : "Could not refresh fund data.");
      return null;
    } finally {
      if (requestId.current === nextRequestId) setLoading(false);
    }
  }, [address, fundAddress, fundKey]);

  useEffect(() => {
    const next = address
      ? loadOptimisticFundDeposits(fundKey, address).filter(
          (deposit) =>
            deposit.fundAddress.toLowerCase() === fundAddress.toLowerCase(),
        )
      : [];
    setOptimisticDeposits(next);
    if (address) {
      persistOptimisticFundDeposits(fundKey, address, next);
    }
  }, [address, fundAddress, fundKey]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useEffect(() => {
    const handleFocus = () => void refetch();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void refetch();
    };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [refetch]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const fastReconciliationActive = optimisticDeposits.some(
        (deposit) =>
          Date.now() - deposit.confirmedAt <
          FUND_DEPOSIT_FAST_POLL_WINDOW_MS,
      );
      if (
        !fastReconciliationActive &&
        document.visibilityState === "visible"
      ) {
        void refetch();
      }
    }, FUND_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [optimisticDeposits, refetch]);

  useEffect(() => {
    const active = optimisticDeposits.filter(
      (deposit) =>
        Date.now() - deposit.confirmedAt <
        FUND_DEPOSIT_FAST_POLL_WINDOW_MS,
    );
    if (active.length === 0) return;
    const stopAt = Math.max(
      ...active.map(
        (deposit) =>
          deposit.confirmedAt + FUND_DEPOSIT_FAST_POLL_WINDOW_MS,
      ),
    );
    void refetch();
    const interval = window.setInterval(() => {
      if (Date.now() >= stopAt) {
        window.clearInterval(interval);
        return;
      }
      if (document.visibilityState === "visible") void refetch();
    }, FUND_DEPOSIT_FAST_POLL_MS);
    return () => window.clearInterval(interval);
  }, [optimisticDeposits, refetch]);

  const addConfirmedDeposit = useCallback(
    (deposit: OptimisticFundDeposit) => {
      if (
        !address ||
        deposit.fundKey !== fundKey ||
        deposit.fundAddress.toLowerCase() !== fundAddress.toLowerCase() ||
        deposit.smartWallet.toLowerCase() !== address.toLowerCase()
      ) {
        throw new Error("Confirmed deposit does not match the active fund.");
      }
      setOptimisticDeposits((current) => {
        const next = upsertOptimisticFundDeposit(current, deposit);
        persistOptimisticFundDeposits(fundKey, address, next);
        return next;
      });
    },
    [address, fundAddress, fundKey],
  );

  const displaySnapshot = useMemo(
    () =>
      applyOptimisticFundDeposits(
        canonicalSummary,
        canonicalPosition,
        optimisticDeposits,
        address,
      ),
    [address, canonicalPosition, canonicalSummary, optimisticDeposits],
  );
  const summary = displaySnapshot?.summary ?? canonicalSummary;
  const position = displaySnapshot?.position ?? canonicalPosition;
  const trustError = canonicalSummary && config
    ? fundTrustError(
        canonicalSummary,
        config,
        canonicalPosition,
        address,
        deployment,
      )
    : null;
  return {
    summary,
    position,
    canonicalSummary,
    canonicalPosition,
    config,
    optimisticDeposits,
    loading,
    error,
    trustError,
    refetch,
    addConfirmedDeposit,
  };
}
