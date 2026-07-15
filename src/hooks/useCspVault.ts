"use client";

import { useCallback, useEffect, useState } from "react";
import type { Address } from "viem";
import { api, type CspUserPositionResponse, type CspVaultResponse } from "@/lib/api";
import { CSP_VAULT_KEY } from "@/lib/cspVault";

export type CspVaultState = {
  vault: CspVaultResponse | null;
  user: CspUserPositionResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

const POLL_MS = 15_000;

export function useCspVault(address: Address | undefined): CspVaultState {
  const [vault, setVault] = useState<CspVaultResponse | null>(null);
  const [user, setUser] = useState<CspUserPositionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      const nextVault = await api.getCspVault(CSP_VAULT_KEY);
      const nextUser = address
        ? await api.getCspVaultPosition(CSP_VAULT_KEY, address)
        : null;
      setVault(nextVault);
      setUser(nextUser);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load vault data.");
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.hidden) return;
      void refetch();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [refetch]);

  useEffect(() => {
    const handler = () => {
      void refetch();
    };
    window.addEventListener("csp-vault:refetch", handler);
    window.addEventListener("balance:refetch", handler);
    return () => {
      window.removeEventListener("csp-vault:refetch", handler);
      window.removeEventListener("balance:refetch", handler);
    };
  }, [refetch]);

  return { vault, user, loading, error, refetch };
}
