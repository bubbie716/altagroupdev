import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Florin } from "@/components/ui/florin";
import { StatusBadge } from "@/components/internal/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { RouteButton } from "@/components/bank/route-button";
import { applicationListStatusLabel } from "@/lib/bank/loan-application-thread-types";
import type { LoanApplicationRow } from "@/lib/bank/lending-types";
import { formatActivityDateTime } from "@/lib/format-datetime";
import { cn } from "@/lib/utils";
import { useCreditDeskCustomerNav } from "@/hooks/use-credit-desk-nav";

type DisplayFilter = "all" | "waiting_on_alta" | "waiting_on_you" | "accepted" | "denied";

const FILTERS: Array<{ id: DisplayFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "waiting_on_alta", label: "Waiting on Alta" },
  { id: "waiting_on_you", label: "Waiting on You" },
  { id: "accepted", label: "Accepted" },
  { id: "denied", label: "Denied" },
];

function matchesDisplayFilter(a: LoanApplicationRow, filter: DisplayFilter): boolean {
  if (filter === "all") return true;
  if (filter === "accepted") return a.status === "approved";
  if (filter === "denied") return a.status === "denied" || a.status === "cancelled";
  if (a.status !== "pending" && a.status !== "under_review") return false;
  const thread = a.threadStatus ?? "waiting_on_alta";
  if (filter === "waiting_on_you") return thread === "waiting_on_applicant";
  return thread === "open" || thread === "waiting_on_alta" || thread === "closed";
}

export function LendingApplicationsList({ applications }: { applications: LoanApplicationRow[] }) {
  const [filter, setFilter] = useState<DisplayFilter>("all");
  const creditDeskNav = useCreditDeskCustomerNav();

  const counts = useMemo(() => {
    const c = { total: applications.length, waitingOnAlta: 0, waitingOnYou: 0, accepted: 0, denied: 0 };
    for (const a of applications) {
      if (a.status === "approved") c.accepted++;
      else if (a.status === "denied" || a.status === "cancelled") c.denied++;
      else if (matchesDisplayFilter(a, "waiting_on_you")) c.waitingOnYou++;
      else if (matchesDisplayFilter(a, "waiting_on_alta")) c.waitingOnAlta++;
    }
    return c;
  }, [applications]);

  const filtered = applications.filter((a) => matchesDisplayFilter(a, filter));

  if (applications.length === 0) {
    return (
      <EmptyState
        tag="No applications"
        title="No facility requests on file"
        description="When you submit a credit application it appears here with review status and a link to your Secure Deal Room."
        action={
          creditDeskNav.showApplyEntryPoints ? (
          <RouteButton
            to="/bank/lending/apply"
            className="rounded-md bg-foreground px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-background hover:bg-foreground/90"
          >
            Apply for credit
          </RouteButton>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <dl className="grid min-w-0 grid-cols-1 divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface-1/80 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-5">
        <Stat label="Submitted" value={String(counts.total)} />
        <Stat label="Waiting on Alta" value={String(counts.waitingOnAlta)} />
        <Stat label="Waiting on You" value={String(counts.waitingOnYou)} />
        <Stat label="Accepted" value={String(counts.accepted)} />
        <Stat label="Denied" value={String(counts.denied)} />
      </dl>

      <div className="min-w-0 overflow-x-auto overscroll-x-contain">
        <div className="flex w-max min-w-full gap-2 pb-1 sm:w-auto sm:flex-wrap">
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
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          tag="No matches"
          title="No applications match this filter"
          description="Adjust the filter above to see other facility requests."
          size="compact"
        />
      ) : (
        <ul className="overflow-x-auto rounded-xl border border-border bg-surface-1 divide-y divide-border">
          {filtered.map((a) => (
            <li key={a.id} className="min-w-[44rem]">
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
    <div className="grid gap-4 px-6 py-6 sm:min-w-[44rem] sm:grid-cols-[minmax(0,1fr)_11rem_12rem_minmax(16rem,1.2fr)] sm:items-center sm:gap-x-10 sm:px-8 lg:gap-x-14">
      <div className="min-w-0 pr-2">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          <span>{a.id.slice(0, 8)}</span>
          <span aria-hidden>·</span>
          <span>{formatActivityDateTime(a.submittedAt)}</span>
        </div>
        <h3 className="mt-1.5 font-serif text-[18px] leading-snug tracking-tight">{a.productLabel}</h3>
        <p className="mt-1 text-[13px] leading-snug text-muted-foreground">{a.companyName ?? "Personal"}</p>
      </div>

      <div className="sm:text-right">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Requested
        </div>
        <div className="mt-1.5 text-[15px] tabular-nums">
          <Florin value={a.requestedAmount} fractionDigits={0} />
        </div>
        <div className="mt-1.5 space-y-0.5 font-mono text-[11px] leading-snug text-muted-foreground tabular-nums sm:ml-auto">
          <div>{a.termMonths} mo</div>
          {a.estimatedTotalOutstanding != null ? (
            <div>
              est. <Florin value={a.estimatedTotalOutstanding} fractionDigits={0} />
            </div>
          ) : null}
        </div>
      </div>

      <div className="sm:flex sm:flex-col sm:items-end sm:pl-2">
        <StatusBadge status={applicationListStatusLabel(a, "user")} />
        <div className="mt-2.5">
          <Link
            to="/bank/lending/applications/$applicationId/thread"
            params={{ applicationId: a.id }}
            className="font-mono text-[10px] uppercase leading-snug tracking-[0.14em] text-gold hover:underline"
          >
            {a.threadId ? "View Secure Deal Room" : "View application"}
          </Link>
        </div>
      </div>

      <div className="hidden min-w-0 pl-2 sm:block sm:text-right">
        <div className="text-[12px] leading-relaxed text-muted-foreground">
          {a.linkedAccountLabel ?? "—"}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 px-5 py-4">
      <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</dt>
      <dd className="mt-1 truncate font-serif text-[22px] tracking-tight tabular">{value}</dd>
    </div>
  );
}
