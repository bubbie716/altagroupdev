import { Link } from "@tanstack/react-router";
import type { CompanyRelationshipTimelineEventRow } from "@/lib/bank/company-relationship-intelligence-types";
import { formatActivityDateTime } from "@/lib/format-datetime";

export function CompanyRelationshipTimelinePanel({
  timeline,
}: {
  companyId: string;
  timeline: CompanyRelationshipTimelineEventRow[];
}) {
  return (
    <section className="rounded-xl border border-border bg-surface-1/80 p-5">
      <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        Company relationship timeline
      </h3>
      <p className="mt-1 text-[12px] text-muted-foreground">Business-only events — not mixed with owner personal history.</p>

      {timeline.length === 0 ? (
        <p className="mt-4 text-[13px] text-muted-foreground">No timeline events yet. Backfill from company records.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {timeline.map((event) => (
            <li key={event.id} className="border-b border-border/50 pb-3 last:border-0">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-[14px] font-medium">{event.title}</p>
                <time className="font-mono text-[10px] text-muted-foreground">
                  {formatActivityDateTime(event.occurredAt)}
                </time>
              </div>
              {event.description ? (
                <p className="mt-1 text-[13px] text-muted-foreground">{event.description}</p>
              ) : null}
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                {event.eventType.replace(/_/g, " ")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function CompanyRelationshipSummaryCard({
  companyId,
  companyName,
  score,
  tier,
  totalBusinessAssets,
  commercialEligible,
}: {
  companyId: string;
  companyName: string;
  score: number;
  tier: string;
  totalBusinessAssets: number;
  commercialEligible: boolean;
}) {
  return (
    <section className="rounded-xl border border-border bg-surface-1/80 p-5">
      <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        Company relationship intelligence
      </h3>
      <p className="mt-1 text-[13px] font-medium">{companyName}</p>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2 text-[14px]">
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Score</dt>
          <dd className="mt-1 tabular-nums">{score}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Tier</dt>
          <dd className="mt-1">{tier}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Business assets</dt>
          <dd className="mt-1 tabular-nums">{totalBusinessAssets.toLocaleString()}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Commercial eligible</dt>
          <dd className="mt-1">{commercialEligible ? "Yes" : "No"}</dd>
        </div>
      </dl>
      <Link
        to="/internal/companies/$companyId/relationship"
        params={{ companyId }}
        className="mt-4 inline-block font-mono text-[10px] uppercase tracking-[0.14em] text-gold hover:underline"
      >
        Full company profile →
      </Link>
    </section>
  );
}
