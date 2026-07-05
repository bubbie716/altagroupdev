"use client";

import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check } from "lucide-react";
import { Card } from "@/components/page-shell";
import { florin } from "@/lib/bank/api";
import { formatCustomerActionError } from "@/lib/bank/bank-action-errors";
import type { MerchantInvoiceRecipientOption } from "@/lib/bank/merchant-invoice-types";
import type { PaymentFrequencyCode } from "@/lib/bank/business-banking-types";
import type { RecurringInvoiceScheduleRow } from "@/lib/bank/payments-engine-types";
import { createRecurringInvoiceScheduleFn } from "@/lib/bank/payments-engine.functions";
import { MerchantInvoiceRecipientField } from "@/components/bank/merchant-invoices/merchant-invoice-recipient-field";
import { MerchantRecurringInvoiceScheduleList } from "@/components/bank/merchant-invoices/merchant-recurring-invoice-schedule-list";
import { accountCommercialRoutes } from "@/lib/bank/account-commercial-path";
import { BankRequestErrorCard } from "@/components/bank/bank-request-submission-ui";

type FormView = "compose" | "success" | "error";

const fieldLabel = "type-meta";
const inputClass =
  "mt-1.5 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold/40 disabled:cursor-not-allowed disabled:opacity-60";

const resultCardClass =
  "mx-auto w-full max-w-sm rounded-2xl border border-border/70 bg-surface-1 px-7 py-9 text-center shadow-[0_10px_40px_-16px_hsl(var(--foreground)/0.14)]";

const frequencyOptions: { value: PaymentFrequencyCode; label: string }[] = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Biweekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
];

function frequencyLabel(frequency: PaymentFrequencyCode): string {
  return frequencyOptions.find((option) => option.value === frequency)?.label ?? frequency;
}

