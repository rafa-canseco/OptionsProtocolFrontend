"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useB1naryAccount } from "@/hooks/useB1naryAccount";
import { useAppPreferences } from "@/lib/preferences";

function sanitizeUsername(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 32);
}

export function B1naryAccountOnboarding() {
  const { locale } = useAppPreferences();
  const t = (en: string, es: string) => locale === "es" ? es : en;
  const {
    account,
    createAccount,
    error,
    loading,
    needsOnboarding,
    syncTrustedWallets,
    syncing,
    trustedWalletCandidates,
  } = useB1naryAccount();
  const [username, setUsername] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(needsOnboarding);
  }, [needsOnboarding]);

  const walletCount = trustedWalletCandidates.length;
  const canSubmit = useMemo(
    () => username.trim().length >= 3 && !submitting && !loading,
    [loading, submitting, username],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanUsername = sanitizeUsername(username.trim());
    if (cleanUsername.length < 3) {
      setLocalError(t("Use at least 3 letters or numbers.", "Usa al menos 3 letras o números."));
      return;
    }

    setSubmitting(true);
    setLocalError(null);
    try {
      const created = await createAccount(cleanUsername);
      await syncTrustedWallets(created);
      setOpen(false);
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : t("Could not create b1nary account", "No se pudo crear la cuenta de b1nary"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (account || (!needsOnboarding && !open)) return null;
  const displayedError = localError ?? (error ? t(error, "No se pudo completar la configuración. Inténtalo de nuevo.") : null);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>{t("Create your b1nary account", "Crea tu cuenta de b1nary")}</DialogTitle>
            <DialogDescription>
              {t("Choose a username. Your Base and Solana trading accounts will be grouped under it.", "Elige un nombre de usuario. Tus cuentas de Base y Solana quedarán agrupadas en él.")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label
              htmlFor="b1nary-username"
              className="text-sm font-medium text-[var(--text)]"
            >
              {t("Username", "Nombre de usuario")}
            </label>
            <Input
              id="b1nary-username"
              value={username}
              onChange={(event) => {
                setUsername(sanitizeUsername(event.target.value));
                setLocalError(null);
              }}
              autoComplete="off"
              autoFocus
              placeholder="rafa"
            />
            <p className="text-xs text-[var(--text-secondary)]">
              {walletCount > 0
                ? locale === "es" ? `${walletCount} cuenta${walletCount === 1 ? "" : "s"} lista${walletCount === 1 ? "" : "s"} para vincular.` : `${walletCount} trading account${walletCount === 1 ? "" : "s"} ready to attach.`
                : t("Trading accounts will attach as Privy creates them.", "Las cuentas se vincularán cuando Privy las cree.")}
            </p>
          </div>

          {displayedError && (
            <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {displayedError}
            </p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={!canSubmit || syncing}>
              {submitting || syncing ? t("Creating...", "Creando...") : t("Continue", "Continuar")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
