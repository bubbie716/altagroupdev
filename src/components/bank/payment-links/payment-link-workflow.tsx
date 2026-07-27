"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, Copy } from "lucide-react";
import { ResponsiveBankAction } from "@/components/bank/actions/responsive-bank-action";
import {
  BankActionFooter,
  BankActionPrimaryButton,
  BankActionProcessing,
  BankActionProgress,
  BankActionSuccess,
} from "@/components/bank/actions/bank-action-chrome";
import {
  BankProcessError,
  BankProcessSummary,
} from "@/components/bank/actions/bank-process-ui";
import { Textarea } from "@/components/ui/textarea";
import type { BankActionPhase } from "@/lib/bank/bank-action-flow";
import { florin } from "@/lib/bank/api";
import { formatCustomerActionError } from "@/lib/bank/bank-action-errors";
import { BANK_PROCESS_MOTION, waitBankProcessMin } from "@/lib/bank/bank-process";
import { accountCommercialRoutes } from "@/lib/bank/account-commercial-path";
import { createPaymentLinkRecord } from "@/lib/bank/payment-link.functions";
import type { PaymentLinkDetail } from "@/lib/bank/payment-link-types";
import {
  EMPTY_PAYMENT_LINK_FORM,
  isPaymentLinkFormDirty,
  validatePaymentLinkAmountRules,
  validatePaymentLinkDetails,
  type PaymentLinkFormValues,
} from "@/lib/bank/payment-link-validation";
import { invalidateRouteData } from "@/lib/router/invalidate-route-data";
import { absolutePaymentLinkCheckoutUrl } from "@/lib/bank/payment-link-checkout-url";
import { cn } from "@/lib/utils";

const fieldLabel = "type-meta";
const inputClass =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-base sm:text-sm shadow-none focus-visible:outline-none focus-visible:border-gold/60 focus-visible:ring-0 disabled:opacity-60 min-h-11";

type WizardStep = "details" | "amount" | "review";

const STEPS: { id: WizardStep; label: string }[] = [
  { id: "details", label: "Details" },
  { id: "amount", label: "Amount and usage" },
  { id: "review", label: "Review" },
];

function formatWorkflowError(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message.trim()) {
    return err.message.replace(/^BAD_REQUEST:/, "").trim();
  }
  return formatCustomerActionError(err, "settings") || fallback;
}

function amountSummary(values: PaymentLinkFormValues): string {
  if (values.amountType === "FIXED") {
    return florin(Number(values.amount) || 0);
  }
  const min = values.minAmount.trim();
  const max = values.maxAmount.trim();
  if (min && max) return `${florin(Number(min))} – ${florin(Number(max))}`;
  if (min) return `Min ${florin(Number(min))}`;
  if (max) return `Max ${florin(Number(max))}`;
  return "Open amount";
}

