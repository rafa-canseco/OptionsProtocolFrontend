"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Address } from "viem";
import { api, type CspUserPositionResponse, type CspVaultResponse } from "@/lib/api";
import {
  CSP_VAULT_ADDRESS,
  CSP_VAULT_KEY,
  assertCspSnapshotTrusted,
} from "@/lib/cspVault";

export type CspVaultState = {
  vault: CspVaultResponse | null;
  user: CspUserPositionResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

export function useCspVault(address: Address | undefined): CspVaultState {
  const [vault, setVault] = useState<CspVaultResponse | null>(null);
  const [user, setUser] = useState<CspUserPositionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const refetch = useCallback(async () => {
    const nextRequestId = requestId.current + 1;
    requestId.current = nextRequestId;
    if (!CSP_VAULT_KEY || !CSP_VAULT_ADDRESS) {
      setVault(null);
      setUser(null);
      setError("CSP vault allowlist is not configured.");
      setLoading(false);
      return;
    }
    try {
      const [nextVault, nextUser] = await Promise.all([
        api.getCspVault(CSP_VAULT_KEY),
        address ? api.getCspVaultPosition(CSP_VAULT_KEY, address) : null,
      ]);
      if (requestId.current !== nextRequestId) return;
      assertCspSnapshotTrusted(nextVault, nextUser, address);
      setVault(nextVault);
      setUser(nextUser);
      setError(null);
    } catch (err) {
      if (requestId.current !== nextRequestId) return;
      setVault(null);
      setUser(null);
      setError(err instanceof Error ? err.message : "Could not load vault data.");
    } finally {
      if (requestId.current === nextRequestId) setLoading(false);
    }
  }, [address]);

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
    const handler = () => {
      void refetch();
    };
    window.addEventListener("csp-vault:refetch", handler);
    return () => {
      window.removeEventListener("csp-vault:refetch", handler);
    };
  }, [refetch]);

  return { vault, user, loading, error, refetch };
}
