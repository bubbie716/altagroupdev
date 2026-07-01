import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Florin } from "@/components/ui/florin";
import type { UserBankSummary } from "@/lib/bank/backend-types";
import { cn } from "@/lib/utils";

export function RelationshipProfileSection({
  index,
  title,
  kicker,
  className,
  children,
}: {
  index: string;
  title: string;
  kicker?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={className}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border/40 pb-4 sm:mb-8">
        <div className="flex items-baseline gap-4 sm:gap-6">
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-gold">{index}</span>
          <div className="min-w-0">
            {kicker ? (
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                {kicker}
              </div>
            ) : null}
            <h2 className="mt-1 font-serif text-2xl tracking-tight sm:text-3xl">{title}</h2>
          </div>
        </div>
      </div>
      {children}
    </section>
  );
}

export function RelationshipSnapshotAside({
  rows,
  footer,
}: {
  rows: Array<{ label: string; value: ReactNode }>;
  footer?: ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between bg-surface-1 px-6 py-8 sm:px-8 sm:py-10">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">
          Relationship snapshot
        </div>
        <div className="mt-5 space-y-4">
          {rows.map((row) => (
            <RelationshipSnapshotRow key={row.label} label={row.label} value={row.value} />
          ))}
        </div>
      </div>
      {footer ? (
        <div className="mt-8 border-t border-border/60 pt-4 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

export function RelationshipSnapshotRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/50 pb-3 last:border-0 last:pb-0">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </span>
      <span className="font-serif text-[15px] tracking-tight text-foreground">{value}</span>
    </div>
  );
}

export function RelationshipMetricCell({
  label,
  value,
  note,
}: {
  label: string;
  value: ReactNode;
  note?: string;
}) {
  return (
    <div className="flex h-full flex-col justify-between bg-surface-1 px-5 py-5 sm:px-6 sm:py-6">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-4 font-serif text-xl leading-tight tracking-tight sm:text-2xl">
        {value}
      </div>
      {note ? (
        <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {note}
        </div>
      ) : null}
    </div>
  );
}

export function RelationshipInformationPanel({
  summary,
  linkTo,
  linkLabel,
}: {
  summary: UserBankSummary;
  linkTo: string;
  linkLabel: string;
}) {
  return (
    <>
      <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
        <RelationshipMetricCell label="Total balance" value={<Florin value={summary.totalBalance} />} />
        <RelationshipMetricCell label="Active accounts" value={String(summary.activeAccountCount)} />
        <RelationshipMetricCell label="Pending accounts" value={String(summary.pendingAccountCount)} />
        <RelationshipMetricCell
          label="Pending activity"
          value={String(summary.pendingDepositCount + summary.pendingWithdrawalCount)}
          note={`${summary.pendingDepositCount} dep · ${summary.pendingWithdrawalCount} wd`}
        />
      </div>
      <div className="mt-4 flex justify-end">
        <Link
          to={linkTo}
          className="font-mono text-[10px] uppercase tracking-[0.2em] text-foreground hover:text-gold"
        >
          {linkLabel}
        </Link>
      </div>
    </>
  );
}

export function RelationshipIdentityCard({
  className,
  primary,
  snapshot,
}: {
  className?: string;
  primary: ReactNode;
  snapshot: ReactNode;
}) {
  return (
    <section className={cn("relative overflow-hidden rounded-xl border border-border bg-surface-1", className)}>
      <div className="h-px w-full bg-linear-to-r from-transparent via-gold/50 to-transparent" />
      <div className="grid gap-px bg-border/60 sm:grid-cols-[1.4fr_1fr]">
        {primary}
        {snapshot}
      </div>
    </section>
  );
}
