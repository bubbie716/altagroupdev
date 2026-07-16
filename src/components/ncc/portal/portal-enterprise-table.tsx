import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export type PortalTableColumn<T> = {
  key: string;
  header: string;
  className?: string;
  headerClassName?: string;
  render: (row: T) => ReactNode;
};

export function PortalEnterpriseTable<T extends { id: string }>({
  columns,
  rows,
  emptyTitle = "No records",
  emptyDescription = "There is nothing to display yet.",
  loading = false,
  onRowClick,
  stickyHeader = true,
}: {
  columns: PortalTableColumn<T>[];
  rows: T[];
  emptyTitle?: string;
  emptyDescription?: string;
  loading?: boolean;
  onRowClick?: (row: T) => void;
  stickyHeader?: boolean;
}) {
  if (loading) {
    return (
      <div className="overflow-hidden rounded-sm border border-[#e5e7eb] bg-white" aria-busy="true">
        <div className="space-y-0 divide-y divide-[#e5e7eb]">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-4 px-4 py-3">
              <Skeleton className="h-3 w-28 rounded" />
              <Skeleton className="h-3 w-40 rounded" />
              <Skeleton className="h-3 flex-1 rounded" />
              <Skeleton className="h-3 w-20 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-sm border border-dashed border-[#e5e7eb] bg-[#f9fafb] px-6 py-12 text-center">
        <div className="text-[13px] font-semibold text-[#111827]">{emptyTitle}</div>
        <p className="mt-1 text-[12px] text-[#6b7280]">{emptyDescription}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-sm border border-[#e5e7eb] bg-white shadow-sm">
      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-[12px]">
          <thead
            className={cn(
              "border-b border-[#e5e7eb] bg-[#f9fafb]",
              stickyHeader && "sticky top-0 z-10",
            )}
          >
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    "px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6b7280]",
                    column.headerClassName,
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className={cn(
                  "border-b border-[#f3f4f6] last:border-0",
                  onRowClick && "cursor-pointer hover:bg-[#f9fafb]",
                )}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={
                  onRowClick
                    ? (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onRowClick(row);
                        }
                      }
                    : undefined
                }
                tabIndex={onRowClick ? 0 : undefined}
              >
                {columns.map((column) => (
                  <td key={column.key} className={cn("px-4 py-3 align-middle text-[#111827]", column.className)}>
                    {column.render(row)}
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
