"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ResponsiveBankAction } from "@/components/bank/actions/responsive-bank-action";
import {
  BankActionFooter,
  BankActionPrimaryButton,
  BankActionProcessing,
  BankActionProgress,
  BankActionSuccess,
} from "@/components/bank/actions/bank-action-chrome";
import { BankProcessError } from "@/components/bank/actions/bank-process-ui";
import { AltaCardVisual } from "@/components/bank/alta-card/alta-card-visual";
import { Checkbox } from "@/components/ui/checkbox";
import type { BankActionPhase } from "@/lib/bank/bank-action-flow";
import { formatCustomerActionError } from "@/lib/bank/bank-action-errors";
import { BANK_PROCESS_MOTION, waitBankProcessMin } from "@/lib/bank/bank-process";
import {
  submitBusinessAltaCardApplication,
  submitPersonalAltaCardApplication,
} from "@/lib/bank/alta-card.functions";
import { useOptionalProductConsentAction } from "@/components/legal/product-consent-action-controller";
import { executeWithProductConsentResume } from "@/lib/legal/execute-with-product-consent";
import type { AltaCardTierCode } from "@/lib/bank/alta-card-types";
import {
  ALTA_CARD_DEFAULT_LIMITS,
  ALTA_CARD_TIER_LABELS,
  ALTA_CARD_TIER_ORDER,
} from "@/lib/bank/alta-card-types";
import { ALTA_CARD_TIER_CONFIG } from "@/lib/bank/alta-card-tier-config";
import {
  mockBankActionSubmission,
  shouldUseBankActionUiLabMock,
} from "@/lib/bank/bank-action-ui-lab";
import { cn } from "@/lib/utils";

type ApplyContext = Awaited<
  ReturnType<typeof import("@/lib/bank/alta-card.functions").fetchAltaCardApplyContext>
>;

type WizardStepId = "company" | "tier" | "terms" | "review";

const PERSONAL_STEPS: { id: WizardStepId; shortLabel: string }[] = [
  { id: "tier", shortLabel: "Tier" },
  { id: "terms", shortLabel: "Terms" },
  { id: "review", shortLabel: "Review" },
];

const BUSINESS_STEPS: { id: WizardStepId; shortLabel: string }[] = [
  { id: "company", shortLabel: "Company" },
  { id: "tier", shortLabel: "Tier" },
  { id: "terms", shortLabel: "Terms" },
  { id: "review", shortLabel: "Review" },
];

type FormSnapshot = {
  tier: AltaCardTierCode;
  companyId: string;
  requestedLimit: string;
  purpose: string;
  paymentAccountId: string;
  expectedSpend: string;
  employeeCards: boolean;
  acknowledged: boolean;
};

function phaseForStep(stepId: WizardStepId): BankActionPhase {
  return stepId === "review" ? "review" : "details";
}

