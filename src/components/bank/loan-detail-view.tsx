import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft } from "lucide-react";
import { Section } from "@/components/page-shell";
import { AdminDataTable } from "@/components/internal/admin-data-table";
import { StatusBadge } from "@/components/internal/status-badge";
import { LoanRepaymentProgressBar } from "@/components/bank/loan-repayment-progress";
import { LoanRepaymentDialog } from "@/components/bank/loan-repayment-dialog";
import { LoanPaymentScheduleTable } from "@/components/bank/loan-payment-schedule-table";
import { LoanInterestGuaranteeScheduleTable } from "@/components/bank/loan-interest-guarantee-schedule-table";
import { LoanAutoPayForm } from "@/components/bank/loan-autopay-form";
import { florin } from "@/lib/bank/api";
import { fetchLoanPaymentContext } from "@/lib/bank/lending.functions";
import { formatLoanReference, isActiveLoan } from "@/lib/bank/lending-loans-display";
import type { LendingAccountOption, LoanPaymentRow, LoanRow } from "@/lib/bank/lending-types";
import { formatActivityDateTime } from "@/lib/format-datetime";
import { type } from "@/lib/typography";
import { cn } from "@/lib/utils";

function DetailMetric({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border/80 bg-surface-1/50 px-4 py-3">
      <div className={type.meta}>{label}</div>
      <div className={cn(type.financeMd, "mt-1.5 font-medium", emphasize && "text-gold")}>
        {value}
      </div>
    </div>
  );
}

function paymentHistoryColumns() {
  return [
    {
      key: "date",
      header: "Date",
      cell: (p: LoanPaymentRow) => formatActivityDateTime(p.paymentDate),
    },
    {
      key: "amount",
      header: "Amount",
      cell: (p: LoanPaymentRow) => (
        <span className={cn(type.finance, "font-medium")}>{florin(p.amount)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (p: LoanPaymentRow) => <StatusBadge status={p.statusLabel} />,
    },
  ];
}

export function LoanDetailView({
  loan,
  onUpdated,
}: {
  loan: LoanRow;
  onUpdated: () => void | Promise<void>;
}) {
  const [payOpen, setPayOpen] = useState(false);
  const loadContext = useServerFn(fetchLoanPaymentContext);
  const [sourceAccounts, setSourceAccounts] = useState<LendingAccountOption[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadContext({ data: loan.id })
      .then((ctx) => {
        if (!cancelled) setSourceAccounts(ctx.sourceAccounts);
      })
      .catch(() => {
        if (!cancelled) setSourceAccounts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [loan.id, loadContext]);

  const servicingActive = isActiveLoan(loan.status);

  return (
    <div className="space-y-8 sm:space-y-10">
      <Link
        to="/bank/lending/loans"
        aria-label="Back to all loans"
        className="-ml-1 inline-flex items-center gap-1.5 rounded-md px-1 py-2 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4 shrink-0" aria-hidden />
        All loans
      </Link>

      {!servicingActive ? (
        <p className="rounded-lg border border-border bg-surface-1/60 px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">
          This loan is closed. No further payments are due — schedules and history are shown for
          your records.
        </p>
      ) : null}

      <header className="space-y-4 border-b border-border pb-6 sm:space-y-3 sm:pb-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <p className={type.meta}>Ref {formatLoanReference(loan.id)}</p>
            <h2 className="font-serif text-xl tracking-tight sm:text-2xl">{loan.productLabel}</h2>
            {loan.companyName ? (
              <p className={cn(type.bodySm, "text-muted-foreground")}>{loan.companyName}</p>
            ) : null}
          </div>
          <StatusBadge status={loan.statusLabel} />
        </div>
        {loan.canMakePayment ? (
          <button
            type="button"
            onClick={() => setPayOpen(true)}
            className="w-full rounded-md bg-foreground px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-background transition-opacity hover:opacity-90 sm:w-auto"
          >
            Make payment
          </button>
        ) : null}
      </header>

      <Section title={servicingActive ? "Repayment" : "Repayment summary"}>
        <LoanRepaymentProgressBar
          principalAmount={loan.principalAmount}
          principalRepaid={loan.principalRepaid}
          principalPercentRepaid={loan.principalPercentRepaid}
          currentPayoffAmount={loan.currentPayoffAmount}
          guaranteedInterestOwed={loan.guaranteedInterestOwed}
          statusLabel={loan.statusLabel}
        />
      </Section>

      <Section title="Loan details">
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <DetailMetric label="Original principal" value={florin(loan.principalAmount)} />
          <DetailMetric label="Outstanding principal" value={florin(loan.principalOutstanding)} />
          <DetailMetric
            label="Balance today"
            value={florin(loan.currentPayoffAmount)}
            emphasize={servicingActive && loan.currentPayoffAmount > 0}
          />
          {servicingActive ? (
            <>
              <DetailMetric
                label="Guaranteed interest owed"
                value={florin(loan.guaranteedInterestOwed)}
              />
              <DetailMetric
                label="Remaining potential interest"
                value={florin(loan.remainingPotentialInterest)}
              />
              <DetailMetric
                label="Projected full-term cost"
                value={florin(loan.projectedFullTermCost)}
              />
              <DetailMetric label="Interest rate" value={loan.interestRateLabel} />
              <DetailMetric label="Next payment (est.)" value={loan.nextPaymentDueLabel} />
            </>
          ) : null}
          <DetailMetric label="Total repaid" value={florin(loan.amountRepaid)} />
        </div>
      </Section>

      <Section title="Payment schedule">
        <LoanPaymentScheduleTable
          schedule={loan.paymentSchedule}
          termMonths={loan.termMonths}
          monthlyPrincipalPercent={loan.monthlyPrincipalPercent}
        />
      </Section>

      <Section title="Interest guarantee schedule">
        <LoanInterestGuaranteeScheduleTable schedule={loan.interestGuaranteeSchedule} />
      </Section>

      {sourceAccounts && loan.status === "active" ? (
        <Section title="Automatic payments">
          <LoanAutoPayForm loan={loan} sourceAccounts={sourceAccounts} onUpdated={onUpdated} />
        </Section>
      ) : null}

      <Section title="Payment history">
        {loan.recentPayments.length === 0 ? (
          <p className={cn(type.bodySm, "text-muted-foreground")}>
            {servicingActive
              ? "No payments recorded yet."
              : "No payments were recorded for this loan."}
          </p>
        ) : (
          <>
            <AdminDataTable
              columns={paymentHistoryColumns()}
              rows={loan.recentPayments}
              rowKey={(p) => p.id}
            />
            {loan.recentPayments.length >= 5 ? (
              <p className={cn(type.bodySm, "mt-3 text-muted-foreground")}>
                Showing your five most recent payments.
              </p>
            ) : null}
          </>
        )}
      </Section>

      <LoanRepaymentDialog
        loan={loan}
        open={payOpen}
        onOpenChange={setPayOpen}
        onPaid={onUpdated}
      />
    </div>
  );
}
