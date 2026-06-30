import { useMemo, useState, type ReactNode } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/internal/status-badge";
import { BankStatStrip } from "@/components/bank/bank-stat-strip";
import { LoanRepaymentDialog } from "@/components/bank/loan-repayment-dialog";
import { AutoPayBadge } from "@/components/bank/auto-pay-badge";
import { florin } from "@/lib/bank/api";
import {
  computeActiveLoansSummary,
  formatLoanDueDate,
  formatLoanReference,
  resolveLoanNextDue,
  splitLoansByServicing,
} from "@/lib/bank/lending-loans-display";
import type { LoanRow } from "@/lib/bank/lending-types";
import { type } from "@/lib/typography";
import { cn } from "@/lib/utils";

export function LendingLoansPage({ loans }: { loans: LoanRow[] }) {
  const { active, previous } = useMemo(() => splitLoansByServicing(loans), [loans]);
  const summary = useMemo(() => computeActiveLoansSummary(active), [active]);

  return (
    <div className="space-y-10 sm:space-y-12">
      {active.length > 0 ? (
        <BankStatStrip
          density="emphasized"
          items={[
            {
              label: "Total balance",
              value: florin(summary.totalBalance),
              sub: "Combined payoff across active loans",
              accent: summary.totalBalance > 0,
            },
            {
              label: "Next payment (est.)",
              value: summary.nextDue ? florin(summary.nextDue.amount) : "—",
              sub: summary.nextDue
                ? `Due ${formatLoanDueDate(summary.nextDue.date, "long")}`
                : "Nothing scheduled",
            },
            {
              label: "Active loans",
              value: String(summary.activeCount),
              sub: summary.activeCount === 1 ? "loan" : "loans",
            },
          ]}
        />
      ) : null}

      <LoansSection
        title="Active loans"
        description="Loans you are currently repaying. Balance today is what you'd pay to close each loan now."
      >
        {active.length === 0 ? (
          <SectionEmpty message="You have no active loans right now." />
        ) : (
          <ul className="grid gap-4 lg:grid-cols-2">
            {active.map((loan) => (
              <li key={loan.id}>
                <ActiveLoanCard loan={loan} />
              </li>
            ))}
          </ul>
        )}
      </LoansSection>

      {previous.length > 0 ? (
        <LoansSection
          title="Previous loans"
          description="Paid-off and closed loans. Open a loan to view schedules and payment history."
        >
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface-1/40">
            {previous.map((loan) => (
              <li key={loan.id}>
                <PreviousLoanRow loan={loan} />
              </li>
            ))}
          </ul>
        </LoansSection>
      ) : null}
    </div>
  );
}

function LoansSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-5">
      <div>
        <h2 className={type.sectionTitle}>{title}</h2>
        {description ? (
          <p className={cn(type.bodySm, "mt-1.5 max-w-2xl text-muted-foreground")}>{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function SectionEmpty({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface-1/30 px-5 py-8 text-center sm:px-6 sm:py-10">
      <p className={cn(type.bodySm, "text-muted-foreground")}>{message}</p>
    </div>
  );
}

function ActiveLoanCard({ loan }: { loan: LoanRow }) {
  const router = useRouter();
  const [payOpen, setPayOpen] = useState(false);
  const nextDue = resolveLoanNextDue(loan);
  const percentDisplay = loan.principalPercentRepaid.toFixed(
    loan.principalPercentRepaid % 1 === 0 ? 0 : 1,
  );

  return (
    <article className="flex h-full flex-col rounded-xl border border-border bg-surface-1/80 p-5 shadow-card transition-colors hover:border-border-strong sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold tracking-tight">{loan.productLabel}</h3>
          {loan.companyName ? (
            <p className={cn(type.bodySm, "mt-0.5 text-muted-foreground")}>{loan.companyName}</p>
          ) : null}
          <p className={cn(type.metaSm, "mt-2 text-muted-foreground/80")}>
            Ref {formatLoanReference(loan.id)}
          </p>
        </div>
        <StatusBadge status={loan.statusLabel} />
      </div>

      <div className="mt-5 sm:mt-6">
        <p className={type.meta}>Balance today</p>
        <p className={cn(type.financeXl, "mt-1 font-semibold text-gold")}>
          {florin(loan.currentPayoffAmount)}
        </p>
        <p className={cn(type.bodySm, "mt-1.5 leading-relaxed text-muted-foreground")}>
          Payoff amount — principal plus guaranteed interest owed today
        </p>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 border-t border-border/80 pt-5 min-[420px]:grid-cols-2 min-[420px]:gap-4">
        <div className="min-w-0">
          <p className={type.meta}>Next payment (est.)</p>
          {nextDue ? (
            <>
              <p className={cn(type.financeMd, "mt-1 font-medium")}>{florin(nextDue.amount)}</p>
              <p className={cn(type.metaSm, "mt-0.5 text-muted-foreground")}>
                Due {formatLoanDueDate(nextDue.date, "long")}
              </p>
              <p className={cn(type.bodySm, "mt-1.5 leading-relaxed text-muted-foreground")}>
                Scheduled installment; may differ from balance today
              </p>
            </>
          ) : (
            <p className={cn(type.bodySm, "mt-1 text-muted-foreground")}>Nothing scheduled</p>
          )}
        </div>
        <div className="min-w-0">
          <p className={type.meta}>Auto-pay</p>
          <div className="mt-1.5">
            {loan.autoPay.enabled ? (
              <AutoPayBadge enabled />
            ) : (
              <span className={cn(type.bodySm, "text-muted-foreground")}>Not enrolled</span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className={cn(type.bodySm, "text-muted-foreground")}>
            {percentDisplay}% principal repaid
          </span>
        </div>
        <Progress
          value={loan.principalPercentRepaid}
          className="h-1 rounded-full bg-foreground/[0.06] [&>div]:bg-gold"
        />
      </div>

      <div className="mt-6 flex flex-col gap-3 pt-1 sm:flex-row sm:flex-wrap sm:items-center">
        {loan.canMakePayment ? (
          <button
            type="button"
            onClick={() => setPayOpen(true)}
            className="w-full rounded-md bg-foreground px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-background transition-opacity hover:opacity-90 sm:w-auto sm:py-2"
          >
            Make payment
          </button>
        ) : null}
        <Link
          to="/bank/lending/loans/$loanId"
          params={{ loanId: loan.id }}
          className="inline-flex w-full items-center justify-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-gold transition-opacity hover:opacity-80 sm:w-auto sm:justify-start"
        >
          View details
          <ChevronRight className="size-3.5" aria-hidden />
        </Link>
      </div>

      <LoanRepaymentDialog
        loan={loan}
        open={payOpen}
        onOpenChange={setPayOpen}
        onPaid={async () => {
          await router.invalidate();
        }}
      />
    </article>
  );
}

function PreviousLoanRow({ loan }: { loan: LoanRow }) {
  return (
    <Link
      to="/bank/lending/loans/$loanId"
      params={{ loanId: loan.id }}
      className="flex flex-col gap-3 px-4 py-4 transition-colors hover:bg-surface-2/40 sm:flex-row sm:items-center sm:gap-4 sm:px-5"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[14px] font-medium">{loan.productLabel}</span>
          <StatusBadge status={loan.statusLabel} />
        </div>
        {loan.companyName ? (
          <p className={cn(type.bodySm, "mt-0.5 text-muted-foreground")}>{loan.companyName}</p>
        ) : null}
        <p className={cn(type.metaSm, "mt-1 text-muted-foreground/70")}>
          Ref {formatLoanReference(loan.id)}
        </p>
      </div>
      <div className="flex items-center justify-between gap-4 sm:shrink-0 sm:justify-end">
        <div className="min-w-0 text-left sm:text-right">
          <p className={type.meta}>Total repaid</p>
          <p className={cn(type.financeMd, "mt-0.5 font-medium")}>{florin(loan.amountRepaid)}</p>
          <p className={cn(type.metaSm, "mt-0.5 text-muted-foreground")}>
            of {florin(loan.principalAmount)} borrowed
          </p>
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </div>
    </Link>
  );
}

/** @deprecated Use LendingLoansPage */
export const LendingLoansTable = LendingLoansPage;
