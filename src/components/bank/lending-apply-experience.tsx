import { useEffect, useMemo, useRef, useState } from "react";
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
import { florin } from "@/lib/bank/api";
import { submitLoanApplication } from "@/lib/bank/lending.functions";
import type {
  CompanyLendingOption,
  LendingAccountOption,
  LoanProductTypeCode,
} from "@/lib/bank/lending-types";
import {
  LOAN_PRODUCT_LABELS,
  LOAN_PRODUCT_REPAYMENT_TERMS,
  LOAN_TERM_MONTHS_MAX,
  LOAN_TERM_MONTHS_MIN,
  computeLoanTermEstimate,
} from "@/lib/bank/lending-types";
import { useCurrentUser } from "@/hooks/use-current-user";
import { isPrivateClient } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";

const inputClass =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold/40";
const labelClass =
  "font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground";

function parseServerError(err: unknown): string {
  const message = err instanceof Error ? err.message : "Request failed";
  if (message.startsWith("BAD_REQUEST:")) return message.slice("BAD_REQUEST:".length);
  if (message === "FORBIDDEN") return "You do not have permission to submit this application.";
  return message;
}

const STEPS = [
  { id: "product", label: "Product" },
  { id: "amount", label: "Amount & term" },
  { id: "purpose", label: "Purpose" },
  { id: "notes", label: "Notes" },
] as const;
type StepId = (typeof STEPS)[number]["id"];

