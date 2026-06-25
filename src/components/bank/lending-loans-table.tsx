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
import { LoanInterestGuaranteeScheduleTable } from "@/components/bank/loan-interest-guarantee-schedule-table";
import { LoanAutoPayForm } from "@/components/bank/loan-autopay-form";
import { AutoPayBadge } from "@/components/bank/auto-pay-badge";
import { BankStatStrip } from "@/components/bank/bank-stat-strip";
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
      exposure += loan.currentPayoffAmount;
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
      <BankStatStrip
        density="emphasized"
        items={[
          { label: "Total payoff exposure", value: florin(summary.exposure) },
          { label: "Total repaid", value: florin(summary.repaid) },
          {
            label: "Next payment",
            value: summary.nextDue ? florin(summary.nextDue.amount) : "—",
            sub: summary.nextDue
              ? new Date(summary.nextDue.date).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : "No installments due",
          },
          {
            label: "Auto-pay",
            value: `${summary.autopay} / ${summary.total}`,
            sub: "facilities enrolled",
          },
        ]}
      />

      {/* Facility table — single <table> so header and row columns share widths */}
      <div className="overflow-hidden rounded-xl border border-border bg-surface-1">
        <div className="overflow-x-auto">
          <table className="alta-table w-full min-w-[920px] table-fixed text-sm">
            <thead className="bg-surface-2/40">
              <tr>
                <th className="w-[18%]">Facility</th>
                <th className="w-[14%]">Product</th>
                <th className="w-[14%] text-right">Principal due</th>
                <th className="w-[11%]">Rate</th>
                <th className="w-[12%]">Next due</th>
                <th className="w-[11%]">Status</th>
                <th className="w-[14%]">Auto-pay</th>
                <th className="w-10" aria-hidden />
              </tr>
            </thead>
            <tbody>
              {loans.map((loan) => (
                <FacilityRow
                  key={loan.id}
                  loan={loan}
                  isExpanded={expanded === loan.id}
                  onToggle={() => setExpanded(expanded === loan.id ? null : loan.id)}
                  onPaid={async () => {
                    await router.invalidate();
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
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
    <>
      <tr
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
        className={cn(
          "cursor-pointer transition-colors",
          isExpanded && "bg-surface-2/30",
        )}
      >
        <td className="align-middle">
          <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-foreground">
            {loan.id.slice(0, 10)}
          </div>
          {loan.companyName && (
            <div className="mt-0.5 text-[12px] text-muted-foreground">{loan.companyName}</div>
          )}
        </td>
        <td className="align-middle text-[13px]">{loan.productLabel}</td>
        <td className="align-middle text-right">
          <div className="text-[14px]">
            <Florin value={loan.principalOutstanding} fractionDigits={0} />
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            of {florin(loan.principalAmount)}
          </div>
        </td>
        <td className="align-middle font-mono text-[13px]">{loan.interestRateLabel}</td>
        <td className="align-middle text-[12px]">
          {next ? (
            <>
              <div>{florin(next.scheduledAmount)}</div>
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
        </td>
        <td className="align-middle">
          <StatusBadge status={loan.statusLabel} />
        </td>
        <td className="align-middle">
          {loan.status === "active" ? <AutoPayBadge enabled={loan.autoPay.enabled} /> : null}
        </td>
        <td className="align-middle text-right">
          <ChevronDown
            className={cn(
              "ml-auto inline size-4 text-gold transition-transform",
              isExpanded && "rotate-180",
            )}
            aria-hidden
          />
        </td>
      </tr>

      {isExpanded && (
        <tr className="bg-surface-2/30">
          <td colSpan={8} className="!p-0">
            <div className="border-t border-border px-5 py-6 sm:px-6">
          <Section title="Repayment progress">
            <LoanRepaymentProgressBar
              principalAmount={loan.principalAmount}
              principalRepaid={loan.principalRepaid}
              principalPercentRepaid={loan.principalPercentRepaid}
              currentPayoffAmount={loan.currentPayoffAmount}
              guaranteedInterestOwed={loan.guaranteedInterestOwed}
              statusLabel={loan.statusLabel}
              compact
            />
            {loan.canMakePayment && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPayOpen(true);
                }}
                className="mt-4 rounded-md border border-gold/40 bg-gold/10 px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-gold"
              >
                Make payment
              </button>
            )}
          </Section>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Original principal" value={florin(loan.principalAmount)} />
            <Metric label="Outstanding principal" value={florin(loan.principalOutstanding)} />
            <Metric label="Guaranteed interest owed" value={florin(loan.guaranteedInterestOwed)} />
            <Metric
              label="Remaining potential interest"
              value={florin(loan.remainingPotentialInterest)}
            />
            <Metric
              label="Current payoff amount"
              value={florin(loan.currentPayoffAmount)}
              emphasize
            />
            <Metric
              label="Projected full-term cost"
              value={florin(loan.projectedFullTermCost)}
            />
            <Metric label="Interest rate" value={loan.interestRateLabel} />
            <Metric label="Next payment estimate" value={loan.nextPaymentDueLabel} />
            <Metric label="Loan status" value={loan.statusLabel} />
            {loan.termMonths != null && (
              <Metric
                label="Term"
                value={`${loan.termMonths} mo · ${loan.monthlyPrincipalPercent?.toFixed(0) ?? "—"}%/mo`}
              />
            )}
          </div>

          <Section title="Interest guarantee schedule" className="mt-8">
            <LoanInterestGuaranteeScheduleTable schedule={loan.interestGuaranteeSchedule} />
          </Section>

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
          </td>
        </tr>
      )}
    </>
  );
}

function Metric({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "tabular mt-1 text-sm font-medium",
          emphasize && "text-base font-semibold text-gold",
        )}
      >
        {value}
      </div>
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