"use client";

import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/page-shell";
import { florin } from "@/lib/bank/api";
import { formatCustomerActionError } from "@/lib/bank/bank-action-errors";
import { formatActivityDateTime } from "@/lib/format-datetime";
import type { RecurringInvoiceScheduleRow } from "@/lib/bank/payments-engine-types";
import { deactivateRecurringInvoiceScheduleFn } from "@/lib/bank/payments-engine.functions";

const actionButtonClass =
  "text-[12px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";

export function MerchantRecurringInvoiceScheduleList({
  companyId,
  schedules,
}: {
  companyId: string;
  schedules: RecurringInvoiceScheduleRow[];
}) {
  const router = useRouter();
  const deactivateSchedule = useServerFn(deactivateRecurringInvoiceScheduleFn);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDeactivate(row: RecurringInvoiceScheduleRow) {
    const confirmed = window.confirm(
      `Deactivate "${row.templateName}"? No more invoices will be sent on this schedule.`,
    );
    if (!confirmed) return;

    setBusyId(row.id);
    setError(null);
    try {
      await deactivateSchedule({ data: { companyId, scheduleId: row.id } });
      await router.invalidate();
    } catch (err) {
      setError(formatCustomerActionError(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card className="!p-5">
      <h3 className="text-sm font-medium">Current recurring invoices</h3>
      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      {schedules.length === 0 ? (
        <p className="mt-4 text-[13px] text-muted-foreground">No recurring invoice schedules yet.</p>
      ) : (
        <div className="mt-4 divide-y divide-border">
          {schedules.map((row) => (
            <div key={row.id} className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium">{row.templateName}</p>
                <p className="text-[12px] text-muted-foreground">
                  {row.recipientLabel} · {florin(row.amount)} · {row.frequencyLabel} · {row.statusLabel}
                </p>
                {row.nextRunDate && row.status === "active" ? (
                  <p className="text-[12px] text-muted-foreground">
                    Next: {formatActivityDateTime(row.nextRunDate)}
                  </p>
                ) : null}
                {row.status === "paused" ? (
                  <p className="text-[12px] text-muted-foreground">Paused — no invoices will be sent.</p>
                ) : null}
                {row.lastFailureReason ? (
                  <p className="mt-1 text-[12px] text-destructive">{row.lastFailureReason}</p>
                ) : null}
              </div>
              {row.status === "active" || row.status === "paused" ? (
                <button
                  type="button"
                  disabled={busyId === row.id}
                  className={`${actionButtonClass} text-destructive hover:text-destructive/80`}
                  onClick={() => void handleDeactivate(row)}
                >
                  {busyId === row.id ? "Deactivating…" : "Deactivate"}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
