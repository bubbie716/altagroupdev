import { Card } from "@/components/page-shell";
import type { ReactNode } from "react";
import { type } from "@/lib/typography";

export type AdminTableColumn<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
};

export function AdminDataTable<T extends Record<string, unknown> | object>({
  columns,
  rows,
  rowKey,
}: {
  columns: AdminTableColumn<T>[];
  rows: T[];
  rowKey?: (row: T, index: number) => string;
}) {
  return (
    <Card className="!p-0 overflow-x-auto">
      <table className="alta-table w-full min-w-[640px] text-sm">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} className={col.className}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={rowKey?.(row, i) ?? (row as { id?: string }).id ?? i}>
              {columns.map((col) => (
                <td key={col.key} className={col.className}>
                  {col.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
