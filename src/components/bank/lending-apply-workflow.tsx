"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Florin } from "@/components/ui/florin";
import { ResponsiveBankAction } from "@/components/bank/actions/responsive-bank-action";
import {
  BankActionFooter,
  BankActionPrimaryButton,
  BankActionProcessing,
  BankActionProgress,
  BankActionSuccess,
} from "@/components/bank/actions/bank-action-chrome";
import { BankProcessError } from "@/components/bank/actions/bank-process-ui";
import type { BankActionPhase } from "@/lib/bank/bank-action-flow";
import { formatCustomerActionError } from "@/lib/bank/bank-action-errors";
import { BANK_PROCESS_MOTION, waitBankProcessMin } from "@/lib/bank/bank-process";
import { florin } from "@/lib/bank/api";
import { submitLoanApplication } from "@/lib/bank/lending.functions";
import { LOAN_APPLICATION_WHAT_HAPPENS_NEXT } from "@/lib/bank/lending-application-status-copy";
import type {
  CompanyLendingOption,
  LendingAccountOption,
  LoanApplicationRow,
  LoanProductTypeCode,
} from "@/lib/bank/lending-types";
import {
  LOAN_PRODUCT_LABELS,
  LOAN_PRODUCT_REPAYMENT_CARD,
  LOAN_PRODUCT_REPAYMENT_GUIDANCE,
  computeLoanTermEstimate,
  loanTermMonthsForProduct,
  loanTermMonthsHelp,
} from "@/lib/bank/lending-types";
import {
  LENDING_WIZARD_STEPS,
  isLendingApplyFormDirty,
  validateLendingWizardStep,
  type LendingWizardStepId,
} from "@/lib/bank/lending-wizard-validation";
import { cn } from "@/lib/utils";

const inputClass =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-none focus-visible:outline-none focus-visible:border-gold/60 focus-visible:ring-0 focus-visible:shadow-none min-h-11";
const labelClass =
  "font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground";

function parseServerError(err: unknown): string {
  if (err instanceof Error && err.message === "FORBIDDEN") {
    return "You do not have permission to submit this application.";
  }
  return formatCustomerActionError(err, "lending_apply");
}

function stepIndexForId(id: LendingWizardStepId): number {
  return LENDING_WIZARD_STEPS.findIndex((step) => step.id === id);
}

function stepIdForIndex(index: number): LendingWizardStepId {
  return LENDING_WIZARD_STEPS[Math.min(Math.max(index, 0), LENDING_WIZARD_STEPS.length - 1)].id;
}

function phaseForStepIndex(index: number): BankActionPhase {
  return index >= LENDING_WIZARD_STEPS.length - 1 ? "review" : "details";
}

