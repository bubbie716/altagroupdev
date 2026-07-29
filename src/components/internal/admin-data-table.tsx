"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { OPS_COPY } from "@/lib/internal/console/ops-copy";
import { OpsEmptyState } from "@/components/internal/console/ops-empty-state";
import { OpsTableSkeleton } from "@/components/internal/console/ops-table-skeleton";

export type AdminTableColumn<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
  stickyEnd?: boolean;
};

/** Legacy table wrapper — matches OpsTable styling; prefer OpsTable for new pages. */
export function AdminDataTable<T extends Record<string, unknown> | object>({
  columns,
  rows,
  rowKey,
  emptyState = OPS_COPY.noResults,
  loading = false,
}: {
  columns: AdminTableColumn<T>[];
  rows: T[];
  rowKey?: (row: T, index: number) => string;
  emptyState?: ReactNode;
  loading?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollX, setCanScrollX] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    function update() {
      if (!el) return;
      setCanScrollX(el.scrollWidth > el.clientWidth + 2);
    }
    update();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(el);
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      ro?.disconnect();
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [rows.length, columns.length, loading]);

  if (loading) {
    return <OpsTableSkeleton rows={5} cols={Math.min(columns.length, 6)} />;
  }

  if (rows.length === 0) {
    return (
      <OpsEmptyState
        title={typeof emptyState === "string" ? emptyState : OPS_COPY.noResults}
      />
    );
  }

  const stickyKey = columns.find((c) => c.stickyEnd || c.key === "actions")?.key;

  return (
    <div
      className="ops-table-scroll min-w-0 max-w-full overflow-hidden rounded border border-border/80 bg-surface-1/30"
      data-can-scroll-x={canScrollX ? "true" : "false"}
    >
      <p className="ops-table-scroll-hint border-b border-border/50 px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
        Scroll horizontally for more columns and actions
      </p>
      <div
        ref={scrollRef}
        className="max-h-[calc(100dvh-14rem)] max-w-full min-w-0 overflow-auto overscroll-contain"
      >
        <table className="w-full min-w-[640px] border-collapse text-[12px]">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-border/80 bg-surface-2/80 text-left backdrop-blur">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-3 py-2.5 font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-muted-foreground/90",
                    (col.stickyEnd || col.key === stickyKey) && "ops-table-col-sticky-end",
                    col.className,
                  )}
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
                className={`border-b border-border/40 last:border-0 transition-colors hover:bg-gold/[0.04] ${i % 2 === 1 ? "bg-surface-1/20" : ""}`}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      "px-3 py-2 align-top",
                      (col.stickyEnd || col.key === stickyKey) && "ops-table-col-sticky-end",
                      col.className,
                    )}
                  >
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
