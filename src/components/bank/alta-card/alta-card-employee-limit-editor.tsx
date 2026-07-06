"use client";

import { useEffect, useState } from "react";
import { SUBMITTING_COPY } from "@/lib/ui/route-loading";
import type { AltaEmployeeCardRow } from "@/lib/bank/alta-card-types";
import {
  altaCardStatusLabel,
  formatAltaCardCurrency,
} from "@/lib/bank/alta-card-types";
import {
  closeEmployeeCardRecord,
  freezeEmployeeCardRecord,
  updateEmployeeCardLimitRecord,
} from "@/lib/bank/alta-card.functions";
import { unfreezeEmployeeCardRecord } from "@/lib/bank/alta-card-admin.functions";
import { BankReviewButton } from "@/components/bank/bank-review-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const fieldLabel = "font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground";
const inputClass =
  "mt-2 w-full rounded-md border border-border bg-surface-1 px-3 py-2 font-mono text-sm tabular-nums shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold/40 disabled:cursor-not-allowed disabled:opacity-60";

export function AltaCardEmployeeCardManageButton({
  employeeCard,
  onUpdated,
}: {
  employeeCard: AltaEmployeeCardRow;
  onUpdated: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [limit, setLimit] = useState(String(employeeCard.employeeSpendLimit));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setLimit(String(employeeCard.employeeSpendLimit));
      setError(null);
    }
  }, [open, employeeCard.employeeSpendLimit]);

  if (employeeCard.status === "closed") return null;

  async function handleUpdateLimit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = Number(limit);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("Enter a valid spend limit.");
      return;
    }

    setSubmitting(true);
    try {
      await updateEmployeeCardLimitRecord({
        data: { employeeCardId: employeeCard.id, employeeSpendLimit: parsed },
      });
      await onUpdated();
      setOpen(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message.replace(/^BAD_REQUEST:/, "") : "Could not update limit",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-7 rounded border border-border bg-surface-1 px-2.5 text-[11px] font-medium transition-colors hover:bg-surface-2/60"
      >
        Manage
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md border-border bg-background">
          <DialogHeader>
            <DialogTitle className="font-serif text-[20px]">Manage employee card</DialogTitle>
            <DialogDescription>
              {employeeCard.authorizedUsername} · •••• {employeeCard.cardLastFour} ·{" "}
              {altaCardStatusLabel(employeeCard.status)}
            </DialogDescription>
          </DialogHeader>

          <dl className="grid grid-cols-3 gap-3 text-[13px]">
            <div>
              <dt className="text-muted-foreground">Spend limit</dt>
              <dd className="mt-0.5 font-mono tabular-nums">
                {formatAltaCardCurrency(employeeCard.employeeSpendLimit)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Spent</dt>
              <dd className="mt-0.5 font-mono tabular-nums">
                {formatAltaCardCurrency(employeeCard.employeeCurrentBalance)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Available</dt>
              <dd className="mt-0.5 font-mono tabular-nums">
                {formatAltaCardCurrency(employeeCard.employeeAvailableLimit)}
              </dd>
            </div>
          </dl>

          <form onSubmit={(e) => void handleUpdateLimit(e)} className="space-y-4">
            <label className="block">
              <span className={fieldLabel}>New spend limit</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                disabled={submitting}
                className={inputClass}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Increases reserve unspent limit from company available credit.
              </p>
            </label>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={submitting}
                className="rounded-md border border-border px-4 py-2 text-[13px] font-medium transition-colors hover:bg-surface-2/60 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-md bg-foreground px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-background disabled:opacity-50"
              >
                {submitting ? SUBMITTING_COPY.saving : "Update limit"}
              </button>
            </div>
          </form>

          <div className="border-t border-border/60 pt-4">
            <p className={fieldLabel}>Card status</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {employeeCard.status === "active" ? (
                <BankReviewButton
                  label="Freeze"
                  onAction={async () => {
                    await freezeEmployeeCardRecord({ data: employeeCard.id });
                    await onUpdated();
                    setOpen(false);
                  }}
                />
              ) : null}
              {employeeCard.status === "frozen" ? (
                <BankReviewButton
                  label="Unfreeze"
                  variant="primary"
                  onAction={async () => {
                    await unfreezeEmployeeCardRecord({
                      data: { employeeCardId: employeeCard.id, reason: "Business owner unfreeze" },
                    });
                    await onUpdated();
                    setOpen(false);
                  }}
                />
              ) : null}
              <BankReviewButton
                label="Close card"
                variant="danger"
                onAction={async () => {
                  await closeEmployeeCardRecord({ data: employeeCard.id });
                  await onUpdated();
                  setOpen(false);
                }}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
