"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, Search, ShieldCheck, UserRound } from "lucide-react";
import { Card } from "@/components/page-shell";
import { Textarea } from "@/components/ui/textarea";
import {
  createMerchantInvoiceDraftRecord,
  searchInvoiceRecipientsForMerchant,
  sendMerchantInvoiceRecord,
  updateMerchantInvoiceDraftRecord,
} from "@/lib/bank/merchant-invoice.functions";
import type {
  MerchantInvoiceDetail,
  MerchantInvoiceRecipientOption,
} from "@/lib/bank/merchant-invoice-types";
import { florin } from "@/lib/bank/api";
import {
  BANK_MERCHANT_INVOICE_DRAFT_SAVED_BODY,
  MERCHANT_INVOICE_FORM_INTRO,
} from "@/lib/bank/bank-shared-copy";
import { formatCustomerActionError } from "@/lib/bank/bank-action-errors";
import {
  BankRequestErrorCard,
  BankRequestSubmitButton,
  BankRequestSuccessCard,
  type BankRequestSubmissionResult,
} from "@/components/bank/bank-request-submission-ui";
import { cn } from "@/lib/utils";

type FormView = "compose" | "review" | "success" | "draft_saved" | "error";

const fieldLabel = "type-meta";
const inputClass =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold/40 disabled:cursor-not-allowed disabled:opacity-60";

const resultCardClass =
  "mx-auto w-full max-w-sm rounded-2xl border border-border/70 bg-surface-1 px-7 py-9 text-center shadow-[0_10px_40px_-16px_hsl(var(--foreground)/0.14)]";

function recipientIcon(recipient: MerchantInvoiceRecipientOption) {
  return recipient.kind === "company" ? ShieldCheck : UserRound;
}

function recipientSubtitle(recipient: MerchantInvoiceRecipientOption): string {
  if (recipient.kind === "company") {
    return recipient.subtitle || "Verified company";
  }
  return recipient.subtitle ? `@${recipient.subtitle}` : "";
}

function RecipientRowContent({ recipient }: { recipient: MerchantInvoiceRecipientOption }) {
  const Icon = recipientIcon(recipient);
  return (
    <>
      <Icon className="mt-0.5 size-4 shrink-0 text-gold" />
      <span className="min-w-0 flex-1">
        <span className="font-medium">{recipient.displayName}</span>
        {recipientSubtitle(recipient) ? (
          <span className="mt-0.5 block text-[12px] text-muted-foreground">
            {recipientSubtitle(recipient)}
          </span>
        ) : null}
        <span className="mt-0.5 block text-[11px] text-muted-foreground">
          {recipient.destinationLabel}
        </span>
      </span>
    </>
  );
}

function recipientFromInvoice(invoice: MerchantInvoiceDetail): MerchantInvoiceRecipientOption {
  const id =
    invoice.recipientKind === "company"
      ? (invoice.recipientCompanyId ?? "")
      : (invoice.recipientUserId ?? "");
  return {
    kind: invoice.recipientKind,
    id,
    displayName: invoice.recipientName,
    subtitle: null,
    canReceive: true,
    destinationLabel: "Alta Bank account",
  };
}

