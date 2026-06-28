import type { OpsTableSort } from "@/components/internal/console/ops-table";
import { queueAgeMs } from "./queue-utils";

export type QueueSortAccessor<T> = (row: T, key: string) => string | number;

export function sortQueueRows<T>(
  rows: T[],
  sort: OpsTableSort | null | undefined,
  accessor: QueueSortAccessor<T>,
): T[] {
  if (!sort) return rows;
  const copy = [...rows];
  copy.sort((a, b) => {
    const av = accessor(a, sort.key);
    const bv = accessor(b, sort.key);
    if (typeof av === "number" && typeof bv === "number") {
      return sort.direction === "asc" ? av - bv : bv - av;
    }
    const cmp = String(av).localeCompare(String(bv));
    return sort.direction === "asc" ? cmp : -cmp;
  });
  return copy;
}

/** Default accessor — age column sorts by elapsed ms (oldest first on asc). */
export function defaultQueueSortAccessor<T extends Record<string, unknown>>(
  row: T,
  key: string,
): string | number {
  if (key === "age") {
    const date =
      (row.submitted as string | undefined) ??
      (row.createdAt as string | undefined) ??
      (row.sortAt as string | undefined) ??
      (row.lastActivity as string | undefined) ??
      (row.lastUpdated as string | undefined);
    return date ? queueAgeMs(date) : 0;
  }
  const val = row[key];
  if (typeof val === "number") return val;
  return String(val ?? "");
}
