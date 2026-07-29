import type { OpsReportRow } from "@/lib/internal/ops-report.types";

export function partitionReportRows(reports: OpsReportRow[]): {
  active: OpsReportRow[];
  zero: OpsReportRow[];
} {
  const active: OpsReportRow[] = [];
  const zero: OpsReportRow[] = [];
  for (const row of reports) {
    if (row.count > 0 || row.totalAmount > 0) active.push(row);
    else zero.push(row);
  }
  return { active, zero };
}
