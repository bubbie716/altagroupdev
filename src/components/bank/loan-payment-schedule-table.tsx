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

  return (
    <div className="space-y-3">
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
            header: "Principal due",
            cell: (row: LoanScheduleItemRow) => (
              <span className="type-finance">{florin(row.principalPortion)}</span>
            ),
          },
          {
            key: "interest",
            header: "Estimated interest",
            cell: (row: LoanScheduleItemRow) => (
              <span className="type-finance">{florin(row.interestPortion)}</span>
            ),
          },
          {
            key: "amount",
            header: "Estimated payment",
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
      <p className="text-[12px] leading-relaxed text-muted-foreground">
        Estimated payments assume scheduled repayment. Early repayment reduces future interest.
      </p>
    </div>
  );
}
