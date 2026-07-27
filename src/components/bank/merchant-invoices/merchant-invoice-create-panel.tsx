"use client";

import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { MerchantInvoiceWorkflow } from "@/components/bank/merchant-invoices/merchant-invoice-workflow";
import { MerchantRecurringInvoiceForm } from "@/components/bank/merchant-invoices/merchant-recurring-invoice-form";
import type { RecurringInvoiceScheduleRow } from "@/lib/bank/payments-engine-types";
import { accountCommercialRoutes } from "@/lib/bank/account-commercial-path";

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
  const router = useRouter();
  const [mode, setMode] = useState<CreateMode>("one_time");
  const [oneTimeOpen, setOneTimeOpen] = useState(true);
  const visibleModes = canUseRecurringInvoices
    ? modes
    : modes.filter((item) => item.id === "one_time");

  function leaveToList() {
    void router.navigate({
      to: accountCommercialRoutes.invoices,
      params: { accountId },
    });
  }

  return (
    <div className="space-y-6">
      {canUseRecurringInvoices ? (
        <div className="flex flex-wrap gap-2 border-b border-border pb-1">
          {visibleModes.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setMode(item.id);
                if (item.id === "one_time") setOneTimeOpen(true);
              }}
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
        <MerchantInvoiceWorkflow
          open={oneTimeOpen}
          onOpenChange={(open) => {
            setOneTimeOpen(open);
            if (!open) leaveToList();
          }}
          onDone={leaveToList}
          companyId={companyId}
          accountId={accountId}
        />
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
