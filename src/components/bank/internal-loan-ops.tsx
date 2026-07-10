"use client";

import { Link } from "@tanstack/react-router";
import { internalWorkspaceTabSearch } from "@/lib/internal/internal-route-search";
import { OpsAction } from "@/components/internal/ops-action";
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
import { LoanRepaymentProgressBar } from "@/components/bank/loan-repayment-progress";
import { LoanInterestGuaranteeScheduleTable } from "@/components/bank/loan-interest-guarantee-schedule-table";
import { formatActivityDateTime, formatDueDate } from "@/lib/format-datetime";
import { useState } from "react";

const fieldLabel = "font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground";
const inputClass =
  "mt-1 h-8 w-full rounded border border-border bg-surface-1 px-2.5 text-[12px]";

export function InternalActiveLoanCard({ loan }: { loan: InternalActiveLoanRow }) {
  const [expanded, setExpanded] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustDesc, setAdjustDesc] = useState("");

  return (
    <div className="rounded-lg border border-border/60 bg-surface-2/20 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-gold">{loan.productLabel}</p>
          <p className="mt-1 font-mono text-[12px]">{loan.borrowerLabel}</p>
          {loan.companyName ? (
            <p className="mt-0.5 text-[12px] text-muted-foreground">{loan.companyName}</p>
          ) : null}
          {loan.linkedAccountNumber ? (
            <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{loan.linkedAccountNumber}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/internal/lending/loans/$loanId"
            params={{ loanId: loan.id }}
            search={internalWorkspaceTabSearch("overview")}
            className="h-7 rounded border border-gold/30 bg-surface-2 px-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-gold"
          >
            Open workspace
          </Link>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="h-7 rounded border border-border bg-surface-2 px-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground"
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

      {expanded ? (
        <div className="mt-4 space-y-4 border-t border-border/50 pt-4">
          <div className="flex flex-wrap gap-1">
            {loan.status === "active" ? (
              <>
                <OpsAction
                  label="Guarantee due interest"
                  variant="primary"
                  title="Guarantee due interest"
                  description="Posts guaranteed monthly interest for this loan."
                  impact={florin(loan.guaranteedInterestOwed)}
                  onConfirm={async () => {
                    await accrueLoanInterestRecord({ data: loan.id });
                  }}
                />
                <OpsAction
                  label="Freeze"
                  variant="danger"
                  title="Freeze loan"
                  description="Prevents further disbursements and payments until unfrozen."
                  onConfirm={async () => {
                    await freezeLoanRecord({ data: loan.id });
                  }}
                />
              </>
            ) : null}
            {loan.status === "frozen" ? (
              <OpsAction
                label="Unfreeze"
                variant="primary"
                title="Unfreeze loan"
                description="Restores active loan status."
                onConfirm={async () => {
                  await unfreezeLoanRecord({ data: loan.id });
                }}
              />
            ) : null}
            {(loan.status === "paid_off" || loan.status === "cancelled") &&
            (loan.remainingPotentialInterest > 0 || loan.guaranteedInterestOwed > 0) ? (
              <OpsAction
                label="Waive unpaid interest"
                title="Waive unpaid interest"
                description="Clears remaining potential and guaranteed interest."
                onConfirm={async () => {
                  await waivePendingLoanInterestRecord({ data: loan.id });
                }}
              />
            ) : null}
            {loan.currentPayoffAmount <= 0 && loan.status !== "paid_off" ? (
              <OpsAction
                label="Mark paid off"
                variant="primary"
                title="Mark loan paid off"
                description="Closes the loan with zero payoff balance."
                onConfirm={async () => {
                  await markLoanPaidOffRecord({ data: loan.id });
                }}
              />
            ) : null}
          </div>

          <div>
            <p className={`${fieldLabel} mb-2`}>Interest guarantee schedule</p>
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
          <OpsAction
            label="Apply adjustment"
            variant="primary"
            title="Apply loan adjustment"
            description="Posts a manual principal adjustment to this loan."
            impact={`${florin(Number(adjustAmount) || 0)} · ${adjustDesc || "No description"}`}
            onConfirm={async (reason) => {
              await adminAdjustLoanRecord({
                data: {
                  loanId: loan.id,
                  amount: Number(adjustAmount),
                  description: adjustDesc || reason,
                },
              });
              setAdjustAmount("");
              setAdjustDesc("");
            }}
          />
        </div>
      ) : null}
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
      <div className={fieldLabel}>{label}</div>
      <div
        className={`mt-1 text-[12px] font-medium ${placeholder ? "font-mono uppercase tracking-[0.1em] text-gold/80" : "tabular-nums"}`}
      >
        {value}
      </div>
    </div>
  );
}
