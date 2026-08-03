"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  BankRequestErrorCard,
  BankRequestSubmitButton,
  BankRequestSuccessCard,
  type BankRequestSubmissionResult,
} from "@/components/bank/bank-request-submission-ui";
import { SkeletonFormPanel } from "@/components/ui/skeleton-form-panel";
import { LOADING_COPY } from "@/lib/ui/route-loading";
import { ResponsiveBankAction } from "@/components/bank/actions/responsive-bank-action";
import {
  BankActionFooter,
  BankActionSecondaryButton,
} from "@/components/bank/actions/bank-action-buttons";
import { florin } from "@/lib/bank/api";
import { formatCustomerActionError } from "@/lib/bank/bank-action-errors";
import type { BankActionPhase } from "@/lib/bank/bank-action-flow";
import type {
  CommercialDowngradeMode,
  CommercialDowngradePreview,
} from "@/lib/bank/commercial-billing-types";
import { COMMERCIAL_PLAN_LABELS } from "@/lib/bank/commercial-banking-types";
import {
  downgradeCommercialProPlan,
  fetchCommercialDowngradePreview,
} from "@/lib/bank/commercial-banking.functions";
import { formatActivityDateTime } from "@/lib/format-datetime";
import { cn } from "@/lib/utils";
import { refreshMutationRouteData } from "@/lib/router/post-mutation-refresh";

const DOWNGRADE_DESCRIPTION =
  "Return to Alta Commercial Core when your current Pro period ends, or downgrade immediately with explicit confirmation.";

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
        No payroll or excess receivables need to be cancelled for Core limits right now.
      </p>
    );
  }

  return (
    <ul className="space-y-2 text-[13px] leading-relaxed text-muted-foreground">
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <span aria-hidden="true">·</span>
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ul>
  );
}