export function PaymentLinkWorkflow({
  open,
  onOpenChange,
  onDone,
  companyId,
  accountId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
  companyId: string;
  accountId: string;
}) {
  const router = useRouter();
  const createLink = useServerFn(createPaymentLinkRecord);

  const [step, setStep] = useState<WizardStep>("details");
  const [phase, setPhase] = useState<BankActionPhase>("details");
  const [values, setValues] = useState<PaymentLinkFormValues>({ ...EMPTY_PAYMENT_LINK_FORM });
  const [stepError, setStepError] = useState<string | null>(null);
  const [errorReason, setErrorReason] = useState<string | null>(null);
  const [created, setCreated] = useState<PaymentLinkDetail | null>(null);
  const [copied, setCopied] = useState(false);
  const submittingLockRef = useRef(false);

  const dirty = isPaymentLinkFormDirty(values, EMPTY_PAYMENT_LINK_FORM);

  const resetWorkflow = useCallback(() => {
    setStep("details");
    setPhase("details");
    setValues({ ...EMPTY_PAYMENT_LINK_FORM });
    setStepError(null);
    setErrorReason(null);
    setCreated(null);
    setCopied(false);
    submittingLockRef.current = false;
  }, []);

  useEffect(() => {
    if (open) return;
    const timer = setTimeout(resetWorkflow, 320);
    return () => clearTimeout(timer);
  }, [open, resetWorkflow]);

  const title = useMemo(() => {
    if (phase === "submitting") return "Creating payment link";
    if (phase === "success") return "Payment link created";
    if (phase === "error") return "Link creation unsuccessful";
    if (step === "details") return "New payment link";
    if (step === "amount") return "Amount and usage";
    return "Review payment link";
  }, [phase, step]);

  const description = useMemo(() => {
    if (phase === "submitting" || phase === "success") return undefined;
    if (phase === "error") return "Your entries were preserved.";
    if (step === "details") return "Describe what this payment is for.";
    if (step === "amount") return "Set amount rules, usage, and optional expiration.";
    return "Confirm details before creating the link.";
  }, [phase, step]);

  function patch(partial: Partial<PaymentLinkFormValues>) {
    setValues((prev) => ({ ...prev, ...partial }));
    setStepError(null);
  }

  function goBack() {
    setStepError(null);
    if (phase === "error") {
      setPhase("review");
      setStep("review");
      return;
    }
    if (step === "review") {
      setStep("amount");
      setPhase("details");
      return;
    }
    if (step === "amount") {
      setStep("details");
      setPhase("details");
    }
  }

  function goToAmount() {
    setStepError(null);
    const err = validatePaymentLinkDetails(values);
    if (err) {
      setStepError(err);
      return;
    }
    setStep("amount");
    setPhase("details");
  }

  function goToReview() {
    setStepError(null);
    const err = validatePaymentLinkAmountRules(values);
    if (err) {
      setStepError(err);
      return;
    }
    setStep("review");
    setPhase("review");
  }

  async function handleCreate() {
    if (submittingLockRef.current || phase === "submitting") return;
    const detailsErr = validatePaymentLinkDetails(values);
    if (detailsErr) {
      setStepError(detailsErr);
      return;
    }
    const amountErr = validatePaymentLinkAmountRules(values);
    if (amountErr) {
      setStepError(amountErr);
      return;
    }

    submittingLockRef.current = true;
    setPhase("submitting");
    const startedAt = Date.now();
    try {
      const link = (await createLink({
        data: {
          companyId,
          title: values.title.trim() || undefined,
          description: values.description.trim(),
          internalMemo: values.internalMemo.trim() || undefined,
          amountType: values.amountType,
          usageType: values.usageType,
          amount: values.amountType === "FIXED" ? Number(values.amount) : undefined,
          minAmount:
            values.amountType === "OPEN" && values.minAmount.trim()
              ? Number(values.minAmount)
              : undefined,
          maxAmount:
            values.amountType === "OPEN" && values.maxAmount.trim()
              ? Number(values.maxAmount)
              : undefined,
          expiresAt: values.expiresAt || null,
        },
      })) as PaymentLinkDetail;
      await waitBankProcessMin(startedAt, BANK_PROCESS_MOTION.minProcessingMs);
      setCreated(link);
      setPhase("success");
      await invalidateRouteData(router);
    } catch (err) {
      setErrorReason(formatWorkflowError(err, "Unable to create payment link."));
      setPhase("error");
    } finally {
      submittingLockRef.current = false;
    }
  }

  function handleCreateAnother() {
    resetWorkflow();
  }

  function viewLink() {
    if (!created) return;
    onOpenChange(false);
    void router.navigate({
      to: accountCommercialRoutes.paymentLinkDetail,
      params: { accountId, linkId: created.id },
    });
  }

  async function copyCheckoutUrl() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(
        absolutePaymentLinkCheckoutUrl(created.checkoutUrl, window.location.origin),
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setErrorReason("Could not copy link to clipboard.");
    }
  }

  const showBack =
    phase !== "success" && phase !== "submitting" && (step !== "details" || phase === "error");

  let footer: ReactNode = null;
  if (phase === "details" && step === "details") {
    footer = (
      <BankActionFooter>
        <BankActionPrimaryButton onClick={goToAmount}>Continue</BankActionPrimaryButton>
      </BankActionFooter>
    );
  } else if (phase === "details" && step === "amount") {
    footer = (
      <BankActionFooter>
        <BankActionPrimaryButton onClick={goToReview}>Continue</BankActionPrimaryButton>
      </BankActionFooter>
    );
  } else if (phase === "review") {
    footer = (
      <BankActionFooter>
        <BankActionPrimaryButton onClick={() => void handleCreate()}>
          Create payment link
        </BankActionPrimaryButton>
      </BankActionFooter>
    );
  }

  let body: ReactNode;
  if (phase === "submitting") {
    body = <BankActionProcessing label="Creating payment link…" variant="progress" />;
  } else if (phase === "success" && created) {
    body = (
      <BankActionSuccess
        title="Payment link created"
        liveMessage={`Created ${created.referenceCode}`}
        onDone={() => {
          onOpenChange(false);
          onDone?.();
        }}
        onMakeAnother={handleCreateAnother}
        makeAnotherLabel="Create another"
        summary={[
          { label: "Reference", value: created.referenceCode, mono: true },
          { label: "Amount", value: amountSummary(values) },
          {
            label: "Usage",
            value: values.usageType === "ONE_TIME" ? "One-time" : "Reusable",
          },
        ]}
      >
        <div className="w-full space-y-3 text-left">
          <div className="rounded-lg border border-border bg-surface-2/40 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Checkout URL</p>
            <p className="mt-1 break-all font-mono text-[12px] text-foreground">
              {created.checkoutUrl}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void copyCheckoutUrl()}
              className="inline-flex h-11 items-center gap-2 rounded-md border border-border px-3 text-[13px] font-medium hover:bg-[var(--menu-item-hover)]"
            >
              {copied ? <Check className="size-4 text-[var(--success)]" /> : <Copy className="size-4" />}
              {copied ? "Copied" : "Copy link"}
            </button>
            <button
              type="button"
              onClick={viewLink}
              className="inline-flex h-11 items-center rounded-md border border-border px-3 text-[13px] font-medium hover:bg-[var(--menu-item-hover)]"
            >
              View link
            </button>
          </div>
        </div>
      </BankActionSuccess>
    );
  } else if (phase === "error") {
    body = (
      <BankProcessError
        message={errorReason ?? "Unable to create payment link."}
        onEdit={() => {
          setPhase("details");
          setStep("amount");
        }}
        onRetry={() => {
          setPhase("review");
          setStep("review");
        }}
      />
    );
  } else if (step === "review") {
    body = (
      <div className="space-y-4">
        <BankActionProgress step={3} total={3} label={`Step 3 of 3 · ${STEPS[2].label}`} />
        <BankProcessSummary
          rows={[
            ...(values.title.trim()
              ? [{ label: "Title", value: values.title.trim() }]
              : []),
            { label: "Description", value: values.description.trim() },
            { label: "Amount", value: amountSummary(values) },
            {
              label: "Usage",
              value: values.usageType === "ONE_TIME" ? "One-time" : "Reusable",
            },
            {
              label: "Expires",
              value: values.expiresAt
                ? new Date(values.expiresAt).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })
                : "No expiration",
            },
            ...(values.internalMemo.trim()
              ? [{ label: "Internal memo", value: values.internalMemo.trim() }]
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
  } else if (step === "amount") {
    body = (
      <div className="space-y-5">
        <BankActionProgress step={2} total={3} label={`Step 2 of 3 · ${STEPS[1].label}`} />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={fieldLabel}>Amount type</span>
            <select
              className={inputClass}
              value={values.amountType}
              onChange={(e) =>
                patch({ amountType: e.target.value as PaymentLinkFormValues["amountType"] })
              }
            >
              <option value="FIXED">Fixed amount</option>
              <option value="OPEN">Open amount</option>
            </select>
          </label>
          <label className="block">
            <span className={fieldLabel}>Link type</span>
            <select
              className={inputClass}
              value={values.usageType}
              onChange={(e) =>
                patch({ usageType: e.target.value as PaymentLinkFormValues["usageType"] })
              }
            >
              <option value="REUSABLE">Reusable</option>
              <option value="ONE_TIME">One-time</option>
            </select>
          </label>
        </div>
        {values.amountType === "FIXED" ? (
          <label className="block">
            <span className={fieldLabel}>Amount (FLR)</span>
            <input
              className={cn(inputClass, "tabular-nums")}
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              value={values.amount}
              onChange={(e) => patch({ amount: e.target.value })}
            />
          </label>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={fieldLabel}>Minimum (optional)</span>
              <input
                className={cn(inputClass, "tabular-nums")}
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                value={values.minAmount}
                onChange={(e) => patch({ minAmount: e.target.value })}
              />
            </label>
            <label className="block">
              <span className={fieldLabel}>Maximum (optional)</span>
              <input
                className={cn(inputClass, "tabular-nums")}
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                value={values.maxAmount}
                onChange={(e) => patch({ maxAmount: e.target.value })}
              />
            </label>
          </div>
        )}
        <label className="block">
          <span className={fieldLabel}>Expires (optional)</span>
          <input
            className={inputClass}
            type="datetime-local"
            value={values.expiresAt}
            onChange={(e) => patch({ expiresAt: e.target.value })}
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
        <BankActionProgress step={1} total={3} label={`Step 1 of 3 · ${STEPS[0].label}`} />
        <label className="block">
          <span className={fieldLabel}>Title (optional)</span>
          <input
            className={inputClass}
            value={values.title}
            onChange={(e) => patch({ title: e.target.value })}
          />
        </label>
        <label className="block">
          <span className={fieldLabel}>Description</span>
          <input
            className={inputClass}
            value={values.description}
            onChange={(e) => patch({ description: e.target.value })}
            placeholder="What is this payment for?"
          />
        </label>
        <label className="block">
          <span className={fieldLabel}>Internal memo (optional)</span>
          <Textarea
            autoResize
            className={cn(inputClass, "min-h-[80px]")}
            value={values.internalMemo}
            onChange={(e) => patch({ internalMemo: e.target.value })}
          />
        </label>
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
