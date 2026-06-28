import type { ReactNode } from "react";
import { OpsEmptyState } from "@/components/internal/console/ops-empty-state";
import { OpsTableSkeleton } from "@/components/internal/console/ops-table-skeleton";

export type AdminTableColumn<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
};

/** Legacy table wrapper — matches OpsTable styling; prefer OpsTable for new pages. */
export function AdminDataTable<T extends Record<string, unknown> | object>({
  columns,
  rows,
  rowKey,
  emptyState = "No records found.",
  loading = false,
}: {
  columns: AdminTableColumn<T>[];
  rows: T[];
  rowKey?: (row: T, index: number) => string;
  emptyState?: ReactNode;
  loading?: boolean;
}) {
  if (loading) {
    return <OpsTableSkeleton rows={5} cols={Math.min(columns.length, 6)} />;
  }

  if (rows.length === 0) {
    return (
      <OpsEmptyState
        title={typeof emptyState === "string" ? emptyState : "No records found."}
      />
    );
  }

  return (
    <div className="min-w-0 max-w-full overflow-hidden rounded border border-border/80 bg-surface-1/30">
      <div className="max-w-full min-w-0 overflow-x-auto overscroll-x-contain">
        <table className="w-full min-w-[640px] border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-border/80 bg-surface-2/40 text-left">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-3 py-2 font-mono text-[9px] font-medium uppercase tracking-[0.14em] text-muted-foreground ${col.className ?? ""}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={rowKey?.(row, i) ?? (row as { id?: string }).id ?? i}
                className="border-b border-border/40 last:border-0 hover:bg-surface-2/30"
              >
                {columns.map((col) => (
                  <td key={col.key} className={`px-3 py-2 align-top ${col.className ?? ""}`}>
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