export function LendingApplyWorkflow({
  open,
  onOpenChange,
  onDone,
  accounts,
  companies,
  initialProduct,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
  accounts: LendingAccountOption[];
  companies: CompanyLendingOption[];
  initialProduct?: LoanProductTypeCode;
}) {
  const router = useRouter();
  const submit = useServerFn(submitLoanApplication);

  const productOptions = useMemo<LoanProductTypeCode[]>(
    () => ["personal_credit_line", "business_credit_line"],
    [],
  );

  const seededProduct =
    initialProduct && productOptions.includes(initialProduct) ? initialProduct : productOptions[0];
  const seededTermMonths = String(loanTermMonthsForProduct(seededProduct).defaultMonths);

  const initialFormRef = useRef({
    productType: seededProduct,
    companyId: companies[0]?.companyId ?? "",
    linkedBankAccountId: "",
    requestedAmount: "",
    termMonths: seededTermMonths,
    purpose: "",
    repaymentPlan: "",
    collateralDescription: "",
    notes: "",
  });

  const [productType, setProductType] = useState<LoanProductTypeCode>(seededProduct);
  const [companyId, setCompanyId] = useState(companies[0]?.companyId ?? "");
  const [linkedBankAccountId, setLinkedBankAccountId] = useState("");
  const [requestedAmount, setRequestedAmount] = useState("");
  const [termMonths, setTermMonths] = useState(seededTermMonths);
  const [purpose, setPurpose] = useState("");
  const [repaymentPlan, setRepaymentPlan] = useState("");
  const [collateralDescription, setCollateralDescription] = useState("");
  const [notes, setNotes] = useState("");

  const [wizardStep, setWizardStep] = useState(0);
  const [phase, setPhase] = useState<BankActionPhase>("details");
  const [stepError, setStepError] = useState<{ field: string; message: string } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<LoanApplicationRow | null>(null);
  const submittingLockRef = useRef(false);

  const termLimits = loanTermMonthsForProduct(productType);

  const clearStepErrorForField = useCallback((field: string) => {
    setStepError((prev) => (prev?.field === field ? null : prev));
  }, []);

  const formValues = useMemo(
    () => ({
      productType,
      companyId,
      linkedBankAccountId,
      requestedAmount,
      termMonths,
      purpose,
      repaymentPlan,
      collateralDescription,
      notes,
    }),
    [
      productType,
      companyId,
      linkedBankAccountId,
      requestedAmount,
      termMonths,
      purpose,
      repaymentPlan,
      collateralDescription,
      notes,
    ],
  );

  const filteredAccounts = useMemo(() => {
    if (productType === "business_credit_line") {
      return accounts.filter((a) => a.companyId === companyId);
    }
    return accounts.filter((a) => !a.companyId);
  }, [accounts, companyId, productType]);

  const selectedCompany = companies.find((c) => c.companyId === companyId);
  const effectiveLinkedAccountId = linkedBankAccountId || filteredAccounts[0]?.id || "";

  const principalNum = Number(requestedAmount);
  const monthsNum = Number(termMonths);
  const termEstimate = useMemo(() => {
    if (!Number.isFinite(principalNum) || principalNum <= 0) return null;
    if (!Number.isInteger(monthsNum) || monthsNum < termLimits.min || monthsNum > termLimits.max) {
      return null;
    }
    return computeLoanTermEstimate(productType, principalNum, monthsNum);
  }, [productType, principalNum, monthsNum, termLimits.max, termLimits.min]);

  const indicativeRate =
    productType === "personal_credit_line"
      ? "7.5% monthly"
      : productType === "business_credit_line"
        ? "6% monthly"
        : "Negotiated";

  const dirty = isLendingApplyFormDirty({
    values: formValues,
    initial: initialFormRef.current,
  });

  const currentStepId = stepIdForIndex(wizardStep);
  const progressLabel = LENDING_WIZARD_STEPS[wizardStep]?.shortLabel ?? "Apply";

  const resetWorkflow = useCallback(() => {
    const initial = initialFormRef.current;
    setProductType(initial.productType);
    setCompanyId(initial.companyId);
    setLinkedBankAccountId(initial.linkedBankAccountId);
    setRequestedAmount(initial.requestedAmount);
    setTermMonths(initial.termMonths);
    setPurpose(initial.purpose);
    setRepaymentPlan(initial.repaymentPlan);
    setCollateralDescription(initial.collateralDescription);
    setNotes(initial.notes);
    setWizardStep(0);
    setPhase("details");
    setStepError(null);
    setSubmitError(null);
    setSubmitted(null);
    submittingLockRef.current = false;
  }, []);

  useEffect(() => {
    if (open) return;
    resetWorkflow();
  }, [open, resetWorkflow]);

  useEffect(() => {
    if (!open) return;
    const defaultTermMonths = String(loanTermMonthsForProduct(seededProduct).defaultMonths);
    initialFormRef.current = {
      productType: seededProduct,
      companyId: companies[0]?.companyId ?? "",
      linkedBankAccountId: "",
      requestedAmount: "",
      termMonths: defaultTermMonths,
      purpose: "",
      repaymentPlan: "",
      collateralDescription: "",
      notes: "",
    };
    setProductType(seededProduct);
    setCompanyId(companies[0]?.companyId ?? "");
    setLinkedBankAccountId("");
    setRequestedAmount("");
    setTermMonths(defaultTermMonths);
    setPurpose("");
    setRepaymentPlan("");
    setCollateralDescription("");
    setNotes("");
    setWizardStep(0);
    setPhase("details");
    setStepError(null);
    setSubmitError(null);
    setSubmitted(null);
  }, [open, seededProduct, companies]);

  const handleProductChange = useCallback(
    (value: LoanProductTypeCode) => {
      setProductType(value);
      setTermMonths(String(loanTermMonthsForProduct(value).defaultMonths));
      clearStepErrorForField("productType");
      clearStepErrorForField("companyId");
    },
    [clearStepErrorForField],
  );

  const handleCompanyChange = useCallback(
    (value: string) => {
      setCompanyId(value);
      clearStepErrorForField("companyId");
    },
    [clearStepErrorForField],
  );

  const handleRequestedAmountChange = useCallback(
    (value: string) => {
      setRequestedAmount(value);
      clearStepErrorForField("requestedAmount");
    },
    [clearStepErrorForField],
  );

  const handleTermMonthsChange = useCallback(
    (value: string) => {
      setTermMonths(value);
      clearStepErrorForField("termMonths");
    },
    [clearStepErrorForField],
  );

  const handleLinkedAccountChange = useCallback(
    (value: string) => {
      setLinkedBankAccountId(value);
      clearStepErrorForField("linkedBankAccountId");
    },
    [clearStepErrorForField],
  );

  const handlePurposeChange = useCallback(
    (value: string) => {
      setPurpose(value);
      clearStepErrorForField("purpose");
    },
    [clearStepErrorForField],
  );

  const handleRepaymentPlanChange = useCallback(
    (value: string) => {
      setRepaymentPlan(value);
      clearStepErrorForField("repaymentPlan");
    },
    [clearStepErrorForField],
  );

  const validateCurrentStep = useCallback((): boolean => {
    const stepId = stepIdForIndex(wizardStep);
    if (stepId === "review") return true;
    const result = validateLendingWizardStep(stepId, formValues, {
      companiesCount: companies.length,
      filteredAccountsCount: filteredAccounts.length,
    });
    if (!result.valid) {
      setStepError({ field: result.field, message: result.message });
      return false;
    }
    setStepError(null);
    return true;
  }, [wizardStep, formValues, companies.length, filteredAccounts.length]);

  const goNext = useCallback(() => {
    if (!validateCurrentStep()) return;
    const next = wizardStep + 1;
    setWizardStep(next);
    setPhase(phaseForStepIndex(next));
    setStepError(null);
  }, [validateCurrentStep, wizardStep]);

  const goBack = useCallback(() => {
    if (phase === "error") {
      setPhase("review");
      setWizardStep(LENDING_WIZARD_STEPS.length - 1);
      return;
    }
    if (wizardStep <= 0) return;
    const prev = wizardStep - 1;
    setWizardStep(prev);
    setPhase(phaseForStepIndex(prev));
    setStepError(null);
  }, [phase, wizardStep]);

  const handleSubmit = useCallback(async () => {
    if (submittingLockRef.current || phase === "submitting") return;
    submittingLockRef.current = true;
    setPhase("submitting");
    setSubmitError(null);
    const startedAt = Date.now();

    try {
      const result = await submit({
        data: {
          productType,
          requestedAmount: Number(requestedAmount),
          termMonths: Number(termMonths),
          linkedBankAccountId: effectiveLinkedAccountId || undefined,
          companyId: productType === "business_credit_line" ? companyId : undefined,
          purpose,
          repaymentPlan,
          collateralDescription: collateralDescription || undefined,
          notes: notes || undefined,
        },
      });
      await waitBankProcessMin(startedAt, BANK_PROCESS_MOTION.minProcessingMs);
      setSubmitted(result);
      setPhase("success");
    } catch (err) {
      setSubmitError(parseServerError(err));
      setPhase("error");
    } finally {
      submittingLockRef.current = false;
    }
  }, [
    phase,
    submit,
    productType,
    requestedAmount,
    termMonths,
    effectiveLinkedAccountId,
    companyId,
    purpose,
    repaymentPlan,
    collateralDescription,
    notes,
  ]);

  const title = useMemo(() => {
    if (phase === "success") return "Application submitted";
    if (phase === "error") return "Could not submit";
    if (phase === "submitting") return "Apply for credit";
    if (currentStepId === "review") return "Review application";
    if (currentStepId === "amount") return "Amount & account";
    if (currentStepId === "purpose") return "Purpose & repayment";
    return "Apply for credit";
  }, [phase, currentStepId]);

  const description = useMemo(() => {
    if (phase === "success" || phase === "error" || phase === "submitting") return undefined;
    if (currentStepId === "review") return "Confirm your details before submitting.";
    if (currentStepId === "amount") return "Enter the amount, term, and linked account.";
    if (currentStepId === "purpose") return "Describe how you'll use and repay the credit.";
    if (currentStepId === "product") return "Choose a credit product.";
    return undefined;
  }, [phase, currentStepId]);

  const footer = useMemo(() => {
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
        <BankActionPrimaryButton
          disabled={currentStepId === "product" && productType === "business_credit_line" && companies.length === 0}
          onClick={goNext}
        >
          Continue
        </BankActionPrimaryButton>
      </BankActionFooter>
    );
  }, [phase, currentStepId, productType, companies.length, goNext, handleSubmit]);

  let body: ReactNode;

  if (phase === "submitting") {
    body = <BankActionProcessing label="Submitting application…" variant="progress" />;
  } else if (phase === "success" && submitted) {
    body = (
      <BankActionSuccess
        kind="pending"
        title="Application submitted"
        liveMessage="Your lending application was submitted for review."
        onDone={onDone}
        onMakeAnother={() => {
          void router.navigate({
            to: "/bank/lending/applications/$applicationId/thread",
            params: { applicationId: submitted.id },
          });
        }}
        makeAnotherLabel="View application"
        summary={[
          { label: "Product", value: LOAN_PRODUCT_LABELS[productType] },
          { label: "Requested", value: florin(Number(requestedAmount)) },
          { label: "Term", value: `${termMonths} months`, mono: true },
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
        message={submitError ?? "Your lending application could not be submitted."}
        onEdit={() => {
          setPhase("details");
          setWizardStep(stepIndexForId("purpose"));
        }}
        onRetry={() => {
          setPhase("review");
          setWizardStep(LENDING_WIZARD_STEPS.length - 1);
        }}
        editLabel="Edit details"
        retryLabel="Back to review"
      />
    );
  } else if (currentStepId === "review") {
    body = (
      <div className="space-y-5">
        <WizardProgress step={wizardStep + 1} label={progressLabel} />
        <ApplicationSummary
          productLabel={LOAN_PRODUCT_LABELS[productType]}
          companyName={productType === "business_credit_line" ? selectedCompany?.companyName : null}
          linkedAccountLabel={
            filteredAccounts.find((a) => a.id === effectiveLinkedAccountId)?.label ?? null
          }
          principal={principalNum > 0 ? principalNum : null}
          termMonths={Number.isFinite(monthsNum) && monthsNum > 0 ? monthsNum : null}
          repaymentCadence={LOAN_PRODUCT_REPAYMENT_CARD[productType]}
          indicativeRate={indicativeRate}
          estimatedTotal={termEstimate?.totalOutstanding ?? null}
          estimatedInterest={termEstimate?.totalInterest ?? null}
          purpose={purpose.trim() || null}
          repaymentPlan={repaymentPlan.trim() || null}
          collateral={collateralDescription.trim() || null}
          notes={notes.trim() || null}
        />
      </div>
    );
  } else {
    body = (
      <div className="space-y-5">
        <WizardProgress step={wizardStep + 1} label={progressLabel} />
        {currentStepId === "product" ? (
          <ProductStep
            productType={productType}
            productOptions={productOptions}
            indicativeRate={indicativeRate}
            companies={companies}
            companyId={companyId}
            selectedCompany={selectedCompany}
            stepError={stepError}
            onProductChange={handleProductChange}
            onCompanyChange={handleCompanyChange}
          />
        ) : null}
        {currentStepId === "amount" ? (
          <AmountStep
            productType={productType}
            requestedAmount={requestedAmount}
            termMonths={termMonths}
            linkedBankAccountId={effectiveLinkedAccountId}
            filteredAccounts={filteredAccounts}
            stepError={stepError}
            onRequestedAmountChange={handleRequestedAmountChange}
            onTermMonthsChange={handleTermMonthsChange}
            onLinkedAccountChange={handleLinkedAccountChange}
          />
        ) : null}
        {currentStepId === "purpose" ? (
          <PurposeStep
            purpose={purpose}
            repaymentPlan={repaymentPlan}
            collateralDescription={collateralDescription}
            notes={notes}
            stepError={stepError}
            onPurposeChange={handlePurposeChange}
            onRepaymentPlanChange={handleRepaymentPlanChange}
            onCollateralChange={setCollateralDescription}
            onNotesChange={setNotes}
          />
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
      dirty={dirty}
      pendingSuccess={phase === "success"}
      size="lg"
      showBack={
        (phase === "details" || phase === "review" || phase === "error") && wizardStep > 0
      }
      onBack={goBack}
      footer={footer}
      scrollResetKey={`${wizardStep}:${phase}`}
    >
      {body}
    </ResponsiveBankAction>
  );
}

function WizardProgress({ step, label }: { step: number; label: string }) {
  return (
    <BankActionProgress
      step={step}
      total={LENDING_WIZARD_STEPS.length}
      label={`Step ${step} of ${LENDING_WIZARD_STEPS.length} · ${label}`}
    />
  );
}

function fieldErrorClass(field: string, stepError: { field: string; message: string } | null) {
  return stepError?.field === field ? "border-destructive/60" : undefined;
}

function StepError({ stepError, field }: { stepError: { field: string; message: string } | null; field: string }) {
  if (!stepError || stepError.field !== field) return null;
  return (
    <p className="mt-2 text-[12px] text-destructive" role="alert">
      {stepError.message}
    </p>
  );
}

function ProductStep({
  productType,
  productOptions,
  indicativeRate,
  companies,
  companyId,
  selectedCompany,
  stepError,
  onProductChange,
  onCompanyChange,
}: {
  productType: LoanProductTypeCode;
  productOptions: LoanProductTypeCode[];
  indicativeRate: string;
  companies: CompanyLendingOption[];
  companyId: string;
  selectedCompany: CompanyLendingOption | undefined;
  stepError: { field: string; message: string } | null;
  onProductChange: (value: LoanProductTypeCode) => void;
  onCompanyChange: (value: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <label className={labelClass}>Credit product</label>
        <Select value={productType} onValueChange={(v) => onProductChange(v as LoanProductTypeCode)}>
          <SelectTrigger className={cn("mt-2", fieldErrorClass("productType", stepError))}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {productOptions.map((code) => (
              <SelectItem key={code} value={code}>
                {LOAN_PRODUCT_LABELS[code]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="mt-2 text-[12px] text-muted-foreground">
          Indicative rate {indicativeRate} · {LOAN_PRODUCT_REPAYMENT_GUIDANCE[productType]}
        </p>
      </div>

      {productType === "business_credit_line" ? (
        <div>
          <label className={labelClass}>Company</label>
          {companies.length === 0 ? (
            <p className="mt-2 text-[13px] text-muted-foreground">
              A verified company with Owner, Executive, or Finance Manager access is required.
            </p>
          ) : (
            <Select value={companyId} onValueChange={onCompanyChange}>
              <SelectTrigger className={cn("mt-2", fieldErrorClass("companyId", stepError))}>
                <SelectValue placeholder="Select company" />
              </SelectTrigger>
              <SelectContent>
                {companies.map((c) => (
                  <SelectItem key={c.companyId} value={c.companyId}>
                    {c.companyName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <StepError stepError={stepError} field="companyId" />
          {selectedCompany && !selectedCompany.operatingAccountId ? (
            <p className="mt-2 text-[12px] text-amber-700 dark:text-amber-400">
              This company has no active operating account. Link a personal account below or open one first.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function AmountStep({
  productType,
  requestedAmount,
  termMonths,
  linkedBankAccountId,
  filteredAccounts,
  stepError,
  onRequestedAmountChange,
  onTermMonthsChange,
  onLinkedAccountChange,
}: {
  productType: LoanProductTypeCode;
  requestedAmount: string;
  termMonths: string;
  linkedBankAccountId: string;
  filteredAccounts: LendingAccountOption[];
  stepError: { field: string; message: string } | null;
  onRequestedAmountChange: (value: string) => void;
  onTermMonthsChange: (value: string) => void;
  onLinkedAccountChange: (value: string) => void;
}) {
  const { min, max } = loanTermMonthsForProduct(productType);

  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="requestedAmount">
            Requested amount (ƒ)
          </label>
          <input
            id="requestedAmount"
            type="number"
            min="1"
            step="0.01"
            className={cn(inputClass, fieldErrorClass("requestedAmount", stepError))}
            value={requestedAmount}
            onChange={(e) => onRequestedAmountChange(e.target.value)}
          />
          <StepError stepError={stepError} field="requestedAmount" />
        </div>
        <div>
          <label className={labelClass} htmlFor="termMonths">
            Term (months)
          </label>
          <input
            id="termMonths"
            type="number"
            min={min}
            max={max}
            step="1"
            className={cn(inputClass, fieldErrorClass("termMonths", stepError))}
            value={termMonths}
            onChange={(e) => onTermMonthsChange(e.target.value)}
          />
          <p className="mt-2 text-[12px] text-muted-foreground">{loanTermMonthsHelp(productType)}</p>
          <StepError stepError={stepError} field="termMonths" />
        </div>
      </div>

      <div>
        <label className={labelClass}>Linked Alta account</label>
        {filteredAccounts.length === 0 ? (
          <>
            <p className="mt-2 text-[13px] text-muted-foreground">
              Open an active Alta Bank account to link disbursement and servicing.
            </p>
            <StepError stepError={stepError} field="linkedBankAccountId" />
          </>
        ) : (
          <Select value={linkedBankAccountId || filteredAccounts[0]?.id} onValueChange={onLinkedAccountChange}>
            <SelectTrigger className={cn("mt-2", fieldErrorClass("linkedBankAccountId", stepError))}>
              <SelectValue placeholder="Select account" />
            </SelectTrigger>
            <SelectContent>
              {filteredAccounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.label} · {a.accountNumber}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}

function PurposeStep({
  purpose,
  repaymentPlan,
  collateralDescription,
  notes,
  stepError,
  onPurposeChange,
  onRepaymentPlanChange,
  onCollateralChange,
  onNotesChange,
}: {
  purpose: string;
  repaymentPlan: string;
  collateralDescription: string;
  notes: string;
  stepError: { field: string; message: string } | null;
  onPurposeChange: (value: string) => void;
  onRepaymentPlanChange: (value: string) => void;
  onCollateralChange: (value: string) => void;
  onNotesChange: (value: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <label className={labelClass} htmlFor="purpose">
          Purpose
        </label>
        <Textarea
          id="purpose"
          className={cn("mt-2 min-h-[96px]", fieldErrorClass("purpose", stepError))}
          value={purpose}
          onChange={(e) => onPurposeChange(e.target.value)}
          placeholder="Describe how the credit will be used."
        />
        <StepError stepError={stepError} field="purpose" />
      </div>
      <div>
        <label className={labelClass} htmlFor="repaymentPlan">
          Repayment plan
        </label>
        <Textarea
          id="repaymentPlan"
          className={cn("mt-2 min-h-[96px]", fieldErrorClass("repaymentPlan", stepError))}
          value={repaymentPlan}
          onChange={(e) => onRepaymentPlanChange(e.target.value)}
          placeholder="Outline expected cadence and sources."
        />
        <StepError stepError={stepError} field="repaymentPlan" />
      </div>
      <div>
        <label className={labelClass} htmlFor="collateral">
          Collateral or guarantees (optional)
        </label>
        <Textarea
          id="collateral"
          className="mt-2 min-h-[72px]"
          value={collateralDescription}
          onChange={(e) => onCollateralChange(e.target.value)}
          placeholder="Securities, guarantees, or other support."
        />
      </div>
      <div>
        <label className={labelClass} htmlFor="notes">
          Additional notes (optional)
        </label>
        <Textarea
          id="notes"
          className="mt-2 min-h-[72px]"
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Anything else Alta should know."
        />
      </div>
    </div>
  );
}

function ApplicationSummary({
  productLabel,
  companyName,
  linkedAccountLabel,
  principal,
  termMonths,
  repaymentCadence,
  indicativeRate,
  estimatedTotal,
  estimatedInterest,
  purpose,
  repaymentPlan,
  collateral,
  notes,
}: {
  productLabel: string;
  companyName?: string | null;
  linkedAccountLabel?: string | null;
  principal: number | null;
  termMonths: number | null;
  repaymentCadence: string;
  indicativeRate: string;
  estimatedTotal: number | null;
  estimatedInterest: number | null;
  purpose: string | null;
  repaymentPlan: string | null;
  collateral: string | null;
  notes: string | null;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface-1/80">
      <div className="border-b border-border px-4 py-3 sm:px-5 sm:py-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">Application summary</p>
        <h3 className="mt-2 font-serif text-[20px] leading-tight tracking-tight">{productLabel}</h3>
        <p className="mt-1 text-[12px] text-muted-foreground">Indicative · subject to review</p>
      </div>
      <dl className="divide-y divide-border/60">
        {companyName ? <SummaryRow label="Company">{companyName}</SummaryRow> : null}
        {linkedAccountLabel ? <SummaryRow label="Linked account">{linkedAccountLabel}</SummaryRow> : null}
        <SummaryRow label="Requested">
          {principal != null ? <Florin value={principal} fractionDigits={0} /> : <Dash />}
        </SummaryRow>
        <SummaryRow label="Term">
          {termMonths != null ? (
            <span className="tabular font-mono text-[13px]">{termMonths} mo</span>
          ) : (
            <Dash />
          )}
        </SummaryRow>
        <SummaryRow label="Rate">
          <span className="tabular font-mono text-[13px]">{indicativeRate}</span>
        </SummaryRow>
        <SummaryRow label="Typical term">
          <span className="text-[13px]">
            {repaymentCadence.replace(/^Typical term:\s*/i, "")}
          </span>
        </SummaryRow>
        <SummaryRow label="Est. total outstanding">
          {estimatedTotal != null ? (
            <Florin value={estimatedTotal} fractionDigits={0} />
          ) : (
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Negotiated
            </span>
          )}
        </SummaryRow>
        {estimatedInterest != null ? (
          <SummaryRow label="Est. interest">
            <Florin value={estimatedInterest} fractionDigits={0} />
          </SummaryRow>
        ) : null}
        {purpose ? <SummaryRow label="Purpose">{purpose}</SummaryRow> : null}
        {repaymentPlan ? <SummaryRow label="Repayment plan">{repaymentPlan}</SummaryRow> : null}
        {collateral ? <SummaryRow label="Collateral">{collateral}</SummaryRow> : null}
        {notes ? <SummaryRow label="Notes">{notes}</SummaryRow> : null}
      </dl>
      <div className="border-t border-border px-4 py-3 sm:px-5 sm:py-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          What happens next
        </p>
        <ol className="mt-3 space-y-2 text-[12px] text-muted-foreground">
          {LOAN_APPLICATION_WHAT_HAPPENS_NEXT.map((step, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-[2px] inline-block size-1.5 shrink-0 rounded-full bg-gold/70" />
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function SummaryRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 px-4 py-3 sm:px-5">
      <dt className="shrink-0 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </dt>
      <dd className="min-w-0 text-right text-[13px]">{children}</dd>
    </div>
  );
}

function Dash() {
  return <span className="text-muted-foreground/70">—</span>;
}
