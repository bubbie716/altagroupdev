import { useState, useEffect } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown } from "lucide-react";
import { PageShell, Section, Card } from "@/components/page-shell";
import { BankSubNav } from "@/components/bank/bank-sub-nav";
import { LendingSubNav } from "@/components/bank/lending-sub-nav";
import { AdminDataTable } from "@/components/internal/admin-data-table";
import { StatusBadge } from "@/components/internal/status-badge";
import { LoanRepaymentProgressBar } from "@/components/bank/loan-repayment-progress";
import { LoanRepaymentDialog } from "@/components/bank/loan-repayment-dialog";
import { LoanPaymentScheduleTable } from "@/components/bank/loan-payment-schedule-table";
import { LoanAutoPayForm } from "@/components/bank/loan-autopay-form";
import { AutoPayBadge } from "@/components/bank/auto-pay-badge";
import { AltaCreditProfilePlaceholder } from "@/components/bank/alta-credit-profile-placeholder";
import { florin } from "@/lib/bank/api";
import { fetchLoanPaymentContext, fetchUserLoans } from "@/lib/bank/lending.functions";
import type { LendingAccountOption, LoanPaymentRow, LoanRow } from "@/lib/bank/lending-types";
import { formatActivityDateTime } from "@/lib/format-datetime";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/bank/lending/loans/")({
  loader: async () => fetchUserLoans(),
  head: () => ({
    meta: [{ title: "Active Loans — Alta Bank Lending" }],
  }),
  component: BankLendingLoans,
});

function BankLendingLoans() {
  const loans = Route.useLoaderData();
  const router = useRouter();

  return (
    <PageShell
      eyebrow="Alta Bank · Lending"
      title="Loans"
      description="Approved credit facilities and servicing summary."
    >
      <BankSubNav />
      <LendingSubNav />

      {loans.length === 0 ? (
        <p className="text-[14px] text-muted-foreground">No active or historical loans on file.</p>
      ) : (
        <div className="space-y-8">
          {loans.map((loan: any, index: number) => (
            <LoanCard
              key={loan.id}
              loan={loan}
              defaultExpanded={loans.length === 1 || index === 0}
              onPaid={async () => {
                await router.invalidate();
              }}
            />
          ))}
        </div>
      )}

      <AltaCreditProfilePlaceholder className="mt-12" />
    </PageShell>
  );
}

function LoanCard({
  loan,
  defaultExpanded = false,
  onPaid,
}: {
  loan: LoanRow;
  defaultExpanded?: boolean;
  onPaid: () => void | Promise<void>;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [payOpen, setPayOpen] = useState(false);
  const loadContext = useServerFn(fetchLoanPaymentContext);
  const [sourceAccounts, setSourceAccounts] = useState<LendingAccountOption[] | null>(null);

  useEffect(() => {
    if (!expanded) return;

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
  }, [expanded, loan.id, loadContext]);

  const nextInstallment = loan.paymentSchedule.find(
    (item) => item.status === "pending" || item.status === "overdue",
  );

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="min-w-0 flex-1 text-left"
          aria-expanded={expanded}
        >
          <div className="flex items-start gap-3">
            <ChevronDown
              className={cn(
                "mt-0.5 size-4 shrink-0 text-gold transition-transform",
                expanded && "rotate-180",
              )}
              aria-hidden
            />
            <div className="min-w-0">
              <p className="type-meta-accent">{loan.productLabel}</p>
              {loan.companyName && (
                <p className="mt-1 text-[12px] text-muted-foreground">{loan.companyName}</p>
              )}
              {!expanded && (
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
                  <span className="text-muted-foreground">
                    Projected outstanding:{" "}
                    <span className="type-finance text-foreground">
                      {florin(loan.projectedOutstanding)}
                    </span>
                  </span>
                  <span className="text-muted-foreground">
                    Repaid:{" "}
                    <span className="type-finance text-foreground">
                      {loan.percentRepaid.toFixed(loan.percentRepaid % 1 === 0 ? 0 : 1)}%
                    </span>
                  </span>
                  {nextInstallment && (
                    <span className="text-muted-foreground">
                      Next:{" "}
                      <span className="type-finance text-foreground">
                        {florin(nextInstallment.scheduledAmount)}
                      </span>
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </button>
        <div className="flex flex-wrap items-center gap-2">
          {loan.status === "active" && <AutoPayBadge enabled={loan.autoPay.enabled} />}
          <StatusBadge status={loan.statusLabel} />
        </div>
      </div>

      {expanded && (
        <>
          <Section title="Repayment progress" className="mt-6">
            <LoanRepaymentProgressBar
              projectedOutstanding={loan.projectedOutstanding}
              amountRepaid={loan.amountRepaid}
              percentRepaid={loan.percentRepaid}
              totalRepaymentObligation={loan.totalRepaymentObligation}
              statusLabel={loan.statusLabel}
              compact
            />
            {loan.canMakePayment && (
              <button
                type="button"
                onClick={() => setPayOpen(true)}
                className="mt-4 rounded-md border border-gold/40 bg-gold/10 px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-gold"
              >
                Make payment
              </button>
            )}
          </Section>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <LoanMetric label="Original principal" value={florin(loan.principalAmount)} />
            <LoanMetric label="Projected outstanding" value={florin(loan.projectedOutstanding)} />
            <LoanMetric label="Amount repaid" value={florin(loan.amountRepaid)} />
            <LoanMetric label="Interest rate" value={loan.interestRateLabel} />
            {loan.termMonths != null && (
              <LoanMetric
                label="Term"
                value={`${loan.termMonths} mo · ${loan.monthlyPrincipalPercent?.toFixed(0) ?? "—"}%/mo`}
              />
            )}
            {nextInstallment && (
              <LoanMetric
                label="Next installment"
                value={florin(nextInstallment.scheduledAmount)}
              />
            )}
          </div>

          <Section title="Payment schedule" className="mt-8">
            <LoanPaymentScheduleTable
              schedule={loan.paymentSchedule}
              termMonths={loan.termMonths}
              monthlyPrincipalPercent={loan.monthlyPrincipalPercent}
            />
          </Section>

          {sourceAccounts && (
            <Section title="Automatic payments" className="mt-8">
              <LoanAutoPayForm loan={loan} sourceAccounts={sourceAccounts} onUpdated={onPaid} />
            </Section>
          )}

          <Section title="Payment history" className="mt-8">
            {loan.recentPayments.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">No payments recorded yet.</p>
            ) : (
              <AdminDataTable
                columns={paymentPreviewColumns()}
                rows={loan.recentPayments}
                rowKey={(p) => p.id}
              />
            )}
          </Section>
        </>
      )}

      <LoanRepaymentDialog
        loan={loan}
        open={payOpen}
        onOpenChange={setPayOpen}
        onPaid={onPaid}
      />
    </Card>
  );
}

function LoanMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="type-meta-sm">{label}</div>
      <div className="tabular mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}

function paymentPreviewColumns() {
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
        <span className="type-finance">{florin(p.amount)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (p: LoanPaymentRow) => <StatusBadge status={p.statusLabel} />,
    },
  ];
}
