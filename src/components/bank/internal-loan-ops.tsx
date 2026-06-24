import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { BankReviewButton } from "@/components/bank/bank-review-button";
import { LoanRepaymentProgressBar } from "@/components/bank/loan-repayment-progress";
import { florin } from "@/lib/bank/api";
import {
  accrueLoanInterestRecord,
  adminAdjustLoanRecord,
  freezeLoanRecord,
  markLoanPaidOffRecord,
  unfreezeLoanRecord,
} from "@/lib/bank/lending.functions";
import type { InternalActiveLoanRow } from "@/lib/bank/lending-types";
import { formatActivityDateTime } from "@/lib/format-datetime";

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
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="rounded border border-border bg-surface-2 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-gold"
        >
          {expanded ? "Hide actions" : "Manage"}
        </button>
      </div>

      <div className="mt-5">
        <LoanRepaymentProgressBar
          projectedOutstanding={loan.projectedOutstanding}
          amountRepaid={loan.amountRepaid}
          percentRepaid={loan.percentRepaid}
          totalRepaymentObligation={loan.totalRepaymentObligation}
          statusLabel={loan.statusLabel}
          compact
        />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Principal" value={florin(loan.principalAmount)} />
        <Metric label="Projected outstanding" value={florin(loan.projectedOutstanding)} />
        <Metric label="Rate" value={loan.interestRateLabel} />
        <Metric label="Risk" value={loan.riskStatusLabel} placeholder />
        <Metric label="Payment status" value={loan.paymentStatusLabel} placeholder />
        <Metric
          label="Last payment"
          value={loan.lastPaymentAt ? formatActivityDateTime(loan.lastPaymentAt) : "—"}
        />
        <Metric
          label="Next interest"
          value={
            loan.nextInterestAccrualAt
              ? formatActivityDateTime(loan.nextInterestAccrualAt)
              : "Coming Soon"
          }
        />
      </div>

      {expanded && (
        <div className="mt-4 space-y-3 border-t border-border/50 pt-4">
          <div className="flex flex-wrap gap-1">
            {loan.status === "active" && (
              <>
                <BankReviewButton
                  label="Accrue interest"
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
            {loan.outstandingBalance <= 0 && loan.status !== "paid_off" && (
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
