import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { NCC } from "@/lib/ncc/ncc-tokens";

export type NccStatus =
  | "operational"
  | "pending"
  | "restricted"
  | "suspended"
  | "offline"
  | "queued"
  | "completed"
  | "warning";

const statusStyles: Record<NccStatus, string> = {
  operational: "bg-[#ecfdf3] text-[#15803d] border-[#bbf7d0]",
  completed: "bg-[#ecfdf3] text-[#15803d] border-[#bbf7d0]",
  pending: "bg-[#fefce8] text-[#a16207] border-[#fef08a]",
  queued: "bg-[#fefce8] text-[#a16207] border-[#fef08a]",
  warning: "bg-[#fefce8] text-[#a16207] border-[#fef08a]",
  restricted: "bg-[#fef2f2] text-[#b91c1c] border-[#fecaca]",
  suspended: "bg-[#fef2f2] text-[#b91c1c] border-[#fecaca]",
  offline: "bg-[#f3f4f6] text-[#6b7280] border-[#e5e7eb]",
};

export function NccBadge({
  status,
  label,
  className,
}: {
  status: NccStatus;
  label?: string;
  className?: string;
}) {
  const text =
    label ??
    status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide",
        statusStyles[status],
        className,
      )}
    >
      {(status === "operational" || status === "completed") && (
        <span className="size-1.5 rounded-full bg-[#15803d]" aria-hidden />
      )}
      {text}
    </span>
  );
}

export function NccButton({
  children,
  variant = "primary",
  className,
  href,
  onClick,
  type = "button",
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
  href?: string;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  const base =
    "inline-flex items-center justify-center rounded-sm px-4 py-2.5 text-[13px] font-medium transition-colors";
  const variants = {
    primary: "bg-[#0c4d32] text-white hover:bg-[#083d28]",
    secondary: "border border-[#e5e7eb] bg-white text-[#111827] hover:bg-[#f9fafb]",
    ghost: "text-[#374151] hover:bg-[#f3f4f6]",
  };

  const classes = cn(base, variants[variant], className);

  if (href) {
    return (
      <a href={href} className={classes}>
        {children}
      </a>
    );
  }

  return (
    <button type={type} onClick={onClick} className={classes}>
      {children}
    </button>
  );
}

export function NccCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-sm border border-[#e5e7eb] bg-white p-5 shadow-sm", className)}>
      {children}
    </div>
  );
}

export function NccSectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-[#e5e7eb] pb-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-[#111827]">{title}</h2>
        {description ? (
          <p className="mt-1 max-w-2xl text-[14px] leading-relaxed text-[#6b7280]">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function NccStatGrid({
  stats,
}: {
  stats: ReadonlyArray<{ label: string; value: string; status?: NccStatus }>;
}) {
  return (
    <div className="grid gap-px overflow-hidden rounded-sm border border-[#e5e7eb] bg-[#e5e7eb] sm:grid-cols-2 lg:grid-cols-5">
      {stats.map((stat) => (
        <div key={stat.label} className="bg-white px-5 py-4">
          <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#6b7280]">
            {stat.label}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-2xl font-semibold tabular-nums tracking-tight text-[#111827]">
              {stat.value}
            </span>
            {stat.status ? <NccBadge status={stat.status} /> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

export function NccDataTable({
  columns,
  rows,
}: {
  columns: Array<{ key: string; header: string; className?: string }>;
  rows: Array<Record<string, ReactNode>>;
}) {
  return (
    <div className="overflow-x-auto rounded-sm border border-[#e5e7eb]">
      <table className="w-full min-w-[640px] border-collapse text-left text-[13px]">
        <thead>
          <tr className="border-b border-[#e5e7eb] bg-[#f9fafb]">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  "px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6b7280]",
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
            <tr key={i} className="border-b border-[#f3f4f6] last:border-0">
              {columns.map((col) => (
                <td key={col.key} className={cn("px-4 py-3 text-[#374151]", col.className)}>
                  {row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function NccPageContainer({
  children,
  className,
  wide,
}: {
  children: ReactNode;
  className?: string;
  wide?: boolean;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-6 py-10 sm:px-8 lg:py-14",
        wide ? "max-w-[1400px]" : "max-w-[1200px]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function NccHero({
  title,
  subtitle,
  tags,
  primaryAction,
  secondaryAction,
}: {
  title: string;
  subtitle: string;
  tags?: string[];
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
}) {
  return (
    <section className="border-b border-[#e5e7eb] bg-white">
      <NccPageContainer className="py-16 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-start">
          <div className="max-w-3xl">
            <h1 className="text-[clamp(2rem,4vw,3rem)] font-semibold leading-[1.08] tracking-tight text-[#111827]">
              {title}
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-[#4b5563]">{subtitle}</p>
            {tags?.length ? (
              <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[12px] font-medium uppercase tracking-[0.14em] text-[#6b7280]">
                {tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
            ) : null}
            {(primaryAction || secondaryAction) && (
              <div className="mt-8 flex flex-wrap gap-3">
                {primaryAction}
                {secondaryAction}
              </div>
            )}
          </div>
          <div className="hidden justify-center lg:flex">
            <img
              src="/ncc-bridge-logo.png"
              alt=""
              className="h-32 w-32 object-contain opacity-95"
              aria-hidden
            />
          </div>
        </div>
      </NccPageContainer>
    </section>
  );
}
