"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { OpsTableSkeleton } from "@/components/internal/console/ops-table-skeleton";
import { OpsEmptyState } from "@/components/internal/console/ops-empty-state";

export type OpsTableColumn<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  sortable?: boolean;
  className?: string;
};

export type OpsTableSort = {
  key: string;
  direction: "asc" | "desc";
};

export function OpsTable<T extends { id?: string }>({
  columns,
  rows,
  rowKey,
  sort,
  onSortChange,
  onRowClick,
  selectable = false,
  selectedIds,
  onSelectionChange,
  bulkActions,
  loading = false,
  emptyState = "No records.",
  filterSlot,
  className,
}: {
  columns: OpsTableColumn<T>[];
  rows: T[];
  rowKey?: (row: T, index: number) => string;
  sort?: OpsTableSort | null;
  onSortChange?: (sort: OpsTableSort | null) => void;
  onRowClick?: (row: T) => void;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  bulkActions?: ReactNode;
  loading?: boolean;
  emptyState?: ReactNode;
  filterSlot?: ReactNode;
  className?: string;
}) {
  const allSelected =
    selectable &&
    rows.length > 0 &&
    selectedIds != null &&
    rows.every((row, i) => selectedIds.has(resolveKey(row, i, rowKey)));

  function resolveKey(row: T, index: number, keyFn?: (row: T, index: number) => string) {
    return keyFn?.(row, index) ?? row.id ?? String(index);
  }

  function toggleAll() {
    if (!onSelectionChange || !selectable) return;
    if (allSelected) {
      onSelectionChange(new Set());
      return;
    }
    onSelectionChange(new Set(rows.map((row, i) => resolveKey(row, i, rowKey))));
  }

  function toggleRow(id: string) {
    if (!onSelectionChange || !selectedIds) return;
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  }

  function handleSort(key: string) {
    if (!onSortChange) return;
    if (sort?.key === key) {
      onSortChange(sort.direction === "asc" ? { key, direction: "desc" } : null);
      return;
    }
    onSortChange({ key, direction: "asc" });
  }

  return (
    <div className={cn("ops-table min-w-0", className)}>
      {(filterSlot || (selectable && selectedIds && selectedIds.size > 0 && bulkActions)) && (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          {filterSlot}
          {selectable && selectedIds && selectedIds.size > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                {selectedIds.size} selected
              </span>
              {bulkActions}
            </div>
          ) : null}
        </div>
      )}

      <div className="overflow-x-auto overscroll-x-contain rounded border border-border/80 bg-surface-1/30">
        {loading ? (
          <OpsTableSkeleton rows={4} cols={columns.length} />
        ) : rows.length === 0 ? (
          <OpsEmptyState
            title={typeof emptyState === "string" ? emptyState : "No records found."}
            className="border-0 bg-transparent"
          />
        ) : (
        <table className="w-full min-w-[640px] border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-border/80 bg-surface-2/40 text-left">
              {selectable ? (
                <th className="w-8 px-2 py-2">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Select all rows"
                    className="size-3.5 rounded border-border"
                  />
                </th>
              ) : null}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-3 py-2 font-mono text-[9px] font-medium uppercase tracking-[0.14em] text-muted-foreground",
                    col.sortable && onSortChange && "cursor-pointer select-none hover:text-foreground",
                    col.className,
                  )}
                  onClick={col.sortable && onSortChange ? () => handleSort(col.key) : undefined}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {sort?.key === col.key ? (
                      <span aria-hidden>{sort.direction === "asc" ? "↑" : "↓"}</span>
                    ) : null}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
                const id = resolveKey(row, index, rowKey);
                const selected = selectedIds?.has(id) ?? false;
                return (
                  <tr
                    key={id}
                    className={cn(
                      "border-b border-border/40 last:border-0",
                      onRowClick && "cursor-pointer hover:bg-surface-2/40",
                      selected && "bg-gold/5",
                    )}
                    onClick={
                      onRowClick
                        ? (e) => {
                            const target = e.target as HTMLElement;
                            if (target.closest("button,a,input,label")) return;
                            onRowClick(row);
                          }
                        : undefined
                    }
                  >
                    {selectable ? (
                      <td className="w-8 px-2 py-2" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleRow(id)}
                          aria-label={`Select row ${id}`}
                          className="size-3.5 rounded border-border"
                        />
                      </td>
                    ) : null}
                    {columns.map((col) => (
                      <td key={col.key} className={cn("px-3 py-2 align-top", col.className)}>
                        {col.cell(row)}
                      </td>
                    ))}
                  </tr>
                );
              })}
          </tbody>
        </table>
        )}
      </div>
    </div>
  );
}
