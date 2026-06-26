import { useState } from "react";
import { useRouter, Link } from "@tanstack/react-router";
import { BankReviewButton } from "@/components/bank/bank-review-button";
import { LoanRepaymentProgressBar } from "@/components/bank/loan-repayment-progress";
import { LoanInterestGuaranteeScheduleTable } from "@/components/bank/loan-interest-guarantee-schedule-table";
import { florin } from "@/lib/bank/api";
import {
  accrueLoanInterestRecord,
  adminAdjustLoanRecord,
  freezeLoanRecord,
  markLoanPaidOffRecord,
  unfreezeLoanRecord,
  waivePendingLoanInterestRecord,
} from "@/lib/bank/lending.functions";
import type { InternalActiveLoanRow } from "@/lib/bank/lending-types";
import { formatActivityDateTime, formatDueDate } from "@/lib/format-datetime";

const fieldLabel = "type-meta";
const inputClass =
  "mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-[12px]";

export function InternalActiveLoanCard({ loan }: { loan: InternalActiveLoanRow }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustDesc, setAdjustDesc] = useState("");

  async function invalidate() {
    await router.invalidate();
  }

  return (
    <div className="rounded-lg border border-border/60 bg-surface-2/20 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="type-meta-accent">{loan.productLabel}</p>
          <p className="mt-1 font-mono text-[12px]">{loan.borrowerLabel}</p>
          {loan.companyName && (
            <p className="mt-0.5 text-[12px] text-muted-foreground">{loan.companyName}</p>
          )}
          {loan.linkedAccountNumber && (
            <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{loan.linkedAccountNumber}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/internal/lending/loans/$loanId"
            params={{ loanId: loan.id }}
            className="rounded border border-gold/30 bg-surface-2 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-gold"
          >
            Open workspace
          </Link>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="rounded border border-border bg-surface-2 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-gold"
          >
            {expanded ? "Hide actions" : "Quick actions"}
          </button>
        </div>
      </div>

      <div className="mt-5">
        <LoanRepaymentProgressBar
          principalAmount={loan.principalAmount}
          principalRepaid={loan.principalRepaid}
          principalPercentRepaid={loan.principalPercentRepaid}
          currentPayoffAmount={loan.currentPayoffAmount}
          guaranteedInterestOwed={loan.guaranteedInterestOwed}
          statusLabel={loan.statusLabel}
          compact
        />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Outstanding principal" value={florin(loan.principalOutstanding)} />
        <Metric label="Guaranteed interest owed" value={florin(loan.guaranteedInterestOwed)} />
        <Metric label="Pending future interest" value={florin(loan.remainingPotentialInterest)} />
        <Metric label="Current payoff" value={florin(loan.currentPayoffAmount)} />
        <Metric label="Projected full-term cost" value={florin(loan.projectedFullTermCost)} />
        <Metric label="Rate" value={loan.interestRateLabel} />
        <Metric
          label="Next interest guarantee"
          value={
            loan.nextInterestGuaranteeDate
              ? formatDueDate(loan.nextInterestGuaranteeDate)
              : loan.nextInterestAccrualAt
                ? formatActivityDateTime(loan.nextInterestAccrualAt)
                : "—"
          }
        />
        <Metric label="Risk" value={loan.riskStatusLabel} placeholder />
        <Metric label="Payment status" value={loan.paymentStatusLabel} placeholder />
        <Metric
          label="Last payment"
          value={loan.lastPaymentAt ? formatActivityDateTime(loan.lastPaymentAt) : "—"}
        />
      </div>

      {expanded && (
        <div className="mt-4 space-y-4 border-t border-border/50 pt-4">
          <div className="flex flex-wrap gap-1">
            {loan.status === "active" && (
              <>
                <BankReviewButton
                  label="Guarantee due interest"
                  variant="primary"
                  onAction={async () => {
                    await accrueLoanInterestRecord({ data: loan.id });
                    await invalidate();
                  }}
                />
                <BankReviewButton
                  label="Freeze"
                  variant="danger"
                  onAction={async () => {
                    await freezeLoanRecord({ data: loan.id });
                    await invalidate();
                  }}
                />
              </>
            )}
            {loan.status === "frozen" && (
              <BankReviewButton
                label="Unfreeze"
                variant="primary"
                onAction={async () => {
                  await unfreezeLoanRecord({ data: loan.id });
                  await invalidate();
                }}
              />
            )}
            {(loan.status === "paid_off" || loan.status === "cancelled") &&
              (loan.remainingPotentialInterest > 0 || loan.guaranteedInterestOwed > 0) && (
                <BankReviewButton
                  label="Waive unpaid interest"
                  variant="default"
                  onAction={async () => {
                    await waivePendingLoanInterestRecord({ data: loan.id });
                    await invalidate();
                  }}
                />
              )}
            {loan.currentPayoffAmount <= 0 && loan.status !== "paid_off" && (
              <BankReviewButton
                label="Mark paid off"
                variant="primary"
                onAction={async () => {
                  await markLoanPaidOffRecord({ data: loan.id });
                  await invalidate();
                }}
              />
            )}
          </div>

          <div>
            <p className="type-meta-sm mb-2">Interest guarantee schedule</p>
            <LoanInterestGuaranteeScheduleTable schedule={loan.interestGuaranteeSchedule} />
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className={fieldLabel}>Adjustment ƒ (+/-)</label>
              <input
                type="number"
                step="0.01"
                className={inputClass}
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
              />
            </div>
            <div>
              <label className={fieldLabel}>Description</label>
              <input
                type="text"
                className={inputClass}
                value={adjustDesc}
                onChange={(e) => setAdjustDesc(e.target.value)}
              />
            </div>
          </div>
          <BankReviewButton
            label="Apply adjustment"
            onAction={async () => {
              await adminAdjustLoanRecord({
                data: {
                  loanId: loan.id,
                  amount: Number(adjustAmount),
                  description: adjustDesc,
                },
              });
              setAdjustAmount("");
              setAdjustDesc("");
              await invalidate();
            }}
          />
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  placeholder,
}: {
  label: string;
  value: string;
  placeholder?: boolean;
}) {
  return (
    <div className="rounded-md border border-border/50 px-3 py-2">
      <div className="type-meta-sm">{label}</div>
      <div
        className={`mt-1 text-[12px] font-medium ${placeholder ? "font-mono uppercase tracking-[0.1em] text-gold/80" : "type-finance"}`}
      >
        {value}
      </div>
    </div>
  );
}
