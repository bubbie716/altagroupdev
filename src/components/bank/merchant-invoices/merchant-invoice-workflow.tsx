"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ResponsiveBankAction } from "@/components/bank/actions/responsive-bank-action";
import {
  BankActionFooter,
  BankActionPrimaryButton,
  BankActionProcessing,
  BankActionProgress,
  BankActionSecondaryButton,
  BankActionSuccess,
} from "@/components/bank/actions/bank-action-chrome";
import {
  BankProcessError,
  BankProcessSummary,
} from "@/components/bank/actions/bank-process-ui";
import { MerchantInvoiceRecipientField } from "@/components/bank/merchant-invoices/merchant-invoice-recipient-field";
import { Textarea } from "@/components/ui/textarea";
import type { BankActionPhase } from "@/lib/bank/bank-action-flow";
import { florin } from "@/lib/bank/api";
import { formatCustomerActionError } from "@/lib/bank/bank-action-errors";
import { BANK_PROCESS_MOTION, waitBankProcessMin } from "@/lib/bank/bank-process";
import { accountCommercialRoutes } from "@/lib/bank/account-commercial-path";
import {
  createMerchantInvoiceDraftRecord,
  sendMerchantInvoiceRecord,
  updateMerchantInvoiceDraftRecord,
} from "@/lib/bank/merchant-invoice.functions";
import type {
  MerchantInvoiceDetail,
  MerchantInvoiceRecipientOption,
} from "@/lib/bank/merchant-invoice-types";
import {
  EMPTY_INVOICE_FORM,
  isInvoiceFormDirty,
  validateInvoiceDetails,
  validateInvoiceRecipient,
  type InvoiceFormValues,
  type InvoiceWizardStep,
} from "@/lib/bank/merchant-invoice-validation";
import { invalidateRouteData } from "@/lib/router/invalidate-route-data";
import { cn } from "@/lib/utils";

const fieldLabel = "type-meta";
const inputClass =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-base sm:text-sm shadow-none focus-visible:outline-none focus-visible:border-gold/60 focus-visible:ring-0 disabled:opacity-60 min-h-11";

const STEPS: { id: InvoiceWizardStep; label: string }[] = [
  { id: "recipient", label: "Recipient" },
  { id: "details", label: "Invoice details" },
  { id: "review", label: "Review" },
];

function formatWorkflowError(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message.trim()) {
    return err.message.replace(/^BAD_REQUEST:/, "").trim();
  }
  return formatCustomerActionError(err, "settings") || fallback;
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

function dueDateInputValue(dueDate: string | null): string {
  if (!dueDate) return "";
  return dueDate.slice(0, 10);
}