function formatDueDateLabel(value: string): string {
  if (!value) return "No due date";
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function dueDateInputValue(dueDate: string | null): string {
  if (!dueDate) return "";
  return dueDate.slice(0, 10);
}

export function MerchantInvoiceForm({
  companyId,
  initialInvoice,
}: {
  companyId: string;
  initialInvoice?: MerchantInvoiceDetail;
}) {
  const router = useRouter();
  const searchRecipients = useServerFn(searchInvoiceRecipientsForMerchant);
  const createDraft = useServerFn(createMerchantInvoiceDraftRecord);
  const updateDraft = useServerFn(updateMerchantInvoiceDraftRecord);
  const sendInvoice = useServerFn(sendMerchantInvoiceRecord);

  const [view, setView] = useState<FormView>("compose");
  const [query, setQuery] = useState(initialInvoice?.recipientName ?? "");
  const [recipients, setRecipients] = useState<MerchantInvoiceRecipientOption[]>([]);
  const [selectedRecipient, setSelectedRecipient] = useState<MerchantInvoiceRecipientOption | null>(
    () => (initialInvoice ? recipientFromInvoice(initialInvoice) : null),
  );
  const [amount, setAmount] = useState(initialInvoice ? String(initialInvoice.amount) : "");
  const [description, setDescription] = useState(initialInvoice?.description ?? "");
  const [memo, setMemo] = useState(initialInvoice?.memo ?? "");
  const [dueDate, setDueDate] = useState(dueDateInputValue(initialInvoice?.dueDate ?? null));
  const [composeError, setComposeError] = useState<string | null>(null);
  const [errorReason, setErrorReason] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [submission, setSubmission] = useState<BankRequestSubmissionResult | null>(null);
  const [savedInvoiceId, setSavedInvoiceId] = useState<string | null>(initialInvoice?.id ?? null);
  const [savedReferenceCode, setSavedReferenceCode] = useState<string | null>(
    initialInvoice?.referenceCode ?? null,
  );

  const parsedAmount = Number(amount);
  const canReview =
    !!selectedRecipient?.canReceive &&
    Number.isFinite(parsedAmount) &&
    parsedAmount > 0 &&
    description.trim().length > 0;

  useEffect(() => {
    if (query.trim().length < 1) {
      setRecipients([]);
      return;
    }
    if (selectedRecipient && query.trim() === selectedRecipient.displayName) {
      return;
    }
    const timer = setTimeout(() => {
      void searchRecipients({ data: { query: query.trim(), companyId } })
        .then(setRecipients)
        .catch(() => setRecipients([]));
    }, 280);
    return () => clearTimeout(timer);
  }, [query, searchRecipients, companyId, selectedRecipient]);

  function resetForm() {
    setView("compose");
    setComposeError(null);
    setErrorReason(null);
    setSubmission(null);
    setSavedInvoiceId(null);
    setSavedReferenceCode(null);
    setAmount("");
    setDescription("");
    setMemo("");
    setDueDate("");
    setSelectedRecipient(null);
    setQuery("");
    setRecipients([]);
  }

  function showSubmitError(message: string) {
    setErrorReason(message);
    setView("error");
  }

  function validateComposeFields(): string | null {
    if (!selectedRecipient) return "Select a customer or company to invoice.";
    if (!selectedRecipient.canReceive) return "This recipient cannot receive invoices right now.";
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) return "Enter a valid invoice amount.";
    if (!description.trim()) return "Description is required.";
    return null;
  }

  function goToReview() {
    setComposeError(null);
    const validationError = validateComposeFields();
    if (validationError) {
      setComposeError(validationError);
      return;
    }
    setView("review");
  }

  function draftPayload() {
    if (!selectedRecipient) throw new Error("Recipient is required.");
    return {
      companyId,
      ...(selectedRecipient.kind === "company"
        ? { recipientCompanyId: selectedRecipient.id }
        : { recipientUserId: selectedRecipient.id }),
      amount: parsedAmount,
      description: description.trim(),
      memo: memo.trim() || undefined,
      dueDate: dueDate || null,
    };
  }

  async function persistDraft() {
    const payload = draftPayload();
    if (savedInvoiceId) {
      return updateDraft({
        data: {
          invoiceId: savedInvoiceId,
          ...payload,
          memo: memo.trim() || null,
        },
      });
    }
    return createDraft({ data: payload });
  }

  async function handleSaveDraft() {
    if (savingDraft || submitting) return;
    const validationError = validateComposeFields();
    if (validationError) {
      setComposeError(validationError);
      return;
    }

    setSavingDraft(true);
    setComposeError(null);
    try {
      const draft = await persistDraft();
      setSavedInvoiceId(draft.id);
      setSavedReferenceCode(draft.referenceCode);
      setView("draft_saved");
      await router.invalidate();
    } catch (err) {
      showSubmitError(formatCustomerActionError(err));
    } finally {
      setSavingDraft(false);
    }
  }

  async function submitInvoice(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRecipient || submitting || savingDraft) return;

    setSubmitting(true);
    try {
      const draft = await persistDraft();
      await sendInvoice({ data: { companyId, invoiceId: draft.id } });

      setSavedInvoiceId(draft.id);
      setSubmission({
        referenceCode: draft.referenceCode,
        amount: parsedAmount,
        submittedAt: new Date().toISOString(),
        accountName: selectedRecipient.displayName,
        accountNumber: selectedRecipient.destinationLabel,
      });
      setView("success");
      await router.invalidate();
    } catch (err) {
      showSubmitError(formatCustomerActionError(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (view === "success" && submission) {
    return (
      <div className="space-y-4">
        <BankRequestSuccessCard
          kind="merchant_invoice"
          result={submission}
          onSubmitAnother={initialInvoice ? undefined : resetForm}
        />
        {savedInvoiceId ? (
          <p className="text-center text-[13px] text-muted-foreground">
            <button
              type="button"
              className="font-medium text-foreground underline-offset-2 hover:underline"
              onClick={() =>
                void router.navigate({
                  to: "/bank/commercial/invoices/$invoiceId",
                  params: { invoiceId: savedInvoiceId },
                  search: { companyId },
                })
              }
            >
              View invoice details
            </button>
          </p>
        ) : null}
      </div>
    );
  }

  if (view === "draft_saved" && savedInvoiceId && savedReferenceCode) {
    return (
      <div className="space-y-4">
        <div className={resultCardClass}>
          <div className="mx-auto flex size-[4.5rem] items-center justify-center rounded-full bg-[var(--success)]/14">
            <Check className="size-9 text-[var(--success)]" strokeWidth={2.25} aria-hidden />
          </div>
          <h2 className="mt-5 text-lg font-semibold tracking-tight">Draft saved</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
            {BANK_MERCHANT_INVOICE_DRAFT_SAVED_BODY}
          </p>
          <dl className="mt-6 space-y-2 border-t border-border/60 pt-5 text-left text-[13px]">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Reference</dt>
              <dd className="font-medium">{savedReferenceCode}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Amount</dt>
              <dd className="type-finance-nums">{florin(parsedAmount)}</dd>
            </div>
          </dl>
        </div>
        <div className="mx-auto flex max-w-sm flex-col gap-2">
          <button
            type="button"
            className="w-full rounded-xl border border-border/80 bg-background px-4 py-3 text-[14px] font-medium tracking-tight text-foreground transition-colors hover:bg-surface-2/60"
            onClick={() =>
              void router.navigate({
                to: "/bank/commercial/invoices/$invoiceId",
                params: { invoiceId: savedInvoiceId },
                search: { companyId },
              })
            }
          >
            View draft
          </button>
          {!initialInvoice ? (
            <button
              type="button"
              className="w-full rounded-xl border border-border/80 bg-background px-4 py-3 text-[14px] font-medium tracking-tight text-foreground transition-colors hover:bg-surface-2/60"
              onClick={resetForm}
            >
              Create another invoice
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  if (view === "error") {
    return (
      <BankRequestErrorCard
        reason={errorReason}
        onTryAgain={() => {
          setErrorReason(null);
          setView("review");
        }}
      />
    );
  }

  if (view === "review" && selectedRecipient) {
    const busy = submitting || savingDraft;
    return (
      <form onSubmit={submitInvoice} className="mx-auto max-w-2xl space-y-6">
        <Card className="space-y-6 !p-6">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">
              Review invoice
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
              Confirm the details below before sending. The recipient will be notified and can pay
              from Alta Bank. You can save as a draft instead if you are not ready to send yet.
            </p>
          </div>

          <div className="space-y-4 border-y border-border/60 py-6 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">To</span>
              <span className="text-right">
                <span className="font-medium">{selectedRecipient.displayName}</span>
                <span className="mt-0.5 block text-[12px] text-muted-foreground">
                  {selectedRecipient.destinationLabel}
                </span>
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Amount</span>
              <span className="type-finance-nums">{florin(parsedAmount)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Description</span>
              <span className="max-w-[220px] text-right text-[13px]">{description.trim()}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Due date</span>
              <span className="text-right">{formatDueDateLabel(dueDate)}</span>
            </div>
            {memo.trim() ? (
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Internal memo</span>
                <span className="max-w-[220px] text-right text-[13px]">{memo.trim()}</span>
              </div>
            ) : null}
          </div>

          <fieldset disabled={busy} className="flex flex-wrap items-center gap-2 border-0 p-0 m-0 min-w-0">
            <button
              type="button"
              disabled={busy}
              onClick={() => setView("compose")}
              className="rounded-md border border-border px-4 py-2.5 text-[13px] font-medium transition-colors hover:bg-surface-2/60 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Back
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleSaveDraft()}
              className="rounded-md border border-border px-4 py-2.5 text-[13px] font-medium transition-colors hover:bg-surface-2/60 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {savingDraft ? "Saving draft…" : "Save as draft"}
            </button>
            <BankRequestSubmitButton
              kind="merchant_invoice"
              submitting={submitting}
              showContainer={false}
            />
          </fieldset>
        </Card>
      </form>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        goToReview();
      }}
      className="mx-auto max-w-2xl space-y-6"
    >
      <Card className="space-y-6 !p-6">
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          {MERCHANT_INVOICE_FORM_INTRO}
        </p>

        <fieldset disabled={submitting || savingDraft} className="space-y-6 border-0 p-0 m-0 min-w-0">
          <div>
            <span className={fieldLabel}>Recipient</span>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                className={`${inputClass} pl-9`}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedRecipient(null);
                  setComposeError(null);
                }}
                placeholder="Customer or company name"
              />
            </div>
            {recipients.length > 0 ? (
              <ul className="mt-2 overflow-hidden rounded-md border border-border">
                {recipients.map((recipient) => {
                  const isSelected =
                    selectedRecipient?.kind === recipient.kind &&
                    selectedRecipient.id === recipient.id;

                  if (isSelected) {
                    return (
                      <li
                        key={`${recipient.kind}:${recipient.id}`}
                        className="flex w-full items-start gap-3 border-l-2 border-gold bg-gold/5 px-4 py-3 text-left text-sm"
                      >
                        <RecipientRowContent recipient={recipient} />
                      </li>
                    );
                  }

                  return (
                    <li key={`${recipient.kind}:${recipient.id}`}>
                      <button
                        type="button"
                        disabled={!recipient.canReceive}
                        onClick={() => {
                          if (!recipient.canReceive) return;
                          setSelectedRecipient(recipient);
                          setQuery(recipient.displayName);
                          setComposeError(null);
                        }}
                        className="flex w-full items-start gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-surface-2/60 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <RecipientRowContent recipient={recipient} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : selectedRecipient ? (
              <ul className="mt-2 overflow-hidden rounded-md border border-border">
                <li className="flex w-full items-start gap-3 border-l-2 border-gold bg-gold/5 px-4 py-3 text-left text-sm">
                  <RecipientRowContent recipient={selectedRecipient} />
                </li>
              </ul>
            ) : null}
          </div>

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
            <span className={fieldLabel}>Description</span>
            <input
              className={inputClass}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this invoice for?"
              required
            />
          </label>

          <label className="block">
            <span className={fieldLabel}>Due date (optional)</span>
            <input className={inputClass} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </label>

          <label className="block">
            <span className={fieldLabel}>Internal memo (optional)</span>
            <Textarea
              autoResize
              className={cn(inputClass, "min-h-[80px]")}
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="Notes visible only to your team"
            />
          </label>
        </fieldset>

        {composeError ? <p className="text-sm text-destructive">{composeError}</p> : null}

        <BankRequestSubmitButton
          kind="merchant_invoice"
          submitting={false}
          label="Review invoice"
          disabled={!canReview}
        />
      </Card>
    </form>
  );
}
