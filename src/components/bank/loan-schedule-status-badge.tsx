import { OpsStatusBadge } from "@/components/internal/console/ops-status-badge";
import type { OpsStatusTone } from "@/lib/internal/console/ops-status";

function toneForLoanScheduleStatus(status: string): OpsStatusTone {
  switch (status) {
    case "paid":
      return "success";
    case "overdue":
    case "failed":
      return "danger";
    case "pending":
      return "warning";
    case "partial":
      return "gold";
    case "guaranteed":
      return "info";
    case "waived":
      return "neutral";
    default:
      return "neutral";
  }
}

export function LoanScheduleStatusBadge({
  status,
  statusLabel,
}: {
  status: string;
  statusLabel: string;
}) {
  return (
    <OpsStatusBadge
      status={statusLabel}
      tone={toneForLoanScheduleStatus(status)}
      normalize={false}
    />
  );
}