function formatDueDateLabel(value: string): string {
  if (!value) return "No due date";
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function valuesFromInvoice(invoice?: MerchantInvoiceDetail): InvoiceFormValues {
  if (!invoice) return { ...EMPTY_INVOICE_FORM };
  return {
    amount: String(invoice.amount),
    description: invoice.description ?? "",
    memo: invoice.memo ?? "",
    dueDate: dueDateInputValue(invoice.dueDate),
  };
}

export function MerchantInvoiceWorkflow({
  open,
  onOpenChange,
  onDone,
  companyId,
  accountId,
  initialInvoice,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
  companyId: string;
  accountId: string;
  initialInvoice?: MerchantInvoiceDetail;
}) {
  const router = useRouter();
  const createDraft = useServerFn(createMerchantInvoiceDraftRecord);
  const updateDraft = useServerFn(updateMerchantInvoiceDraftRecord);
  const sendInvoice = useServerFn(sendMerchantInvoiceRecord);

  const initialValues = useMemo(() => valuesFromInvoice(initialInvoice), [initialInvoice]);
  const initialRecipient = useMemo(
    () => (initialInvoice ? recipientFromInvoice(initialInvoice) : null),
    [initialInvoice],
  );

  const [step, setStep] = useState<InvoiceWizardStep>(
    initialRecipient ? "details" : "recipient",
  );
  const [phase, setPhase] = useState<BankActionPhase>(
    initialRecipient ? "details" : "selection",
  );
  const [selectedRecipient, setSelectedRecipient] =
    useState<MerchantInvoiceRecipientOption | null>(initialRecipient);
  const [values, setValues] = useState<InvoiceFormValues>(initialValues);
  const [stepError, setStepError] = useState<string | null>(null);
  const [errorReason, setErrorReason] = useState<string | null>(null);
  const [savedInvoiceId, setSavedInvoiceId] = useState<string | null>(initialInvoice?.id ?? null);
  const [savedReferenceCode, setSavedReferenceCode] = useState<string | null>(
    initialInvoice?.referenceCode ?? null,
  );
  const [successMode, setSuccessMode] = useState<"sent" | "draft" | null>(null);
  const [pendingAction, setPendingAction] = useState<"send" | "draft" | null>(null);
  const submittingLockRef = useRef(false);
  const contentKeyRef = useRef(0);

  const dirty = isInvoiceFormDirty({
    values,
    initial: initialValues,
    hasSelectedRecipient: Boolean(selectedRecipient),
    initialHadRecipient: Boolean(initialRecipient),
  });

  const resetWorkflow = useCallback(() => {
    setStep(initialRecipient ? "details" : "recipient");
    setPhase(initialRecipient ? "details" : "selection");
    setSelectedRecipient(initialRecipient);
    setValues(initialValues);
    setStepError(null);
    setErrorReason(null);
    setSavedInvoiceId(initialInvoice?.id ?? null);
    setSavedReferenceCode(initialInvoice?.referenceCode ?? null);
    setSuccessMode(null);
    setPendingAction(null);
    submittingLockRef.current = false;
    contentKeyRef.current += 1;
  }, [initialInvoice?.id, initialInvoice?.referenceCode, initialRecipient, initialValues]);

  useEffect(() => {
    if (open) return;
    const timer = setTimeout(resetWorkflow, 320);
    return () => clearTimeout(timer);
  }, [open, resetWorkflow]);

  const title = useMemo(() => {
    if (phase === "submitting") return initialInvoice ? "Updating invoice" : "Creating invoice";
    if (phase === "success") return successMode === "draft" ? "Draft saved" : "Invoice sent";
    if (phase === "error") return "Invoice unsuccessful";
    if (step === "recipient") return "New invoice";
    if (step === "details") return "Invoice details";
    return "Review invoice";
  }, [phase, step, successMode, initialInvoice]);

  const description = useMemo(() => {
    if (phase === "submitting" || phase === "success") return undefined;
    if (phase === "error") return "Your entries were preserved.";
    if (step === "recipient") return "Choose who to invoice.";
    if (step === "details") return "Amount, description, and optional due date.";
    return "Confirm details before sending or saving a draft.";
  }, [phase, step]);

  function goBack() {
    setStepError(null);
    if (phase === "error") {
      setPhase("review");
      setStep("review");
      return;
    }
    if (step === "review") {
      setStep("details");
      setPhase("details");
      return;
    }
    if (step === "details") {
      setStep("recipient");
      setPhase("selection");
    }
  }

  function goToDetails() {
    setStepError(null);
    const err = validateInvoiceRecipient(selectedRecipient);
    if (err) {
      setStepError(err);
      return;
    }
    setStep("details");
    setPhase("details");
  }

  function goToReview() {
    setStepError(null);
    const recipientErr = validateInvoiceRecipient(selectedRecipient);
    if (recipientErr) {
      setStepError(recipientErr);
      return;
    }
    const detailsErr = validateInvoiceDetails(values);
    if (detailsErr) {
      setStepError(detailsErr);
      return;
    }
    setStep("review");
    setPhase("review");
  }

  function draftPayload() {
    if (!selectedRecipient) throw new Error("Recipient is required.");
    const amount = Number(values.amount);
    return {
      companyId,
      ...(selectedRecipient.kind === "company"
        ? { recipientCompanyId: selectedRecipient.id }
        : { recipientUserId: selectedRecipient.id }),
      amount,
      description: values.description.trim(),
      memo: values.memo.trim() || undefined,
      dueDate: values.dueDate || null,
    };
  }

  async function persistDraft(): Promise<MerchantInvoiceDetail> {
    const payload = draftPayload();
    if (savedInvoiceId) {
      return updateDraft({
        data: {
          invoiceId: savedInvoiceId,
          ...payload,
          memo: values.memo.trim() || null,
        },
      }) as Promise<MerchantInvoiceDetail>;
    }
    return createDraft({ data: payload }) as Promise<MerchantInvoiceDetail>;
  }

  async function handleSaveDraft() {
    if (submittingLockRef.current || phase === "submitting") return;
    const recipientErr = validateInvoiceRecipient(selectedRecipient);
    if (recipientErr) {
      setStepError(recipientErr);
      return;
    }
    const detailsErr = validateInvoiceDetails(values);
    if (detailsErr) {
      setStepError(detailsErr);
      return;
    }
    submittingLockRef.current = true;
    setPendingAction("draft");
    setPhase("submitting");
    const startedAt = Date.now();
    try {
      const draft = await persistDraft();
      await waitBankProcessMin(startedAt, BANK_PROCESS_MOTION.minProcessingMs);
      setSavedInvoiceId(draft.id);
      setSavedReferenceCode(draft.referenceCode);
      setSuccessMode("draft");
      setPhase("success");
      await invalidateRouteData(router);
    } catch (err) {
      setErrorReason(formatWorkflowError(err, "Unable to save draft."));
      setPhase("error");
    } finally {
      setPendingAction(null);
      submittingLockRef.current = false;
    }
  }

  async function handleSend() {
    if (submittingLockRef.current || phase === "submitting") return;
    if (!selectedRecipient) return;
    submittingLockRef.current = true;
    setPendingAction("send");
    setPhase("submitting");
    const startedAt = Date.now();
    try {
      const draft = await persistDraft();
      await sendInvoice({ data: { companyId, invoiceId: draft.id } });
      await waitBankProcessMin(startedAt, BANK_PROCESS_MOTION.minProcessingMs);
      setSavedInvoiceId(draft.id);
      setSavedReferenceCode(draft.referenceCode);
      setSuccessMode("sent");
      setPhase("success");
      await invalidateRouteData(router);
    } catch (err) {
      setErrorReason(formatWorkflowError(err, "Unable to send invoice."));
      setPhase("error");
    } finally {
      setPendingAction(null);
      submittingLockRef.current = false;
    }
  }

  function handleCreateAnother() {
    if (initialInvoice) {
      onOpenChange(false);
      onDone?.();
      return;
    }
    setStep("recipient");
    setPhase("selection");
    setSelectedRecipient(null);
    setValues({ ...EMPTY_INVOICE_FORM });
    setStepError(null);
    setErrorReason(null);
    setSavedInvoiceId(null);
    setSavedReferenceCode(null);
    setSuccessMode(null);
    setPendingAction(null);
    contentKeyRef.current += 1;
  }

  function viewInvoice() {
    if (!savedInvoiceId) return;
    onOpenChange(false);
    void router.navigate({
      to: accountCommercialRoutes.invoiceDetail,
      params: { accountId, invoiceId: savedInvoiceId },
    });
  }

  const showBack =
    phase !== "success" &&
    phase !== "submitting" &&
    (step !== "recipient" || phase === "error");

  let footer: ReactNode = null;
  if (phase === "selection" || (phase === "details" && step === "recipient")) {
    footer = (
      <BankActionFooter>
        <BankActionPrimaryButton disabled={!selectedRecipient?.canReceive} onClick={goToDetails}>
          Continue
        </BankActionPrimaryButton>
      </BankActionFooter>
    );
  } else if (phase === "details" && step === "details") {
    footer = (
      <BankActionFooter>
        <BankActionPrimaryButton onClick={goToReview}>Continue</BankActionPrimaryButton>
      </BankActionFooter>
    );
  } else if (phase === "review") {
    footer = (
      <BankActionFooter>
        <BankActionSecondaryButton onClick={() => void handleSaveDraft()}>
          Save as draft
        </BankActionSecondaryButton>
        <BankActionPrimaryButton onClick={() => void handleSend()}>
          Send invoice
        </BankActionPrimaryButton>
      </BankActionFooter>
    );
  }

  let body: ReactNode;
  if (phase === "submitting") {
    body = (
      <BankActionProcessing
        label={pendingAction === "draft" ? "Saving draft…" : "Sending invoice…"}
        variant="progress"
      />
    );
  } else if (phase === "success") {
    const amount = Number(values.amount) || 0;
    body = (
      <BankActionSuccess
        title={successMode === "draft" ? "Draft saved" : "Invoice sent"}
        liveMessage={
          successMode === "draft"
            ? `Draft ${savedReferenceCode ?? ""} saved`
            : `Sent ${florin(amount)} to ${selectedRecipient?.displayName ?? "recipient"}`
        }
        onDone={() => {
          onOpenChange(false);
          onDone?.();
        }}
        onMakeAnother={initialInvoice ? undefined : handleCreateAnother}
        makeAnotherLabel="Create another"
        summary={[
          ...(savedReferenceCode
            ? [{ label: "Reference", value: savedReferenceCode, mono: true }]
            : []),
          { label: "Amount", value: florin(amount) },
          {
            label: "Recipient",
            value: selectedRecipient?.displayName ?? "—",
            secondary: selectedRecipient?.destinationLabel,
          },
        ]}
      >
        {savedInvoiceId ? (
          <button
            type="button"
            className="text-[13px] font-medium text-foreground underline-offset-2 hover:underline"
            onClick={viewInvoice}
          >
            View invoice
          </button>
        ) : null}
      </BankActionSuccess>
    );
  } else if (phase === "error") {
    body = (
      <BankProcessError
        message={errorReason ?? "Unable to create invoice."}
        onEdit={() => {
          setPhase("details");
          setStep("details");
        }}
        onRetry={() => {
          setPhase("review");
          setStep("review");
        }}
      />
    );
  } else if (step === "review" && selectedRecipient) {
    body = (
      <div className="space-y-4">
        <BankActionProgress
          step={3}
          total={3}
          label={`Step 3 of 3 · ${STEPS[2].label}`}
        />
        <BankProcessSummary
          rows={[
            {
              label: "To",
              value: selectedRecipient.displayName,
              secondary: selectedRecipient.destinationLabel,
            },
            { label: "Amount", value: florin(Number(values.amount) || 0) },
            { label: "Description", value: values.description.trim() },
            { label: "Due date", value: formatDueDateLabel(values.dueDate) },
            ...(values.memo.trim()
              ? [{ label: "Internal memo", value: values.memo.trim() }]
              : []),
          ]}
        />
        {stepError ? (
          <p className="text-[13px] text-destructive" role="alert">
            {stepError}
          </p>
        ) : null}
      </div>
    );
  } else if (step === "details") {
    body = (
      <div className="space-y-5">
        <BankActionProgress
          step={2}
          total={3}
          label={`Step 2 of 3 · ${STEPS[1].label}`}
        />
        {selectedRecipient ? (
          <div className="rounded-lg border border-border bg-surface-2/40 px-4 py-3 text-sm">
            <p className="text-[12px] text-muted-foreground">Recipient</p>
            <p className="mt-0.5 font-medium">{selectedRecipient.displayName}</p>
            <button
              type="button"
              className="mt-1 text-[12px] font-medium text-muted-foreground hover:text-foreground"
              onClick={() => {
                setStep("recipient");
                setPhase("selection");
              }}
            >
              Change recipient
            </button>
          </div>
        ) : null}
        <label className="block">
          <span className={fieldLabel}>Amount (FLR)</span>
          <input
            className={cn(inputClass, "tabular-nums")}
            type="number"
            min="0.01"
            step="0.01"
            inputMode="decimal"
            value={values.amount}
            onChange={(e) => {
              setValues((v) => ({ ...v, amount: e.target.value }));
              setStepError(null);
            }}
          />
        </label>
        <label className="block">
          <span className={fieldLabel}>Description</span>
          <input
            className={inputClass}
            value={values.description}
            onChange={(e) => {
              setValues((v) => ({ ...v, description: e.target.value }));
              setStepError(null);
            }}
            placeholder="What is this invoice for?"
          />
        </label>
        <label className="block">
          <span className={fieldLabel}>Due date (optional)</span>
          <input
            className={inputClass}
            type="date"
            value={values.dueDate}
            onChange={(e) => {
              setValues((v) => ({ ...v, dueDate: e.target.value }));
              setStepError(null);
            }}
          />
        </label>
        <label className="block">
          <span className={fieldLabel}>Internal memo (optional)</span>
          <Textarea
            autoResize
            className={cn(inputClass, "min-h-[80px]")}
            value={values.memo}
            onChange={(e) => setValues((v) => ({ ...v, memo: e.target.value }))}
            placeholder="Notes visible only to your team"
          />
        </label>
        {stepError ? (
          <p className="text-[13px] text-destructive" role="alert">
            {stepError}
          </p>
        ) : null}
      </div>
    );
  } else {
    body = (
      <div className="space-y-5">
        <BankActionProgress
          step={1}
          total={3}
          label={`Step 1 of 3 · ${STEPS[0].label}`}
        />
        <MerchantInvoiceRecipientField
          key={contentKeyRef.current}
          companyId={companyId}
          selectedRecipient={selectedRecipient}
          onSelectedRecipientChange={(recipient) => {
            setSelectedRecipient(recipient);
            setStepError(null);
          }}
          onUnavailableSelect={() => {
            setStepError("This recipient cannot receive invoices right now.");
          }}
          initialQuery={initialInvoice?.recipientName ?? ""}
        />
        {stepError ? (
          <p className="text-[13px] text-destructive" role="alert">
            {stepError}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <ResponsiveBankAction
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      phase={phase}
      dirty={dirty && phase !== "success" && phase !== "submitting"}
      size="lg"
      showBack={showBack}
      onBack={goBack}
      footer={footer}
      scrollResetKey={`${step}:${phase}`}
      contentClassName="max-md:min-h-[min(92dvh,var(--bank-mobile-sheet-max-height))]"
    >
      {body}
    </ResponsiveBankAction>
  );
}
