import { useMemo, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/page-shell";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { florin } from "@/lib/bank/api";
import { submitLoanApplication } from "@/lib/bank/lending.functions";
import type {
  CompanyLendingOption,
  LendingAccountOption,
  LoanProductTypeCode,
} from "@/lib/bank/lending-types";
import {
  LOAN_PRODUCT_LABELS,
  LOAN_PRODUCT_REPAYMENT_CARD,
  LOAN_PRODUCT_REPAYMENT_GUIDANCE,
  LOAN_TERM_MONTHS_HELP,
  LOAN_TERM_MONTHS_MAX,
  LOAN_TERM_MONTHS_MIN,
  computeLoanTermEstimate,
} from "@/lib/bank/lending-types";
import { useCurrentUser } from "@/hooks/use-current-user";
import { isPrivateClient } from "@/lib/auth/permissions";
import { formatCustomerActionError } from "@/lib/bank/bank-action-errors";

const fieldLabel = "type-meta";
const inputClass =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold/40";

function parseServerError(err: unknown): string {
  if (err instanceof Error && err.message === "FORBIDDEN") {
    return "You do not have permission to submit this application.";
  }
  return formatCustomerActionError(err, "lending_apply");
}

export function LendingApplyForm({
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
    if (user && isPrivateClient(user)) {
      options.push("private_liquidity_line");
    }
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

  const termEstimate = useMemo(() => {
    const principal = Number(requestedAmount);
    const months = Number(termMonths);
    if (!Number.isFinite(principal) || principal <= 0) return null;
    if (!Number.isInteger(months) || months < LOAN_TERM_MONTHS_MIN || months > LOAN_TERM_MONTHS_MAX) {
      return null;
    }
    return computeLoanTermEstimate(productType, principal, months);
  }, [productType, requestedAmount, termMonths]);

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

  return (
    <Card>
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-6">
        <div>
          <label className={fieldLabel}>Credit product</label>
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
            All applications are reviewed manually by Alta Bank credit operations. No automatic approval.
            {productType !== "private_liquidity_line" && (
              <>
                {" "}
                Indicative monthly rate:{" "}
                {productType === "personal_credit_line" ? "7.5%" : "6%"} · Repayment:{" "}
                {LOAN_PRODUCT_REPAYMENT_GUIDANCE[productType]}
              </>
            )}
            {productType === "private_liquidity_line" && (
              <> {LOAN_PRODUCT_REPAYMENT_GUIDANCE.private_liquidity_line}</>
            )}
          </p>
        </div>

        {productType === "business_credit_line" && (
          <div>
            <label className={fieldLabel}>Company</label>
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

        <div>
          <label className={fieldLabel} htmlFor="requestedAmount">
            Requested facility (Florins)
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
          <label className={fieldLabel} htmlFor="termMonths">
            Loan term (months)
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
          <p className="mt-2 text-[12px] text-muted-foreground">{LOAN_TERM_MONTHS_HELP}</p>
        </div>

        {termEstimate && (
          <div className="rounded-md border border-gold/25 bg-gold/5 px-4 py-3 text-[13px]">
            <p className="type-meta-accent">Estimated total outstanding</p>
            <p className="tabular mt-2 text-lg font-medium">{florin(termEstimate.totalOutstanding)}</p>
            <p className="mt-1 text-muted-foreground">
              Principal {florin(Number(requestedAmount))} + estimated interest {florin(termEstimate.totalInterest)} over{" "}
              {termMonths} months (indicative monthly rate, no payments assumed).
            </p>
          </div>
        )}

        {productType === "private_liquidity_line" && Number(termMonths) > 0 && Number(requestedAmount) > 0 && !termEstimate && (
          <p className="text-[12px] text-muted-foreground">
            Total outstanding estimate is available after Alta Private sets your negotiated monthly rate at approval.
          </p>
        )}

        <div>
          <label className={fieldLabel}>Linked Alta account</label>
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

        <div>
          <label className={fieldLabel} htmlFor="purpose">
            Purpose
          </label>
          <Textarea
            id="purpose"
            required
            className="mt-2 min-h-[88px]"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="Describe how the facility will be used."
          />
        </div>

        <div>
          <label className={fieldLabel} htmlFor="repaymentPlan">
            Repayment plan
          </label>
          <Textarea
            id="repaymentPlan"
            required
            className="mt-2 min-h-[88px]"
            value={repaymentPlan}
            onChange={(e) => setRepaymentPlan(e.target.value)}
            placeholder="Outline expected repayment cadence and sources."
          />
        </div>

        <div>
          <label className={fieldLabel} htmlFor="collateral">
            Collateral description (optional)
          </label>
          <Textarea
            id="collateral"
            className="mt-2 min-h-[72px]"
            value={collateralDescription}
            onChange={(e) => setCollateralDescription(e.target.value)}
            placeholder="Securities, guarantees, or other support — reviewed manually."
          />
        </div>

        <div>
          <label className={fieldLabel} htmlFor="notes">
            Additional notes (optional)
          </label>
          <Textarea
            id="notes"
            className="mt-2 min-h-[72px]"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {error && (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-[13px] text-destructive">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border/60 pt-6">
          <p className="text-[12px] text-muted-foreground">
            After submission, your application enters review. A Secure Deal Room opens for communication with Alta Bank credit operations.
          </p>
          <button
            type="submit"
            disabled={submitting || (productType === "business_credit_line" && companies.length === 0)}
            className="rounded-md border border-gold/40 bg-gold/10 px-5 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-gold disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit application"}
          </button>
        </div>
      </form>
    </Card>
  );
}

export function LendingAmountPreview({ amount }: { amount: number }) {
  return <span className="type-finance">{florin(amount)}</span>;
}
