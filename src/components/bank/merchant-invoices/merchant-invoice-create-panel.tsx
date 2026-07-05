"use client";

import { useState } from "react";
import { MerchantInvoiceForm } from "@/components/bank/merchant-invoices/merchant-invoice-form";
import { MerchantRecurringInvoiceForm } from "@/components/bank/merchant-invoices/merchant-recurring-invoice-form";
import type { RecurringInvoiceScheduleRow } from "@/lib/bank/payments-engine-types";

type CreateMode = "one_time" | "recurring";

const modes: { id: CreateMode; label: string }[] = [
  { id: "one_time", label: "One-time invoice" },
  { id: "recurring", label: "Recurring invoice" },
];

export function MerchantInvoiceCreatePanel({
  companyId,
  accountId,
  canUseRecurringInvoices,
  recurringSchedules,
}: {
  companyId: string;
  accountId: string;
  canUseRecurringInvoices: boolean;
  recurringSchedules: RecurringInvoiceScheduleRow[];
}) {
  const [mode, setMode] = useState<CreateMode>("one_time");
  const visibleModes = canUseRecurringInvoices
    ? modes
    : modes.filter((item) => item.id === "one_time");

  return (
    <div className="space-y-6">
      {canUseRecurringInvoices ? (
        <div className="flex flex-wrap gap-2 border-b border-border pb-1">
          {visibleModes.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setMode(item.id)}
              className={`rounded-md px-3 py-2 text-[13px] font-medium transition-colors ${
                mode === item.id
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}

      {mode === "one_time" || !canUseRecurringInvoices ? (
        <MerchantInvoiceForm companyId={companyId} accountId={accountId} />
      ) : (
        <MerchantRecurringInvoiceForm
          companyId={companyId}
          accountId={accountId}
          schedules={recurringSchedules}
        />
      )}
    </div>
  );
}