export function LendingApplyExperience({
  accounts,
  companies,
  initialProduct,
}: {
  accounts: LendingAccountOption[];
  companies: CompanyLendingOption[];
  initialProduct?: LoanProductTypeCode;
}) {
  const user = useCurrentUser();
  const router = useRouter();
  const submit = useServerFn(submitLoanApplication);

  const productOptions = useMemo(() => {
    const options: LoanProductTypeCode[] = ["personal_credit_line", "business_credit_line"];
    if (user && isPrivateClient(user)) options.push("private_liquidity_line");
    return options;
  }, [user]);

  const [productType, setProductType] = useState<LoanProductTypeCode>(
    initialProduct && productOptions.includes(initialProduct) ? initialProduct : productOptions[0],
  );
  const [companyId, setCompanyId] = useState(companies[0]?.companyId ?? "");
  const [linkedBankAccountId, setLinkedBankAccountId] = useState("");
  const [requestedAmount, setRequestedAmount] = useState("");
  const [termMonths, setTermMonths] = useState("12");
  const [purpose, setPurpose] = useState("");
  const [repaymentPlan, setRepaymentPlan] = useState("");
  const [collateralDescription, setCollateralDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredAccounts = useMemo(() => {
    if (productType === "business_credit_line") {
      return accounts.filter((a) => a.companyId === companyId);
    }
    return accounts.filter((a) => !a.companyId);
  }, [accounts, companyId, productType]);

  const selectedCompany = companies.find((c) => c.companyId === companyId);

  const principalNum = Number(requestedAmount);
  const monthsNum = Number(termMonths);
  const termEstimate = useMemo(() => {
    if (!Number.isFinite(principalNum) || principalNum <= 0) return null;
    if (!Number.isInteger(monthsNum) || monthsNum < LOAN_TERM_MONTHS_MIN || monthsNum > LOAN_TERM_MONTHS_MAX) {
      return null;
    }
    return computeLoanTermEstimate(productType, principalNum, monthsNum);
  }, [productType, principalNum, monthsNum]);

  // Progress rail driven by IntersectionObserver on each fieldset.
  const sectionRefs = useRef<Record<StepId, HTMLElement | null>>({
    product: null,
    amount: null,
    purpose: null,
    notes: null,
  });
  const [activeStep, setActiveStep] = useState<StepId>("product");

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => (a.target as HTMLElement).offsetTop - (b.target as HTMLElement).offsetTop);
        if (visible[0]) {
          const id = (visible[0].target as HTMLElement).dataset.step as StepId | undefined;
          if (id) setActiveStep(id);
        }
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: 0 },
    );
    Object.values(sectionRefs.current).forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await submit({
        data: {
          productType,
          requestedAmount: Number(requestedAmount),
          termMonths: Number(termMonths),
          linkedBankAccountId: linkedBankAccountId || filteredAccounts[0]?.id || undefined,
          companyId: productType === "business_credit_line" ? companyId : undefined,
          purpose,
          repaymentPlan,
          collateralDescription: collateralDescription || undefined,
          notes: notes || undefined,
        },
      });
      await router.navigate({
        to: "/bank/lending/applications/$applicationId/thread",
        params: { applicationId: result.id },
      });
    } catch (err) {
      setError(parseServerError(err));
    } finally {
      setSubmitting(false);
    }
  }

  const indicativeRate =
    productType === "personal_credit_line"
      ? "7.5% monthly"
      : productType === "business_credit_line"
        ? "6% monthly"
        : "Negotiated";

  const summary = (
    <ApplicationSummary
      productLabel={LOAN_PRODUCT_LABELS[productType]}
      principal={principalNum > 0 ? principalNum : null}
      termMonths={Number.isFinite(monthsNum) && monthsNum > 0 ? monthsNum : null}
      repaymentCadence={LOAN_PRODUCT_REPAYMENT_TERMS[productType]}
      indicativeRate={indicativeRate}
      estimatedTotal={termEstimate?.totalOutstanding ?? null}
      estimatedInterest={termEstimate?.totalInterest ?? null}
    />
  );

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-10">
      <div className="min-w-0">
        {/* Progress rail */}
        <nav
          aria-label="Application progress"
          className="sticky top-[64px] z-10 -mx-4 mb-8 border-b border-border bg-background/85 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-md sm:border sm:px-4"
        >
          <ol className="flex items-center gap-2 overflow-x-auto">
            {STEPS.map((step, i) => {
              const active = activeStep === step.id;
              const passed = STEPS.findIndex((s) => s.id === activeStep) > i;
              return (
                <li key={step.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const el = sectionRefs.current[step.id];
                      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    className={cn(
                      "inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors",
                      active
                        ? "border-gold/60 bg-gold/10 text-gold"
                        : passed
                          ? "border-border text-foreground"
                          : "border-border/60 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <span className="tabular">0{i + 1}</span>
                    <span>{step.label}</span>
                  </button>
                  {i < STEPS.length - 1 && (
                    <span aria-hidden className="h-px w-4 bg-border" />
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        <form onSubmit={(e) => void onSubmit(e)} className="space-y-12">
          <Fieldset
            ref={(el) => {
              sectionRefs.current.product = el;
            }}
            step="product"
            index="01"
            title="Product"
            description="Choose the facility that matches the obligation. Officer can re-scope later."
          >
            <div>
              <label className={labelClass}>Credit product</label>
              <Select
                value={productType}
                onValueChange={(v) => setProductType(v as LoanProductTypeCode)}
              >
                <SelectTrigger className="mt-2">
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
                Reviewed manually by Alta Bank credit operations. Indicative rate {indicativeRate} ·
                Repayment {LOAN_PRODUCT_REPAYMENT_TERMS[productType]}.
              </p>
            </div>

            {productType === "business_credit_line" && (
              <div>
                <label className={labelClass}>Company</label>
                {companies.length === 0 ? (
                  <p className="mt-2 text-[13px] text-muted-foreground">
                    A verified company with Owner, Executive, or Finance Manager access is required.
                  </p>
                ) : (
                  <Select value={companyId} onValueChange={setCompanyId}>
                    <SelectTrigger className="mt-2">
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
                {selectedCompany && !selectedCompany.operatingAccountId && (
                  <p className="mt-2 text-[12px] text-amber-700 dark:text-amber-400">
                    This company has no active operating account. Link an account below or open one first.
                  </p>
                )}
              </div>
            )}
          </Fieldset>

          <Fieldset
            ref={(el) => {
              sectionRefs.current.amount = el;
            }}
            step="amount"
            index="02"
            title="Amount & term"
            description="State the facility size and the window before full repayment."
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="requestedAmount">
                  Requested facility (ƒ)
                </label>
                <input
                  id="requestedAmount"
                  type="number"
                  min="1"
                  step="0.01"
                  required
                  className={inputClass}
                  value={requestedAmount}
                  onChange={(e) => setRequestedAmount(e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="termMonths">
                  Term (months)
                </label>
                <input
                  id="termMonths"
                  type="number"
                  min={LOAN_TERM_MONTHS_MIN}
                  max={LOAN_TERM_MONTHS_MAX}
                  step="1"
                  required
                  className={inputClass}
                  value={termMonths}
                  onChange={(e) => setTermMonths(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Linked Alta account</label>
              {filteredAccounts.length === 0 ? (
                <p className="mt-2 text-[13px] text-muted-foreground">
                  Open an active Alta Bank account to link disbursement and servicing.
                </p>
              ) : (
                <Select
                  value={linkedBankAccountId || filteredAccounts[0]?.id}
                  onValueChange={setLinkedBankAccountId}
                >
                  <SelectTrigger className="mt-2">
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

            {productType === "private_liquidity_line" &&
              monthsNum > 0 &&
              principalNum > 0 &&
              !termEstimate && (
                <p className="text-[12px] text-muted-foreground">
                  Total outstanding estimate is available after Alta Private sets your negotiated monthly rate at approval.
                </p>
              )}
          </Fieldset>

          <Fieldset
            ref={(el) => {
              sectionRefs.current.purpose = el;
            }}
            step="purpose"
            index="03"
            title="Purpose"
            description="What the facility funds and how it will be repaid. Plain prose — your officer reads every line."
          >
            <div>
              <label className={labelClass} htmlFor="purpose">
                Purpose
              </label>
              <Textarea
                id="purpose"
                required
                className="mt-2 min-h-[96px]"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="Describe how the facility will be used."
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="repaymentPlan">
                Repayment plan
              </label>
              <Textarea
                id="repaymentPlan"
                required
                className="mt-2 min-h-[96px]"
                value={repaymentPlan}
                onChange={(e) => setRepaymentPlan(e.target.value)}
                placeholder="Outline expected cadence and sources."
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="collateral">
                Collateral or guarantees (optional)
              </label>
              <Textarea
                id="collateral"
                className="mt-2 min-h-[72px]"
                value={collateralDescription}
                onChange={(e) => setCollateralDescription(e.target.value)}
                placeholder="Securities, guarantees, or other support — reviewed manually."
              />
            </div>
          </Fieldset>

          <Fieldset
            ref={(el) => {
              sectionRefs.current.notes = el;
            }}
            step="notes"
            index="04"
            title="Notes for the officer"
            description="Anything else the desk should know before they call you back."
          >
            <div>
              <label className={labelClass} htmlFor="notes">
                Additional notes (optional)
              </label>
              <Textarea
                id="notes"
                className="mt-2 min-h-[96px]"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </Fieldset>

          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-[13px] text-destructive">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
            <p className="max-w-md text-[12px] text-muted-foreground">
              Reviewed manually by Alta Bank credit operations · typical response &lt; 4h on desk hours.
            </p>
            <button
              type="submit"
              disabled={submitting || (productType === "business_credit_line" && companies.length === 0)}
              className="rounded-md bg-foreground px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.16em] text-background hover:bg-foreground/90 disabled:opacity-50"
            >
              {submitting ? "Submitting…" : "Submit application"}
            </button>
          </div>
        </form>
      </div>

      {/* Desktop sticky summary */}
      <aside className="hidden lg:block">
        <div className="sticky top-24">{summary}</div>
      </aside>

      {/* Mobile bottom sheet summary */}
      <details className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur lg:hidden">
        <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Application summary
            </p>
            <p className="truncate text-[13px]">
              {LOAN_PRODUCT_LABELS[productType]}
              {principalNum > 0 ? ` · ${florin(principalNum)}` : ""}
            </p>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold">View</span>
        </summary>
        <div className="max-h-[60vh] overflow-y-auto border-t border-border px-4 py-4">{summary}</div>
      </details>
    </div>
  );
}

const Fieldset = ({
  ref,
  step,
  index,
  title,
  description,
  children,
}: {
  ref: (el: HTMLElement | null) => void;
  step: StepId;
  index: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) => (
  <section
    ref={ref}
    data-step={step}
    className="scroll-mt-32 border-t border-border pt-8 first:border-t-0 first:pt-0"
  >
    <header className="mb-6 flex items-baseline gap-3">
      <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">{index}</span>
      <div>
        <h2 className="font-serif text-[22px] leading-tight tracking-tight">{title}</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>
      </div>
    </header>
    <div className="space-y-5">{children}</div>
  </section>
);

function ApplicationSummary({
  productLabel,
  principal,
  termMonths,
  repaymentCadence,
  indicativeRate,
  estimatedTotal,
  estimatedInterest,
}: {
  productLabel: string;
  principal: number | null;
  termMonths: number | null;
  repaymentCadence: string;
  indicativeRate: string;
  estimatedTotal: number | null;
  estimatedInterest: number | null;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface-1/80">
      <div className="border-b border-border px-5 py-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">
          Application summary
        </p>
        <h3 className="mt-2 font-serif text-[20px] leading-tight tracking-tight">
          {productLabel}
        </h3>
        <p className="mt-1 text-[12px] text-muted-foreground">Indicative · subject to officer review</p>
      </div>
      <dl className="divide-y divide-border/60">
        <SummaryRow label="Requested">
          {principal != null ? <Florin value={principal} fractionDigits={0} /> : <Dash />}
        </SummaryRow>
        <SummaryRow label="Term">
          {termMonths != null ? <span className="tabular font-mono text-[13px]">{termMonths} mo</span> : <Dash />}
        </SummaryRow>
        <SummaryRow label="Rate">
          <span className="tabular font-mono text-[13px]">{indicativeRate}</span>
        </SummaryRow>
        <SummaryRow label="Repayment">
          <span className="text-[13px]">{repaymentCadence}</span>
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
        {estimatedInterest != null && (
          <SummaryRow label="Est. interest">
            <Florin value={estimatedInterest} fractionDigits={0} />
          </SummaryRow>
        )}
      </dl>
      <div className="border-t border-border px-5 py-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          What happens next
        </p>
        <ol className="mt-3 space-y-2 text-[12px] text-muted-foreground">
          {[
            "You submit · application enters the desk queue.",
            "A credit officer is assigned within hours.",
            "A secure deal room opens for negotiation and signature.",
          ].map((step, i) => (
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

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3">
      <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

function Dash() {
  return <span className="text-muted-foreground/70">—</span>;
}