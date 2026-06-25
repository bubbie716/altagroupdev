import { useEffect, useMemo, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown } from "lucide-react";
import { Section } from "@/components/page-shell";
import { AdminDataTable } from "@/components/internal/admin-data-table";
import { StatusBadge } from "@/components/internal/status-badge";
import { Florin } from "@/components/ui/florin";
import { LoanRepaymentProgressBar } from "@/components/bank/loan-repayment-progress";
import { LoanRepaymentDialog } from "@/components/bank/loan-repayment-dialog";
import { LoanPaymentScheduleTable } from "@/components/bank/loan-payment-schedule-table";
import { LoanAutoPayForm } from "@/components/bank/loan-autopay-form";
import { AutoPayBadge } from "@/components/bank/auto-pay-badge";
import { florin } from "@/lib/bank/api";
import { fetchLoanPaymentContext } from "@/lib/bank/lending.functions";
import type {
  LendingAccountOption,
  LoanPaymentRow,
  LoanRow,
  LoanScheduleItemRow,
} from "@/lib/bank/lending-types";
import { formatActivityDateTime } from "@/lib/format-datetime";
import { cn } from "@/lib/utils";

export function LendingLoansTable({ loans }: { loans: LoanRow[] }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<string | null>(loans[0]?.id ?? null);

  const summary = useMemo(() => {
    let exposure = 0;
    let repaid = 0;
    let autopay = 0;
    let nextDue: { date: string; amount: number } | null = null;
    for (const loan of loans) {
      exposure += loan.projectedOutstanding;
      repaid += loan.amountRepaid;
      if (loan.autoPay.enabled) autopay++;
      const next = nextInstallment(loan.paymentSchedule);
      if (next) {
        if (!nextDue || new Date(next.dueDate) < new Date(nextDue.date)) {
          nextDue = { date: next.dueDate, amount: next.scheduledAmount };
        }
      }
    }
    return { exposure, repaid, autopay, nextDue, total: loans.length };
  }, [loans]);

  return (
    <div className="space-y-8">
      {/* Portfolio summary strip */}
      <dl className="grid grid-cols-2 divide-x divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface-1/80 sm:grid-cols-4 sm:divide-y-0">
        <Stat label="Total exposure" value={florin(summary.exposure)} />
        <Stat label="Total repaid" value={florin(summary.repaid)} />
        <Stat
          label="Next payment"
          value={
            summary.nextDue
              ? florin(summary.nextDue.amount)
              : "—"
          }
          sub={
            summary.nextDue
              ? new Date(summary.nextDue.date).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : "No installments due"
          }
        />
        <Stat
          label="Auto-pay"
          value={`${summary.autopay} / ${summary.total}`}
          sub="facilities enrolled"
        />
      </dl>

      {/* Facility table */}
      <div className="overflow-hidden rounded-xl border border-border bg-surface-1">
        <div className="hidden grid-cols-[1.4fr_1fr_0.9fr_0.7fr_0.9fr_0.8fr_0.7fr_auto] gap-4 border-b border-border bg-surface-2/40 px-5 py-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground sm:grid">
          <span>Facility</span>
          <span>Product</span>
          <span className="text-right">Outstanding</span>
          <span className="text-right">Rate</span>
          <span>Next due</span>
          <span>Status</span>
          <span>Auto-pay</span>
          <span className="text-right">·</span>
        </div>
        <ul className="divide-y divide-border">
          {loans.map((loan) => (
            <li key={loan.id}>
              <FacilityRow
                loan={loan}
                isExpanded={expanded === loan.id}
                onToggle={() => setExpanded(expanded === loan.id ? null : loan.id)}
                onPaid={async () => {
                  await router.invalidate();
                }}
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function nextInstallment(schedule: LoanScheduleItemRow[]) {
  return schedule.find((i) => i.status === "pending" || i.status === "overdue");
}

function FacilityRow({
  loan,
  isExpanded,
  onToggle,
  onPaid,
}: {
  loan: LoanRow;
  isExpanded: boolean;
  onToggle: () => void;
  onPaid: () => void | Promise<void>;
}) {
  const next = nextInstallment(loan.paymentSchedule);
  const [payOpen, setPayOpen] = useState(false);
  const loadContext = useServerFn(fetchLoanPaymentContext);
  const [sourceAccounts, setSourceAccounts] = useState<LendingAccountOption[] | null>(null);

  useEffect(() => {
    if (!isExpanded || sourceAccounts) return;
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
  }, [isExpanded, loan.id, loadContext, sourceAccounts]);

  return (
    <div className={cn(isExpanded && "bg-surface-2/30")}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        className="grid w-full grid-cols-1 items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-surface-2/40 sm:grid-cols-[1.4fr_1fr_0.9fr_0.7fr_0.9fr_0.8fr_0.7fr_auto] sm:gap-4"
      >
        <div className="min-w-0">
          <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-foreground">
            {loan.id.slice(0, 10)}
          </div>
          {loan.companyName && (
            <div className="mt-0.5 text-[12px] text-muted-foreground">{loan.companyName}</div>
          )}
        </div>
        <div className="text-[13px]">{loan.productLabel}</div>
        <div className="sm:text-right">
          <span className="text-[14px]">
            <Florin value={loan.projectedOutstanding} fractionDigits={0} />
          </span>
          <div className="tabular font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground sm:mt-0.5">
            of {florin(loan.principalAmount)}
          </div>
        </div>
        <div className="tabular font-mono text-[13px] sm:text-right">{loan.interestRateLabel}</div>
        <div className="text-[12px]">
          {next ? (
            <>
              <div className="tabular">{florin(next.scheduledAmount)}</div>
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                {new Date(next.dueDate).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </div>
            </>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </div>
        <div>
          <StatusBadge status={loan.statusLabel} />
        </div>
        <div>
          {loan.status === "active" ? <AutoPayBadge enabled={loan.autoPay.enabled} /> : null}
        </div>
        <div className="flex justify-end">
          <ChevronDown
            className={cn(
              "size-4 text-gold transition-transform",
              isExpanded && "rotate-180",
            )}
            aria-hidden
          />
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-border px-5 py-6 sm:px-6">
          <Section title="Repayment progress">
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
            <Metric label="Original principal" value={florin(loan.principalAmount)} />
            <Metric label="Projected outstanding" value={florin(loan.projectedOutstanding)} />
            <Metric label="Amount repaid" value={florin(loan.amountRepaid)} />
            <Metric label="Interest rate" value={loan.interestRateLabel} />
            {loan.termMonths != null && (
              <Metric
                label="Term"
                value={`${loan.termMonths} mo · ${loan.monthlyPrincipalPercent?.toFixed(0) ?? "—"}%/mo`}
              />
            )}
            {next && (
              <Metric label="Next installment" value={florin(next.scheduledAmount)} />
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

          <LoanRepaymentDialog
            loan={loan}
            open={payOpen}
            onOpenChange={setPayOpen}
            onPaid={onPaid}
          />
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div className="tabular mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="px-5 py-4">
      <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-serif text-[20px] leading-tight tracking-tight tabular">{value}</dd>
      {sub && (
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/80">
          {sub}
        </p>
      )}
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
        <span className="tabular font-mono text-[13px]">{florin(p.amount)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (p: LoanPaymentRow) => <StatusBadge status={p.statusLabel} />,
    },
  ];
}