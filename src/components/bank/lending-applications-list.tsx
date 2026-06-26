import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Florin } from "@/components/ui/florin";
import { StatusBadge } from "@/components/internal/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { RouteButton } from "@/components/bank/route-button";
import { applicationListStatusLabel } from "@/lib/bank/loan-application-thread-types";
import type { LoanApplicationRow, LoanApplicationStatusCode } from "@/lib/bank/lending-types";
import { formatActivityDateTime } from "@/lib/format-datetime";
import { cn } from "@/lib/utils";

type Filter = "all" | LoanApplicationStatusCode;

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "under_review", label: "Under review" },
  { id: "approved", label: "Approved" },
  { id: "denied", label: "Declined" },
  { id: "cancelled", label: "Cancelled" },
];

export function LendingApplicationsList({ applications }: { applications: LoanApplicationRow[] }) {
  const [filter, setFilter] = useState<Filter>("all");

  const counts = useMemo(() => {
    const c = { total: applications.length, under: 0, approved: 0, denied: 0 };
    for (const a of applications) {
      if (a.status === "under_review" || a.status === "pending") c.under++;
      if (a.status === "approved") c.approved++;
      if (a.status === "denied") c.denied++;
    }
    return c;
  }, [applications]);

  const filtered = filter === "all" ? applications : applications.filter((a) => a.status === filter);

  if (applications.length === 0) {
    return (
      <EmptyState
        tag="No applications"
        title="No facility requests on file"
        description="When you submit a credit application it appears here with live review status from the Alta Bank desk."
        action={
          <RouteButton
            to="/bank/lending/apply"
            className="rounded-md bg-foreground px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-background hover:bg-foreground/90"
          >
            Apply for credit
          </RouteButton>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Stat strip */}
      <dl className="grid grid-cols-2 divide-x divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface-1/80 sm:grid-cols-4 sm:divide-y-0">
        <Stat label="Submitted" value={String(counts.total)} />
        <Stat label="In review" value={String(counts.under)} />
        <Stat label="Approved" value={String(counts.approved)} />
        <Stat label="Declined" value={String(counts.denied)} />
      </dl>

      {/* Filter chips */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {FILTERS.map((f) => {
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors",
                active
                  ? "border-gold/60 bg-gold/10 text-gold"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          tag="No matches"
          title="No applications match this filter"
          description="Adjust the filter above to see other facility requests."
          size="compact"
        />
      ) : (
        <ul className="overflow-hidden rounded-xl border border-border bg-surface-1 divide-y divide-border">
          {filtered.map((a) => (
            <li key={a.id}>
              <ApplicationRow a={a} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ApplicationRow({ a }: { a: LoanApplicationRow }) {
  return (
    <div className="grid gap-3 px-5 py-5 sm:grid-cols-[1.4fr_0.9fr_0.7fr_auto] sm:items-center sm:gap-6 sm:px-6">
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          <span>{a.id.slice(0, 8)}</span>
          <span aria-hidden>·</span>
          <span>{formatActivityDateTime(a.submittedAt)}</span>
        </div>
        <h3 className="mt-1 font-serif text-[18px] leading-tight tracking-tight">{a.productLabel}</h3>
        <p className="mt-0.5 text-[13px] text-muted-foreground">{a.companyName ?? "Personal"}</p>
        {a.reviewNote && (
          <p className="mt-2 line-clamp-2 max-w-prose text-[12px] text-muted-foreground/90">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold/80">Officer note · </span>
            {a.reviewNote}
          </p>
        )}
      </div>

      <div className="sm:text-right">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Requested
        </div>
        <div className="mt-1 text-[15px]">
          <Florin value={a.requestedAmount} fractionDigits={0} />
        </div>
        <div className="mt-1 tabular font-mono text-[11px] text-muted-foreground">
          {a.termMonths} mo
          {a.estimatedTotalOutstanding != null && (
            <>
              {" · est. "}
              <Florin value={a.estimatedTotalOutstanding} fractionDigits={0} />
            </>
          )}
        </div>
      </div>

      <div className="sm:text-right">
        <StatusBadge status={applicationListStatusLabel(a, "user")} />
        <div className="mt-2">
          <Link
            to="/bank/lending/applications/$applicationId/thread"
            params={{ applicationId: a.id }}
            className="font-mono text-[10px] uppercase tracking-[0.14em] text-gold hover:underline"
          >
            {a.threadId ? "Open Chat" : "View application"}
          </Link>
        </div>
      </div>

      <div className="hidden sm:block sm:text-right">
        {a.linkedAccountLabel ? (
          <div className="text-[12px] text-muted-foreground">{a.linkedAccountLabel}</div>
        ) : null}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-5 py-4">
      <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-serif text-[22px] tracking-tight tabular">{value}</dd>
    </div>
  );
}