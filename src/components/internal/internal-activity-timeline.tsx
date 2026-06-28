import { Link } from "@tanstack/react-router";
import type { TimelineEvent } from "@/lib/internal/ops-types";
import { formatActivityDateTime } from "@/lib/format-datetime";
import { AccountActivityLink } from "@/components/internal/internal-audit-table";

export function InternalActivityTimeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return <p className="text-[13px] text-muted-foreground">No activity recorded yet.</p>;
  }

  return (
    <ol className="space-y-3 border-l border-border/60 pl-4">
      {events.map((e) => (
        <li key={e.id} className="relative">
          <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-gold/70" />
          <div className="text-[13px] font-medium">
            {e.href ? (
              <Link to={e.href} className="hover:text-gold">
                {e.title}
              </Link>
            ) : (
              e.title
            )}
          </div>
          <div className="text-[12px] text-muted-foreground">{e.detail}</div>
          {e.accountId && e.accountLabel ? (
            <div className="mt-1">
              <AccountActivityLink accountId={e.accountId} label={e.accountLabel} />
            </div>
          ) : null}
          <div className="mt-0.5 font-mono text-[10px] text-muted-foreground/80">
            {formatActivityDateTime(e.createdAt)}
            {e.actorLabel ? ` · ${e.actorLabel}` : ""}
          </div>
        </li>
      ))}
    </ol>
  );
}
