import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function WorkspaceFieldGrid({
  children,
  columns = 3,
  className,
}: {
  children: ReactNode;
  columns?: 2 | 3 | 4;
  className?: string;
}) {
  return (
    <dl
      className={cn(
        "grid gap-x-4 gap-y-2 text-[12px]",
        columns === 2 && "sm:grid-cols-2",
        columns === 3 && "sm:grid-cols-2 lg:grid-cols-3",
        columns === 4 && "sm:grid-cols-2 lg:grid-cols-4",
        className,
      )}
    >
      {children}
    </dl>
  );
}

export function WorkspaceField({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 min-w-0 break-words">{children}</dd>
    </div>
  );
}

export function WorkspaceSection({
  title,
  children,
  actions,
}: {
  title?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="rounded border border-border/70 bg-surface-1/30 px-3 py-2.5">
      {(title || actions) && (
        <div className="mb-2 flex items-center justify-between gap-2">
          {title ? (
            <h3 className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">{title}</h3>
          ) : (
            <span />
          )}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function WorkspaceCompactTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: ReactNode[][];
}) {
  if (rows.length === 0) {
    return <p className="text-[11px] text-muted-foreground">None on file.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] border-collapse text-[12px]">
        <thead>
          <tr className="border-b border-border/60 text-left">
            {headers.map((h) => (
              <th
                key={h}
                className="px-2 py-1.5 font-mono text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr key={i} className="border-b border-border/30 last:border-0">
              {cells.map((cell, j) => (
                <td key={j} className="px-2 py-1.5 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
