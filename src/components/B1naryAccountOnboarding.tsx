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

function sanitizeUsername(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 32);
}

export function B1naryAccountOnboarding() {
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
      setLocalError("Use at least 3 letters or numbers.");
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
        err instanceof Error ? err.message : "Could not create b1nary account",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (account || (!needsOnboarding && !open)) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>Create your b1nary account</DialogTitle>
            <DialogDescription>
              Choose a username. Your Base and Solana trading accounts will be grouped under it.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label
              htmlFor="b1nary-username"
              className="text-sm font-medium text-[var(--text)]"
            >
              Username
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
                ? `${walletCount} trading account${walletCount === 1 ? "" : "s"} ready to attach.`
                : "Trading accounts will attach as Privy creates them."}
            </p>
          </div>

          {(localError || error) && (
            <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {localError || error}
            </p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={!canSubmit || syncing}>
              {submitting || syncing ? "Creating..." : "Continue"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
