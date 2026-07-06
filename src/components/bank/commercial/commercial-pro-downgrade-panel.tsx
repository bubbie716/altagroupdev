"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  BankRequestErrorCard,
  BankRequestSubmitButton,
  BankRequestSuccessCard,
  type BankRequestSubmissionResult,
} from "@/components/bank/bank-request-submission-ui";
import { LoadingMessage } from "@/components/ui/loading-indicator";
import { LOADING_COPY } from "@/lib/ui/route-loading";
import { florin } from "@/lib/bank/api";
import { formatCustomerActionError } from "@/lib/bank/bank-action-errors";
import type { CommercialDowngradePreview } from "@/lib/bank/commercial-billing-types";
import { COMMERCIAL_PLAN_LABELS } from "@/lib/bank/commercial-banking-types";
import {
  downgradeCommercialProPlan,
  fetchCommercialDowngradePreview,
} from "@/lib/bank/commercial-banking.functions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const DOWNGRADE_DESCRIPTION =
  "Downgrade to Alta Commercial Core to stop Pro billing. Core limits apply immediately.";

const downgradeDialogClass =
  "max-w-md gap-3 border-border bg-background p-5 sm:max-h-[min(85dvh,calc(100dvh-5rem))]";

type FormView = "compose" | "review" | "success" | "error";

type CommercialProDowngradePanelProps = {
  companyId: string;
  onCompleted: () => void;
  children: (props: { open: () => void; loading: boolean }) => ReactNode;
};

