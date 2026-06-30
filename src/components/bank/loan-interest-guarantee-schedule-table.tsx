import { AdminDataTable } from "@/components/internal/admin-data-table";
import { LoanScheduleStatusBadge } from "@/components/bank/loan-schedule-status-badge";
import { ScheduleRemainingDueCell } from "@/components/bank/loan-schedule-remaining-cell";
import { florin } from "@/lib/bank/api";
import type { LoanInterestScheduleItemRow } from "@/lib/bank/lending-types";
import { formatDueDate } from "@/lib/format-datetime";
import { formatActivityDateTime } from "@/lib/format-datetime";

export function LoanInterestGuaranteeScheduleTable({
  schedule,
}: {
  schedule: LoanInterestScheduleItemRow[];
}) {
  if (schedule.length === 0) {
    return (
      <p className="text-[13px] text-muted-foreground">
        Interest guarantee schedule will appear once the loan is disbursed.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <AdminDataTable
        columns={[
          {
            key: "month",
            header: "Month",
            cell: (row: LoanInterestScheduleItemRow) => (
              <span className="font-mono text-[12px]">{row.installmentNumber}</span>
            ),
          },
          {
            key: "guaranteeDate",
            header: "Guarantee date",
            cell: (row: LoanInterestScheduleItemRow) => formatDueDate(row.guaranteeDate),
          },
          {
            key: "amount",
            header: "Interest amount",
            cell: (row: LoanInterestScheduleItemRow) => (
              <span className="type-finance">{florin(row.interestAmount)}</span>
            ),
          },
          {
            key: "remaining",
            header: "Remaining due",
            cell: (row: LoanInterestScheduleItemRow) => (
              <ScheduleRemainingDueCell
                totalAmount={row.interestAmount}
                paidAmount={row.paidAmount}
                status={row.status}
              />
            ),
          },
          {
            key: "status",
            header: "Status",
            cell: (row: LoanInterestScheduleItemRow) => (
              <LoanScheduleStatusBadge status={row.status} statusLabel={row.statusLabel} />
            ),
          },
          {
            key: "paidAt",
            header: "Paid date",
            cell: (row: LoanInterestScheduleItemRow) =>
              row.paidAt ? formatActivityDateTime(row.paidAt) : "—",
          },
        ]}
        rows={schedule}
        rowKey={(row) => row.id}
      />
      <p className="text-[12px] leading-relaxed text-muted-foreground">
        Interest guarantees monthly. Early repayment avoids future pending interest but does not waive
        interest already guaranteed.
      </p>
    </div>
  );
}
