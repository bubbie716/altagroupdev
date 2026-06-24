import { AdminDataTable } from "@/components/internal/admin-data-table";
import { StatusBadge } from "@/components/internal/status-badge";
import { florin } from "@/lib/bank/api";
import type { LoanScheduleItemRow } from "@/lib/bank/lending-types";
import { formatDueDate } from "@/lib/format-datetime";

export function LoanPaymentScheduleTable({
  schedule,
  termMonths,
  monthlyPrincipalPercent,
}: {
  schedule: LoanScheduleItemRow[];
  termMonths: number | null;
  monthlyPrincipalPercent: number | null;
}) {
  if (!termMonths || schedule.length === 0) {
    return (
      <p className="text-[13px] text-muted-foreground">
        Payment schedule will appear once loan term is configured.
      </p>
    );
  }

  const percentLabel =
    monthlyPrincipalPercent != null
      ? `${monthlyPrincipalPercent % 1 === 0 ? monthlyPrincipalPercent.toFixed(0) : monthlyPrincipalPercent.toFixed(2)}%`
      : "—";

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-muted-foreground">
        {termMonths}-month term · equal {percentLabel} of principal per month plus projected monthly
        interest on the remaining balance.
      </p>
      <AdminDataTable
        columns={[
          {
            key: "installment",
            header: "#",
            cell: (row: LoanScheduleItemRow) => (
              <span className="font-mono text-[12px]">{row.installmentNumber}</span>
            ),
          },
          {
            key: "due",
            header: "Due date",
            cell: (row: LoanScheduleItemRow) => formatDueDate(row.dueDate),
          },
          {
            key: "principal",
            header: "Principal",
            cell: (row: LoanScheduleItemRow) => (
              <span className="type-finance">{florin(row.principalPortion)}</span>
            ),
          },
          {
            key: "interest",
            header: "Interest",
            cell: (row: LoanScheduleItemRow) => (
              <span className="type-finance">{florin(row.interestPortion)}</span>
            ),
          },
          {
            key: "amount",
            header: "Total due",
            cell: (row: LoanScheduleItemRow) => (
              <span className="type-finance font-medium">{florin(row.scheduledAmount)}</span>
            ),
          },
          {
            key: "status",
            header: "Status",
            cell: (row: LoanScheduleItemRow) => <StatusBadge status={row.statusLabel} />,
          },
        ]}
        rows={schedule}
        rowKey={(row) => row.id}
      />
    </div>
  );
}