function CleanupSummary({ preview }: { preview: CommercialDowngradePreview }) {
  const { cleanup, coreLimits } = preview;
  const items: string[] = [];

  if (cleanup.payrollRuns.length > 0) {
    items.push(
      `${cleanup.payrollRuns.length} pending payroll run${cleanup.payrollRuns.length === 1 ? "" : "s"} will be cancelled`,
    );
  }
  if (cleanup.activePayrollEmployees.length > 0) {
    const count = cleanup.activePayrollEmployees.length;
    items.push(
      `${count} payroll account${count === 1 ? "" : "s"} will stop being paid. Employee records stay saved on Core.`,
    );
  }
  if (cleanup.paymentLinksCancelled > 0) {
    items.push(
      `${cleanup.paymentLinksCancelled} payment link${cleanup.paymentLinksCancelled === 1 ? "" : "s"} created this month will be cancelled to meet the Core limit of ${coreLimits.corePaymentLinkMonthlyLimit}`,
    );
  }
  if (cleanup.invoicesCancelled > 0) {
    items.push(
      `${cleanup.invoicesCancelled} invoice${cleanup.invoicesCancelled === 1 ? "" : "s"} created this month will be cancelled to meet the Core limit of ${coreLimits.coreInvoiceMonthlyLimit}`,
    );
  }

  if (items.length === 0) {
    return (
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        No receivables or payroll activity need to be cancelled for Core limits right now.
      </p>
    );
  }

  return (
    <ul className="space-y-2 text-[13px] leading-relaxed text-muted-foreground">
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <span aria-hidden="true">·</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function CommercialProDowngradePanel({
  companyId,
  onCompleted,
  children,
}: CommercialProDowngradePanelProps) {
  const router = useRouter();
  const fetchPreview = useServerFn(fetchCommercialDowngradePreview);
  const downgradePlan = useServerFn(downgradeCommercialProPlan);

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<FormView>("compose");
  const [preview, setPreview] = useState<CommercialDowngradePreview | null>(null);
  const [composeError, setComposeError] = useState<string | null>(null);
  const [errorReason, setErrorReason] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submission, setSubmission] = useState<BankRequestSubmissionResult | null>(null);

  function resetForm() {
    setView("compose");
    setComposeError(null);
    setErrorReason(null);
    setSubmission(null);
    setPreview(null);
  }

  async function openPanel() {
    setOpen(true);
    resetForm();
    setLoading(true);
    try {
      const nextPreview = await fetchPreview({ data: companyId });
      setPreview(nextPreview);
      if (!nextPreview.canDowngrade) {
        setComposeError("This company is not eligible to downgrade right now.");
      }
    } catch (err) {
      setComposeError(
        err instanceof Error
          ? err.message.replace(/^BAD_REQUEST:/, "")
          : "Could not load downgrade preview.",
      );
    } finally {
      setLoading(false);
    }
  }

  function handleOpenChange(next: boolean) {
    if (!next && view === "success") {
      void router.invalidate();
      onCompleted();
    }
    setOpen(next);
    if (!next) {
      resetForm();
    }
  }

  async function submitDowngrade(e: React.FormEvent) {
    e.preventDefault();
    if (!preview || submitting) return;

    setSubmitting(true);

    try {
      const result = await downgradePlan({ data: { companyId } });

      const submitted: BankRequestSubmissionResult = {
        referenceCode: result.companyId,
        amount: 0,
        submittedAt: new Date().toISOString(),
        accountName: result.companyName,
        accountNumber: COMMERCIAL_PLAN_LABELS.CORE,
      };

      setSubmission(submitted);
      setView("success");
    } catch (err) {
      setErrorReason(formatCustomerActionError(err, "commercial_pro_downgrade"));
      setView("error");
    } finally {
      setSubmitting(false);
    }
  }

  function renderContent() {
    if (loading) {
      return <LoadingMessage>{LOADING_COPY.commercialDowngrade}</LoadingMessage>;
    }

    if (view === "success" && submission) {
      return (
        <BankRequestSuccessCard
          kind="commercial_pro_downgrade"
          result={submission}
          variant="embedded"
          onSubmitAnother={() => handleOpenChange(false)}
        />
      );
    }

    if (view === "error") {
      return (
        <BankRequestErrorCard
          reason={errorReason}
          variant="embedded"
          onTryAgain={() => {
            setErrorReason(null);
            setView("review");
          }}
        />
      );
    }

    if (view === "review" && preview) {
      return (
        <form onSubmit={submitDowngrade} className="space-y-4">
          <div className="space-y-4">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">
                Review downgrade
              </div>
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                Confirm the details below. This takes effect immediately.
              </p>
            </div>

            <div className="space-y-3 border-y border-border/60 py-4 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Current plan</span>
                <span className="font-medium">{COMMERCIAL_PLAN_LABELS[preview.currentPlan]}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">New plan</span>
                <span className="font-medium">{COMMERCIAL_PLAN_LABELS[preview.targetPlan]}</span>
              </div>
              {preview.monthlyFee != null ? (
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Pro billing</span>
                  <span className="text-right text-[13px]">
                    {florin(preview.monthlyFee)} / month stops immediately
                  </span>
                </div>
              ) : null}
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Core cleanup
              </p>
              <div className="mt-2">
                <CleanupSummary preview={preview} />
              </div>
            </div>

            <fieldset
              disabled={submitting}
              className="flex flex-wrap items-center gap-2 border-0 p-0 m-0 min-w-0"
            >
              <button
                type="button"
                disabled={submitting}
                onClick={() => setView("compose")}
                className="rounded-md border border-border px-4 py-2.5 text-[13px] font-medium transition-colors hover:bg-surface-2/60 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Back
              </button>
              <BankRequestSubmitButton
                kind="commercial_pro_downgrade"
                submitting={submitting}
                showContainer={false}
              />
            </fieldset>
          </div>
        </form>
      );
    }

    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!preview?.canDowngrade) return;
          setView("review");
        }}
        className="space-y-4"
      >
        <div className="space-y-3 text-[13px] leading-relaxed text-muted-foreground">
          <p>
            Core includes {preview?.coreLimits.coreInvoiceMonthlyLimit ?? 10} invoices and{" "}
            {preview?.coreLimits.corePaymentLinkMonthlyLimit ?? 5} payment links per month, up to{" "}
            {preview?.coreLimits.coreTeamMemberLimit ?? 3} team members, and basic analytics.
          </p>
          <p>
            You will lose advanced analytics, payroll, custom branding, priority support, and
            unlimited receivables.
          </p>
        </div>

        {preview ? (
          <div className="rounded-lg border border-border/70 bg-surface-2/30 p-3">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              If you downgrade now
            </p>
            <div className="mt-2">
              <CleanupSummary preview={preview} />
            </div>
          </div>
        ) : null}

        {composeError ? <p className="text-sm text-destructive">{composeError}</p> : null}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleOpenChange(false)}
            className="rounded-md border border-border px-4 py-2.5 text-[13px] font-medium transition-colors hover:bg-surface-2/60"
          >
            Cancel
          </button>
          <BankRequestSubmitButton
            kind="commercial_pro_downgrade"
            submitting={false}
            disabled={!preview?.canDowngrade}
            label="Review Downgrade"
            showContainer={false}
          />
        </div>
      </form>
    );
  }

  const showIntro = view === "compose" && !loading;

  return (
    <>
      {children({ open: () => void openPanel(), loading })}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className={downgradeDialogClass}>
          <DialogHeader className="space-y-1 pr-8">
            <DialogTitle className="font-serif text-[18px] leading-snug">Downgrade to Core</DialogTitle>
            {showIntro ? (
              <DialogDescription className="text-[13px] leading-relaxed">
                {DOWNGRADE_DESCRIPTION}
              </DialogDescription>
            ) : null}
          </DialogHeader>
          {renderContent()}
        </DialogContent>
      </Dialog>
    </>
  );
}
