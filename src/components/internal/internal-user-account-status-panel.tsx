"use client";

import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatAccountStatus } from "@/lib/auth/tags";
import type { AccountStatus } from "@/lib/auth/types";
import { updateInternalUserAccountStatusRecord } from "@/lib/internal/user-management.functions";
import type { InternalUserDetail } from "@/lib/internal/user-management.types";

const fieldClass =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold/40";

export function InternalUserAccountStatusPanel({ user }: { user: InternalUserDetail }) {
  const router = useRouter();
  const updateStatus = useServerFn(updateInternalUserAccountStatusRecord);
  const [selected, setSelected] = useState<AccountStatus>(user.accountStatus);
  const [confirmStatus, setConfirmStatus] = useState<AccountStatus | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const { canChangeAccountStatus, allowedAccountStatuses } = user.capabilities;

  async function applyStatus(status: AccountStatus) {
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      await updateStatus({ data: { userId: user.id, accountStatus: status } });
      setSelected(status);
      setConfirmStatus(null);
      setMessage(`Account status updated to ${formatAccountStatus(status)}.`);
      await router.invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message.replace(/^BAD_REQUEST:/, "") : "Update failed.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canChangeAccountStatus || selected === user.accountStatus) return;

    if (selected === "frozen" || selected === "restricted") {
      setConfirmStatus(selected);
      return;
    }

    void applyStatus(selected);
  }

  if (!canChangeAccountStatus) {
    return (
      <p className="text-[13px] text-muted-foreground">
        Your role cannot change account status. Contact an admin for frozen or active reinstatement.
      </p>
    );
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="max-w-md space-y-4">
        <label className="block text-sm">
          Account status
          <select
            className={fieldClass}
            value={selected}
            onChange={(e) => setSelected(e.target.value as AccountStatus)}
          >
            {allowedAccountStatuses.map((status) => (
              <option key={status} value={status}>
                {formatAccountStatus(status)}
              </option>
            ))}
          </select>
        </label>
        <p className="text-[12px] text-muted-foreground">
          Restricted and frozen accounts are blocked by existing auth guards on privileged actions.
        </p>
        <button
          type="submit"
          disabled={submitting || selected === user.accountStatus}
          className="rounded-md border border-border-strong bg-surface-2 px-4 py-2 text-sm font-medium transition-colors hover:bg-surface-2/80 disabled:opacity-50"
        >
          {submitting ? "Updating…" : "Update status"}
        </button>
        {message && <p className="text-[13px] text-[var(--success)]">{message}</p>}
        {error && <p className="text-[13px] text-destructive">{error}</p>}
        <p className="text-[11px] text-muted-foreground">
          {/* TODO: Future AuditLog required for account status changes. */}
          Status changes are applied immediately. Audit logging is planned for a future release.
        </p>
      </form>

      <Dialog open={confirmStatus !== null} onOpenChange={(open) => !open && setConfirmStatus(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Confirm {confirmStatus ? formatAccountStatus(confirmStatus) : ""} account
            </DialogTitle>
            <DialogDescription>
              {confirmStatus === "frozen"
                ? "Frozen accounts cannot access privileged Alta surfaces until reinstated."
                : "Restricted accounts are limited by existing auth enforcement."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <button
              type="button"
              onClick={() => setConfirmStatus(null)}
              className="rounded-md border border-border px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting || !confirmStatus}
              onClick={() => confirmStatus && void applyStatus(confirmStatus)}
              className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive disabled:opacity-50"
            >
              {submitting ? "Applying…" : "Confirm"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