function PeriodEndExplainer({ preview }: { preview: CommercialDowngradePreview }) {
  const periodLabel = preview.periodEndAt
    ? formatActivityDateTime(preview.periodEndAt)
    : "the end of your current billing period";

  return (
    <div className="min-w-0 space-y-3 text-[13px] leading-relaxed text-muted-foreground">
      <p>
        Pro stays active through{" "}
        <span className="font-medium text-foreground">{periodLabel}</span>. Existing invoices and
        payment links remain valid. After that date, new invoices and payment links follow Core
        limits, and payroll shows Pro ending on that date.
      </p>
      <p>
        Core includes {preview.coreLimits.coreInvoiceMonthlyLimit} invoices and{" "}
        {preview.coreLimits.corePaymentLinkMonthlyLimit} payment links per month, and up to{" "}
        {preview.coreLimits.coreTeamMemberLimit} team members.
      </p>
    </div>
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
  const [phase, setPhase] = useState<BankActionPhase>("details");
  const [preview, setPreview] = useState<CommercialDowngradePreview | null>(null);
  const [mode, setMode] = useState<CommercialDowngradeMode>("period_end");
  const [acknowledgeImmediate, setAcknowledgeImmediate] = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);
  const [errorReason, setErrorReason] = useState<string | null>(null);
  const [submission, setSubmission] = useState<BankRequestSubmissionResult | null>(null);
  const [resultMode, setResultMode] = useState<CommercialDowngradeMode | null>(null);
  const [effectiveAt, setEffectiveAt] = useState<string | null>(null);

  const dirty = useMemo(() => {
    if (phase === "success" || phase === "submitting") return false;
    if (phase === "review") return true;
    return mode !== "period_end" || acknowledgeImmediate;
  }, [phase, mode, acknowledgeImmediate]);

  function resetForm() {
    setPhase("details");
    setComposeError(null);
    setErrorReason(null);
    setSubmission(null);
    setPreview(null);
    setMode("period_end");
    setAcknowledgeImmediate(false);
    setResultMode(null);
    setEffectiveAt(null);
  }

  async function openPanel() {
    setOpen(true);
    resetForm();
    setLoading(true);
    try {
      const nextPreview = await fetchPreview({ data: companyId });
      setPreview(nextPreview);
      if (nextPreview.downgradeAlreadyScheduled) {
        setComposeError(
          nextPreview.scheduledDowngradeAt
            ? `A downgrade is already scheduled for ${formatActivityDateTime(nextPreview.scheduledDowngradeAt)}.`
            : "A downgrade is already scheduled for the end of this billing period.",
        );
      } else if (!nextPreview.canDowngrade) {
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
    if (!next && phase === "success") {
      void refreshMutationRouteData(router, "corporate");
      onCompleted();
    }
    setOpen(next);
    if (!next) {
      resetForm();
    }
  }

  function goToReview() {
    setComposeError(null);
    if (!preview?.canDowngrade || preview.downgradeAlreadyScheduled) return;
    if (mode === "immediate" && !acknowledgeImmediate) {
      setComposeError("Confirm the immediate cleanup items before continuing.");
      return;
    }
    setPhase("review");
  }

  async function submitDowngrade() {
    if (!preview || phase === "submitting") return;

    setPhase("submitting");

    try {
      const result = await downgradePlan({
        data: {
          companyId,
          mode,
          ...(mode === "immediate" ? { acknowledgeImmediateCleanup: true } : {}),
        },
      });

      setResultMode(result.mode);
      setEffectiveAt(result.effectiveAt);
      setSubmission({
        referenceCode: result.companyId,
        amount: 0,
        submittedAt: new Date().toISOString(),
        accountName: result.companyName,
        accountNumber: COMMERCIAL_PLAN_LABELS.CORE,
      });
      setPhase("success");
    } catch (err) {
      setErrorReason(formatCustomerActionError(err, "commercial_pro_downgrade"));
      setPhase("error");
    }
  }

  const title =
    phase === "success"
      ? resultMode === "period_end"
        ? "Downgrade scheduled"
        : "Downgraded to Core"
      : phase === "error"
        ? "Downgrade failed"
        : phase === "review" || phase === "submitting"
          ? "Review downgrade"
          : "Downgrade to Core";

  const description =
    phase === "details" && !loading
      ? DOWNGRADE_DESCRIPTION
      : phase === "review"
        ? mode === "period_end"
          ? "Confirm scheduling Core at period end."
          : "Confirm immediate downgrade and cleanup."
        : undefined;

  const showBack = phase === "review" || phase === "error";

  function renderBody() {
    if (loading) {
      return <SkeletonFormPanel fields={3} label={LOADING_COPY.commercialDowngrade} />;
    }

    if (phase === "success" && submission) {
      if (resultMode === "period_end") {
        return (
          <div className="text-center" role="status" aria-live="polite">
            <p className="text-lg font-semibold tracking-tight">Downgrade scheduled</p>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
              Pro remains active until{" "}
              {effectiveAt ? formatActivityDateTime(effectiveAt) : "period end"}. Existing invoices
              and payment links stay valid. Core limits apply to new creation after that date.
            </p>
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              className="mt-6 w-full rounded-xl border border-border/80 bg-background px-4 py-3 text-[14px] font-medium tracking-tight text-foreground transition-colors hover:bg-surface-2/60"
            >
              Close
            </button>
          </div>
        );
      }

      return (
        <BankRequestSuccessCard
          kind="commercial_pro_downgrade"
          result={submission}
          variant="embedded"
          onSubmitAnother={() => handleOpenChange(false)}
        />
      );
    }

    if (phase === "error") {
      return (
        <BankRequestErrorCard
          reason={errorReason}
          variant="embedded"
          onTryAgain={() => {
            setErrorReason(null);
            setPhase("review");
          }}
        />
      );
    }

    if ((phase === "review" || phase === "submitting") && preview) {
      return (
        <div className="min-w-0 space-y-4">
          <div className="min-w-0 space-y-3 border-y border-border/60 py-4 text-sm">
            <div className="flex min-w-0 justify-between gap-3">
              <span className="shrink-0 text-muted-foreground">Current plan</span>
              <span className="min-w-0 truncate text-right font-medium">
                {COMMERCIAL_PLAN_LABELS[preview.currentPlan]}
              </span>
            </div>
            <div className="flex min-w-0 justify-between gap-3">
              <span className="shrink-0 text-muted-foreground">New plan</span>
              <span className="min-w-0 truncate text-right font-medium">
                {COMMERCIAL_PLAN_LABELS[preview.targetPlan]}
              </span>
            </div>
            <div className="flex min-w-0 justify-between gap-3">
              <span className="shrink-0 text-muted-foreground">Effective</span>
              <span className="min-w-0 text-right text-[13px]">
                {mode === "period_end"
                  ? preview.periodEndAt
                    ? formatActivityDateTime(preview.periodEndAt)
                    : "End of billing period"
                  : "Immediately"}
              </span>
            </div>
            {preview.monthlyFee != null ? (
              <div className="flex min-w-0 justify-between gap-3">
                <span className="shrink-0 text-muted-foreground">Pro billing</span>
                <span className="min-w-0 text-right text-[13px]">
                  {mode === "period_end"
                    ? `${florin(preview.monthlyFee)} / month through period end`
                    : `${florin(preview.monthlyFee)} / month stops immediately`}
                </span>
              </div>
            ) : null}
          </div>

          {mode === "period_end" ? (
            <PeriodEndExplainer preview={preview} />
          ) : (
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Immediate cleanup
              </p>
              <div className="mt-2">
                <CleanupSummary preview={preview} />
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="min-w-0 space-y-4">
        {preview ? <PeriodEndExplainer preview={preview} /> : null}

        <div className="min-w-0 space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
            When to downgrade
          </p>
          <div className="min-w-0 space-y-2">
            <ModeOption
              selected={mode === "period_end"}
              title="Downgrade at period end"
              description={
                preview?.periodEndAt
                  ? `Recommended. Pro ends ${formatActivityDateTime(preview.periodEndAt)}. No receivables are cancelled now.`
                  : "Recommended. Keep Pro until the current billing period ends."
              }
              onSelect={() => {
                setMode("period_end");
                setAcknowledgeImmediate(false);
                setComposeError(null);
              }}
            />
            <ModeOption
              selected={mode === "immediate"}
              title="Downgrade immediately"
              description="Ends Pro now. Requires acknowledging payroll and excess invoice/link cleanup."
              onSelect={() => {
                setMode("immediate");
                setComposeError(null);
              }}
            />
          </div>
        </div>

        {mode === "immediate" && preview ? (
          <div className="min-w-0 rounded-lg border border-border/70 bg-surface-2/30 p-3">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Immediate cleanup
            </p>
            <div className="mt-2">
              <CleanupSummary preview={preview} />
            </div>
            <label className="mt-3 flex min-w-0 items-start gap-2 text-[13px] leading-relaxed">
              <input
                type="checkbox"
                className="mt-1 size-4 shrink-0 rounded border-border"
                checked={acknowledgeImmediate}
                onChange={(e) => {
                  setAcknowledgeImmediate(e.target.checked);
                  setComposeError(null);
                }}
              />
              <span className="min-w-0">
                I understand payroll will be cancelled and excess invoices or payment links created
                this month may be cancelled to meet Core limits.
              </span>
            </label>
          </div>
        ) : null}

        {composeError ? <p className="text-sm text-destructive">{composeError}</p> : null}
      </div>
    );
  }

  const canContinue =
    Boolean(preview?.canDowngrade) &&
    !preview?.downgradeAlreadyScheduled &&
    (mode === "period_end" || acknowledgeImmediate);

  const footer =
    phase === "success" || phase === "error" || loading ? null : (
      <form
        className="[&_button[type=submit]]:w-full sm:[&_button[type=submit]]:w-auto"
        onSubmit={(e) => {
          e.preventDefault();
          if (phase === "review" || phase === "submitting") void submitDowngrade();
          else goToReview();
        }}
      >
        {phase === "review" || phase === "submitting" ? (
          <BankActionFooter>
            <BankActionSecondaryButton
              disabled={phase === "submitting"}
              onClick={() => setPhase("details")}
            >
              Back
            </BankActionSecondaryButton>
            <BankRequestSubmitButton
              kind="commercial_pro_downgrade"
              submitting={phase === "submitting"}
              label={mode === "period_end" ? "Schedule Downgrade" : "Downgrade Immediately"}
              showContainer={false}
            />
          </BankActionFooter>
        ) : (
          <BankActionFooter>
            <BankActionSecondaryButton onClick={() => handleOpenChange(false)}>
              Cancel
            </BankActionSecondaryButton>
            <BankRequestSubmitButton
              kind="commercial_pro_downgrade"
              submitting={false}
              disabled={!canContinue}
              label="Review Downgrade"
              showContainer={false}
            />
          </BankActionFooter>
        )}
      </form>
    );

  return (
    <>
      {children({ open: () => void openPanel(), loading })}
      <ResponsiveBankAction
        open={open}
        onOpenChange={handleOpenChange}
        title={title}
        description={description}
        phase={phase}
        dirty={dirty}
        showBack={showBack}
        onBack={() => {
          if (phase === "error") {
            setErrorReason(null);
            setPhase("review");
            return;
          }
          setPhase("details");
        }}
        footer={footer}
        size="md"
        scrollResetKey={phase}
      >
        {renderBody()}
      </ResponsiveBankAction>
    </>
  );
}

function ModeOption({
  selected,
  title,
  description,
  onSelect,
}: {
  selected: boolean;
  title: string;
  description: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full min-w-0 flex-col rounded-lg border px-3 py-3 text-left transition-colors",
        selected
          ? "border-foreground bg-surface-2/40"
          : "border-border hover:bg-surface-2/30",
      )}
      aria-pressed={selected}
    >
      <span className="text-[13px] font-medium text-foreground">{title}</span>
      <span className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{description}</span>
    </button>
  );
}