export function AltaCardApplyWorkflow({
  open,
  onOpenChange,
  onDone,
  context,
  kind,
  defaultCompanyId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
  context: ApplyContext;
  kind: "personal" | "business";
  defaultCompanyId?: string;
}) {
  const router = useRouter();
  const submitPersonal = useServerFn(submitPersonalAltaCardApplication);
  const submitBusiness = useServerFn(submitBusinessAltaCardApplication);
  const consentAction = useOptionalProductConsentAction();

  const steps = kind === "business" ? BUSINESS_STEPS : PERSONAL_STEPS;
  const eligibleCompanies = context.businessCompanies.filter(
    (c) => !c.hasCard && !c.hasPendingApplication,
  );
  const canApplyPersonal = !context.personalCard && !context.pendingPersonalApplication;
  const canApplyBusiness = eligibleCompanies.length > 0;
  const canSubmit = kind === "personal" ? canApplyPersonal : canApplyBusiness;

  const initialCompanyId =
    defaultCompanyId && eligibleCompanies.some((c) => c.id === defaultCompanyId)
      ? defaultCompanyId
      : (eligibleCompanies[0]?.id ?? "");

  const initialFormRef = useRef<FormSnapshot>({
    tier: "white",
    companyId: initialCompanyId,
    requestedLimit: "",
    purpose: "",
    paymentAccountId: context.paymentSourceAccounts[0]?.id ?? "",
    expectedSpend: "",
    employeeCards: false,
    acknowledged: false,
  });

  const [tier, setTier] = useState<AltaCardTierCode>("white");
  const [companyId, setCompanyId] = useState(initialCompanyId);
  const [requestedLimit, setRequestedLimit] = useState("");
  const [purpose, setPurpose] = useState("");
  const [paymentAccountId, setPaymentAccountId] = useState(
    context.paymentSourceAccounts[0]?.id ?? "",
  );
  const [expectedSpend, setExpectedSpend] = useState("");
  const [employeeCards, setEmployeeCards] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  const [wizardStep, setWizardStep] = useState(0);
  const [phase, setPhase] = useState<BankActionPhase>("details");
  const [stepError, setStepError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const submittingLockRef = useRef(false);

  const currentStep = steps[Math.min(wizardStep, steps.length - 1)];
  const currentStepId = currentStep.id;

  const dirty = useMemo(() => {
    const initial = initialFormRef.current;
    return (
      tier !== initial.tier ||
      companyId !== initial.companyId ||
      requestedLimit !== initial.requestedLimit ||
      purpose !== initial.purpose ||
      paymentAccountId !== initial.paymentAccountId ||
      expectedSpend !== initial.expectedSpend ||
      employeeCards !== initial.employeeCards ||
      acknowledged !== initial.acknowledged
    );
  }, [
    tier,
    companyId,
    requestedLimit,
    purpose,
    paymentAccountId,
    expectedSpend,
    employeeCards,
    acknowledged,
  ]);

  const resetWorkflow = useCallback(() => {
    const initial = initialFormRef.current;
    setTier(initial.tier);
    setCompanyId(initial.companyId);
    setRequestedLimit(initial.requestedLimit);
    setPurpose(initial.purpose);
    setPaymentAccountId(initial.paymentAccountId);
    setExpectedSpend(initial.expectedSpend);
    setEmployeeCards(initial.employeeCards);
    setAcknowledged(initial.acknowledged);
    setWizardStep(0);
    setPhase("details");
    setStepError(null);
    setSubmitError(null);
    setSubmittedId(null);
    submittingLockRef.current = false;
  }, []);

  useEffect(() => {
    if (!open) {
      resetWorkflow();
      return;
    }
    const seedCompany =
      defaultCompanyId && eligibleCompanies.some((c) => c.id === defaultCompanyId)
        ? defaultCompanyId
        : (eligibleCompanies[0]?.id ?? "");
    initialFormRef.current = {
      tier: "white",
      companyId: seedCompany,
      requestedLimit: "",
      purpose: "",
      paymentAccountId: context.paymentSourceAccounts[0]?.id ?? "",
      expectedSpend: "",
      employeeCards: false,
      acknowledged: false,
    };
    setTier("white");
    setCompanyId(seedCompany);
    setRequestedLimit("");
    setPurpose("");
    setPaymentAccountId(context.paymentSourceAccounts[0]?.id ?? "");
    setExpectedSpend("");
    setEmployeeCards(false);
    setAcknowledged(false);
    setWizardStep(0);
    setPhase("details");
    setStepError(null);
    setSubmitError(null);
    setSubmittedId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once when opened
  }, [open, kind, defaultCompanyId]);

  const validateCurrentStep = useCallback((): boolean => {
    if (currentStepId === "company") {
      if (!companyId) {
        setStepError("Select a company.");
        return false;
      }
    }
    if (currentStepId === "terms") {
      if (!acknowledged) {
        setStepError("Please acknowledge the application terms.");
        return false;
      }
    }
    setStepError(null);
    return true;
  }, [currentStepId, companyId, acknowledged]);

  const goNext = useCallback(() => {
    if (!validateCurrentStep()) return;
    const next = Math.min(wizardStep + 1, steps.length - 1);
    setWizardStep(next);
    setPhase(phaseForStep(steps[next].id));
    setStepError(null);
  }, [validateCurrentStep, wizardStep, steps]);

  const goBack = useCallback(() => {
    if (phase === "error") {
      setPhase("review");
      setWizardStep(steps.length - 1);
      return;
    }
    if (wizardStep <= 0) return;
    const prev = wizardStep - 1;
    setWizardStep(prev);
    setPhase(phaseForStep(steps[prev].id));
    setStepError(null);
  }, [phase, wizardStep, steps]);

  const handleSubmit = useCallback(async () => {
    if (!acknowledged) {
      setStepError("Please acknowledge the application terms.");
      return;
    }
    if (submittingLockRef.current || phase === "submitting") return;
    submittingLockRef.current = true;
    setPhase("submitting");
    setSubmitError(null);
    const startedAt = Date.now();

    try {
      const limit = requestedLimit.trim() ? Number(requestedLimit) : undefined;

      const submittedId = await executeWithProductConsentResume(async () => {
        if (consentAction) {
          await consentAction.requestConsent(["BANK", "ALTA_CARD"]);
        }

        if (shouldUseBankActionUiLabMock()) {
          return mockBankActionSubmission({
            kind: kind === "personal" ? "card_apply" : "biz_card_apply",
            amount: limit ?? 0,
          }).referenceCode;
        }

        if (kind === "personal") {
          const app = await submitPersonal({
            data: {
              requestedTier: tier,
              requestedLimit: limit,
              purpose: purpose.trim() || undefined,
              paymentSourceAccountId: paymentAccountId || undefined,
              acknowledged: true,
            },
          });
          return app.id;
        }

        if (!companyId) {
          throw new Error("Select a company");
        }
        const app = await submitBusiness({
          data: {
            companyId,
            requestedTier: tier,
            requestedLimit: limit,
            purpose: purpose.trim() || undefined,
            expectedMonthlySpend: expectedSpend.trim() ? Number(expectedSpend) : undefined,
            employeeCardsNeeded: employeeCards,
            acknowledged: true,
          },
        });
        return app.id;
      }, consentAction);

      await waitBankProcessMin(startedAt, BANK_PROCESS_MOTION.minProcessingMs);
      setSubmittedId(submittedId);
      setPhase("success");
    } catch (err) {
      setSubmitError(formatCustomerActionError(err, "card_apply"));
      setPhase("error");
    } finally {
      submittingLockRef.current = false;
    }
  }, [
    acknowledged,
    phase,
    requestedLimit,
    kind,
    consentAction,
    submitPersonal,
    tier,
    purpose,
    paymentAccountId,
    submitBusiness,
    companyId,
    expectedSpend,
    employeeCards,
  ]);

  const finish = useCallback(() => {
    if (onDone) {
      onDone();
      return;
    }
    onOpenChange(false);
  }, [onDone, onOpenChange]);

  const viewApplication = useCallback(() => {
    if (!submittedId || shouldUseBankActionUiLabMock()) {
      finish();
      return;
    }
    if (kind === "personal") {
      void router.navigate({
        to: "/bank/alta-card/applications/$applicationId",
        params: { applicationId: submittedId },
      });
    } else {
      void router.navigate({
        to: "/bank/alta-card/business/applications/$applicationId",
        params: { applicationId: submittedId },
      });
    }
  }, [submittedId, kind, router, finish]);

  const title = useMemo(() => {
    if (phase === "success") return "Application submitted";
    if (phase === "error") return "Could not submit";
    if (phase === "submitting") {
      return kind === "personal" ? "Apply for Alta Card" : "Apply for business Alta Card";
    }
    if (currentStepId === "company") return "Company";
    if (currentStepId === "tier") return "Card tier";
    if (currentStepId === "terms") return "Requested terms";
    if (currentStepId === "review") return "Review application";
    return kind === "personal" ? "Apply for Alta Card" : "Apply for business Alta Card";
  }, [phase, currentStepId, kind]);

  const description = useMemo(() => {
    if (phase === "success" || phase === "error" || phase === "submitting") return undefined;
    if (currentStepId === "company") return "Choose which company this business card is for.";
    if (currentStepId === "tier") return "Select a tier and describe expected usage.";
    if (currentStepId === "terms") return "Optional limit, payment account, and acknowledgements.";
    if (currentStepId === "review") return "Confirm your details before submitting.";
    return undefined;
  }, [phase, currentStepId]);

  const footer = useMemo(() => {
    if (!canSubmit) return null;
    if (phase === "submitting" || phase === "success" || phase === "error") return null;
    if (currentStepId === "review") {
      return (
        <BankActionFooter>
          <BankActionPrimaryButton onClick={() => void handleSubmit()}>
            Submit application
          </BankActionPrimaryButton>
        </BankActionFooter>
      );
    }
    return (
      <BankActionFooter>
        <BankActionPrimaryButton onClick={goNext}>Continue</BankActionPrimaryButton>
      </BankActionFooter>
    );
  }, [canSubmit, phase, currentStepId, handleSubmit, goNext]);

  const selectedCompany = eligibleCompanies.find((c) => c.id === companyId);
  const defaultLimit = ALTA_CARD_DEFAULT_LIMITS[tier];
  const paymentAccount = context.paymentSourceAccounts.find((a) => a.id === paymentAccountId);

  let body: ReactNode;

  if (!canSubmit) {
    body = (
      <div className="space-y-4">
        <p className="font-serif text-[18px]">No eligible Alta Card applications</p>
        <p className="text-[14px] text-muted-foreground">
          {kind === "personal"
            ? context.personalCard
              ? "You already have a personal Alta Card."
              : "You already have a personal Alta Card application in progress."
            : "Every company you manage already has a business Alta Card or an open application."}
        </p>
        {kind === "personal" && context.pendingPersonalApplication ? (
          <Link
            to="/bank/alta-card/applications/$applicationId"
            params={{ applicationId: context.pendingPersonalApplication.id }}
            className="inline-flex rounded-md border border-border px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em]"
          >
            View personal application
          </Link>
        ) : kind === "personal" && context.personalCard ? (
          <Link
            to="/bank/alta-card"
            className="inline-flex rounded-md border border-border px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em]"
          >
            View personal card
          </Link>
        ) : kind === "business" ? (
          <Link
            to="/bank/alta-card/business"
            className="inline-flex rounded-md border border-border px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em]"
          >
            Back to business Alta Card
          </Link>
        ) : null}
      </div>
    );
  } else if (phase === "submitting") {
    body = <BankActionProcessing label="Submitting application…" variant="progress" />;
  } else if (phase === "success") {
    body = (
      <BankActionSuccess
        kind="pending"
        title="Application submitted"
        liveMessage="Your Alta Card application was submitted for review."
        onDone={finish}
        onMakeAnother={shouldUseBankActionUiLabMock() ? undefined : viewApplication}
        makeAnotherLabel="View application"
        summary={[
          { label: "Tier", value: ALTA_CARD_TIER_LABELS[tier] },
          ...(kind === "business" && selectedCompany
            ? [{ label: "Company", value: selectedCompany.name }]
            : []),
          ...(requestedLimit.trim()
            ? [{ label: "Requested limit", value: requestedLimit, mono: true }]
            : []),
        ]}
      >
        <p>
          Alta will review your request. A Secure Deal Room opens for any follow-up questions or
          documents we need.
        </p>
      </BankActionSuccess>
    );
  } else if (phase === "error") {
    body = (
      <BankProcessError
        message={submitError ?? "Your Alta Card application could not be submitted."}
        onEdit={() => {
          setPhase("details");
          setWizardStep(steps.findIndex((s) => s.id === "terms"));
        }}
        onRetry={() => {
          setPhase("review");
          setWizardStep(steps.length - 1);
        }}
        editLabel="Edit details"
        retryLabel="Back to review"
      />
    );
  } else {
    body = (
      <div className="space-y-5">
        <BankActionProgress
          step={wizardStep + 1}
          total={steps.length}
          label={`Step ${wizardStep + 1} of ${steps.length} · ${currentStep.shortLabel}`}
        />

        {currentStepId === "company" ? (
          <label className="block space-y-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Company
            </span>
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-[14px] min-h-11"
            >
              <option value="">Select company…</option>
              {eligibleCompanies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {currentStepId === "tier" ? (
          <div className="space-y-4">
            <div className="mx-auto w-full max-w-[240px]">
              <AltaCardVisual tier={tier} cardHolder="Applicant" responsive />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {ALTA_CARD_TIER_ORDER.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTier(t)}
                  className={cn(
                    "rounded-lg border p-3 text-left",
                    tier === t ? "border-gold/50 bg-gold/5" : "border-border bg-surface-1",
                  )}
                >
                  <p className="font-serif text-[16px]">{ALTA_CARD_TIER_LABELS[t]}</p>
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    {ALTA_CARD_TIER_CONFIG[t].description}
                  </p>
                  <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                    {ALTA_CARD_TIER_CONFIG[t].defaultCreditLimit != null
                      ? `Typical line ${ALTA_CARD_TIER_CONFIG[t].defaultCreditLimit.toLocaleString()}`
                      : "Negotiated limit & rate"}
                    {ALTA_CARD_TIER_CONFIG[t].defaultInterestRateApr != null
                      ? ` · ${ALTA_CARD_TIER_CONFIG[t].defaultInterestRateApr}% APR`
                      : ""}
                  </p>
                </button>
              ))}
            </div>
            <label className="block space-y-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Intended use / notes
              </span>
              <textarea
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-[14px]"
              />
            </label>
            {kind === "business" ? (
              <>
                <label className="block space-y-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    Expected monthly spend (optional)
                  </span>
                  <input
                    type="number"
                    value={expectedSpend}
                    onChange={(e) => setExpectedSpend(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-[14px] min-h-11"
                  />
                </label>
                <label className="flex items-center gap-2 text-[13px]">
                  <input
                    type="checkbox"
                    checked={employeeCards}
                    onChange={(e) => setEmployeeCards(e.target.checked)}
                  />
                  Employee cards needed
                </label>
              </>
            ) : null}
          </div>
        ) : null}

        {currentStepId === "terms" ? (
          <div className="space-y-4">
            <label className="block space-y-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Requested limit (optional)
              </span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={requestedLimit}
                onChange={(e) => setRequestedLimit(e.target.value)}
                placeholder={defaultLimit != null ? String(defaultLimit) : "Negotiable"}
                className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-[14px] min-h-11"
              />
            </label>
            {kind === "personal" && context.paymentSourceAccounts.length > 0 ? (
              <label className="block space-y-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Preferred payment source (optional)
                </span>
                <select
                  value={paymentAccountId}
                  onChange={(e) => setPaymentAccountId(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-[14px] min-h-11"
                >
                  <option value="">None selected</option>
                  {context.paymentSourceAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.accountName} · {a.accountNumber}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="flex items-start gap-2 text-[13px]">
              <Checkbox
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
              />
              <span>
                I understand that Alta Card is a revolving credit product subject to approval.
              </span>
            </label>
          </div>
        ) : null}

        {currentStepId === "review" ? (
          <dl className="space-y-3 border-y border-border/60 py-4 text-[13px]">
            {kind === "business" ? (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Company</dt>
                <dd className="text-right font-medium">{selectedCompany?.name ?? "—"}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Tier</dt>
              <dd className="text-right font-medium">{ALTA_CARD_TIER_LABELS[tier]}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Requested limit</dt>
              <dd className="text-right font-mono">
                {requestedLimit.trim() || (defaultLimit != null ? `Typical ${defaultLimit}` : "Negotiable")}
              </dd>
            </div>
            {purpose.trim() ? (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Intended use</dt>
                <dd className="max-w-[240px] text-right">{purpose.trim()}</dd>
              </div>
            ) : null}
            {kind === "personal" && paymentAccount ? (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Payment source</dt>
                <dd className="text-right">
                  {paymentAccount.accountName}
                  <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">
                    {paymentAccount.accountNumber}
                  </span>
                </dd>
              </div>
            ) : null}
            {kind === "business" ? (
              <>
                {expectedSpend.trim() ? (
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Expected monthly spend</dt>
                    <dd className="text-right font-mono">{expectedSpend}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Employee cards</dt>
                  <dd className="text-right">{employeeCards ? "Requested" : "Not requested"}</dd>
                </div>
              </>
            ) : null}
          </dl>
        ) : null}

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
      phase={canSubmit ? phase : "details"}
      dirty={canSubmit && dirty && phase !== "success" && phase !== "submitting"}
      pendingSuccess={phase === "success"}
      size="lg"
      showBack={
        canSubmit &&
        (phase === "details" || phase === "review" || phase === "error") &&
        wizardStep > 0
      }
      onBack={goBack}
      footer={footer}
      scrollResetKey={`${wizardStep}:${phase}`}
    >
      {body}
    </ResponsiveBankAction>
  );
}