export function MerchantRecurringInvoiceForm({
  companyId,
  accountId,
  schedules,
}: {
  companyId: string;
  accountId: string;
  schedules: RecurringInvoiceScheduleRow[];
}) {
  const router = useRouter();
  const createSchedule = useServerFn(createRecurringInvoiceScheduleFn);

  const [view, setView] = useState<FormView>("compose");
  const [templateName, setTemplateName] = useState("");
  const [selectedRecipient, setSelectedRecipient] = useState<MerchantInvoiceRecipientOption | null>(
    null,
  );
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [frequency, setFrequency] = useState<PaymentFrequencyCode>("monthly");
  const [startDate, setStartDate] = useState("");
  const [composeError, setComposeError] = useState<string | null>(null);
  const [errorReason, setErrorReason] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [createdTemplateName, setCreatedTemplateName] = useState("");
  const [createdAmount, setCreatedAmount] = useState(0);
  const [createdFrequency, setCreatedFrequency] = useState<PaymentFrequencyCode>("monthly");

  const parsedAmount = Number(amount);
  const canSubmit =
    !!selectedRecipient?.canReceive &&
    templateName.trim().length > 0 &&
    Number.isFinite(parsedAmount) &&
    parsedAmount > 0 &&
    description.trim().length > 0 &&
    startDate.length > 0;

  function resetForm() {
    setView("compose");
    setTemplateName("");
    setSelectedRecipient(null);
    setAmount("");
    setDescription("");
    setFrequency("monthly");
    setStartDate("");
    setComposeError(null);
    setErrorReason(null);
    setCreatedTemplateName("");
    setCreatedAmount(0);
    setCreatedFrequency("monthly");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRecipient?.canReceive || submitting) return;
    if (!canSubmit) {
      setComposeError("Complete all required fields and select a recipient.");
      return;
    }

    setSubmitting(true);
    setComposeError(null);
    try {
      await createSchedule({
        data: {
          companyId,
          templateName: templateName.trim(),
          ...(selectedRecipient.kind === "company"
            ? { recipientCompanyId: selectedRecipient.id }
            : { recipientUserId: selectedRecipient.id }),
          amount: parsedAmount,
          description: description.trim(),
          frequency,
          startDate,
          autoSendEnabled: true,
        },
      });
      setCreatedTemplateName(templateName.trim());
      setCreatedAmount(parsedAmount);
      setCreatedFrequency(frequency);
      setView("success");
      await router.invalidate();
    } catch (err) {
      setErrorReason(formatCustomerActionError(err));
      setView("error");
    } finally {
      setSubmitting(false);
    }
  }

  if (view === "success") {
    return (
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-4">
          <div className={resultCardClass}>
            <div className="mx-auto flex size-[4.5rem] items-center justify-center rounded-full bg-[var(--success)]/14">
              <Check className="size-9 text-[var(--success)]" strokeWidth={2.25} aria-hidden />
            </div>
            <h2 className="mt-5 text-lg font-semibold tracking-tight">Recurring schedule created</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
              Invoices will auto-generate {frequencyLabel(createdFrequency).toLowerCase()} starting on
              your chosen date.
            </p>
            <dl className="mt-6 space-y-2 border-t border-border/60 pt-5 text-left text-[13px]">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Template</dt>
                <dd className="font-medium">{createdTemplateName}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Frequency</dt>
                <dd className="font-medium">{frequencyLabel(createdFrequency)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Amount</dt>
                <dd className="type-finance-nums">{florin(createdAmount)}</dd>
              </div>
            </dl>
          </div>
          <div className="mx-auto flex max-w-sm flex-col gap-2">
            <button
              type="button"
              className="w-full rounded-xl border border-border/80 bg-background px-4 py-3 text-[14px] font-medium tracking-tight text-foreground transition-colors hover:bg-surface-2/60"
              onClick={() =>
                void router.navigate({
                  to: accountCommercialRoutes.invoices,
                  params: { accountId },
                })
              }
            >
              View invoices
            </button>
            <button
              type="button"
              className="w-full rounded-xl border border-border/80 bg-background px-4 py-3 text-[14px] font-medium tracking-tight text-foreground transition-colors hover:bg-surface-2/60"
              onClick={resetForm}
            >
              Create another schedule
            </button>
          </div>
        </div>
        <MerchantRecurringInvoiceScheduleList companyId={companyId} schedules={schedules} />
      </div>
    );
  }

  if (view === "error") {
    return (
      <div className="grid gap-8 lg:grid-cols-2">
        <BankRequestErrorCard
          reason={errorReason}
          onTryAgain={() => {
            setErrorReason(null);
            setView("compose");
          }}
        />
        <MerchantRecurringInvoiceScheduleList companyId={companyId} schedules={schedules} />
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form onSubmit={handleSubmit}>
        <Card className="space-y-4 !p-5">
          <fieldset disabled={submitting} className="space-y-4 border-0 p-0 m-0 min-w-0">
            <label className="block">
              <span className={fieldLabel}>Template name</span>
              <input
                className={inputClass}
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g. Monthly retainer"
                required
              />
            </label>

            <MerchantInvoiceRecipientField
              companyId={companyId}
              selectedRecipient={selectedRecipient}
              onSelectedRecipientChange={(recipient) => {
                setSelectedRecipient(recipient);
                setComposeError(null);
              }}
              disabled={submitting}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className={fieldLabel}>Amount (FLR)</span>
                <input
                  className={`${inputClass} tabular`}
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </label>

              <label className="block">
                <span className={fieldLabel}>Frequency</span>
                <select
                  className={inputClass}
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as PaymentFrequencyCode)}
                  required
                >
                  {frequencyOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block">
              <span className={fieldLabel}>Description</span>
              <input
                className={inputClass}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this invoice for?"
                required
              />
            </label>

            <label className="block sm:max-w-[calc(50%-0.5rem)]">
              <span className={fieldLabel}>Start date</span>
              <input
                className={inputClass}
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Invoices send at 9:00 AM Eastern on each scheduled date.
              </p>
            </label>
          </fieldset>

          <div className="space-y-3 border-t border-border/60 pt-4">
            {composeError ? <p className="text-sm text-destructive">{composeError}</p> : null}

            <button
              type="submit"
              disabled={submitting || !canSubmit}
              className="rounded-md bg-foreground px-4 py-2.5 text-[13px] font-medium text-background disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Creating…" : "Create schedule"}
            </button>
          </div>
        </Card>
      </form>
      <MerchantRecurringInvoiceScheduleList companyId={companyId} schedules={schedules} />
    </div>
  );
}
