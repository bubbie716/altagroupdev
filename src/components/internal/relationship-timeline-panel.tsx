"use client";

import { useState } from "react";
import { SUBMITTING_COPY } from "@/lib/ui/route-loading";
import { Link, useRouter } from "@tanstack/react-router";
import type { RelationshipTimelineEventRow } from "@/lib/bank/relationship-intelligence-types";
import {
  timelineEntityLink,
  timelineEventTypeLabel,
} from "@/lib/bank/relationship-timeline-display";
import {
  backfillRelationshipTimelineRecord,
  createManualRelationshipNoteRecord,
} from "@/lib/internal/relationship-intelligence.functions";
import { formatActivityDateTime } from "@/lib/format-datetime";

function EventBadge({ eventType }: { eventType: RelationshipTimelineEventRow["eventType"] }) {
  return (
    <span className="rounded border border-border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
      {timelineEventTypeLabel(eventType)}
    </span>
  );
}

export function RelationshipTimelinePanel({
  userId,
  timeline,
}: {
  userId: string;
  timeline: RelationshipTimelineEventRow[];
}) {
  const router = useRouter();
  const [backfilling, setBackfilling] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [submittingNote, setSubmittingNote] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleBackfill() {
    setBackfilling(true);
    setError(null);
    try {
      await backfillRelationshipTimelineRecord({ data: userId });
      await router.invalidate();
    } catch {
      setError("Could not backfill timeline.");
    } finally {
      setBackfilling(false);
    }
  }

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    setSubmittingNote(true);
    setError(null);
    try {
      await createManualRelationshipNoteRecord({
        data: { userId, title: noteTitle, body: noteBody },
      });
      setNoteTitle("");
      setNoteBody("");
      await router.invalidate();
    } catch {
      setError("Could not save manual note.");
    } finally {
      setSubmittingNote(false);
    }
  }

  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface-1/80 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Relationship timeline
          </h3>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Chronological history of the customer&apos;s Alta relationship — internal visibility.
          </p>
        </div>
        <button
          type="button"
          disabled={backfilling}
          onClick={() => void handleBackfill()}
          className="rounded-md border border-border bg-surface-2 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] hover:bg-surface-2/80 disabled:opacity-60"
        >
          {backfilling ? SUBMITTING_COPY.backfilling : "Backfill timeline"}
        </button>
      </div>

      {error ? <p className="mt-4 text-[13px] text-destructive">{error}</p> : null}

      {timeline.length === 0 ? (
        <p className="mt-6 text-[13px] text-muted-foreground">
          No timeline events yet. Backfill from existing platform records.
        </p>
      ) : (
        <ol className="mt-6 space-y-0 border-l border-border/60 pl-4">
          {timeline.map((event) => {
            const link = timelineEntityLink(event.relatedEntityType, event.relatedEntityId);
            return (
              <li key={event.id} className="relative pb-6 pl-4 last:pb-0">
                <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border border-gold/50 bg-surface-1" />
                <div className="flex flex-wrap items-center gap-2">
                  <EventBadge eventType={event.eventType} />
                  <time className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    {formatActivityDateTime(event.occurredAt)}
                  </time>
                </div>
                <h4 className="mt-1 break-words text-[15px] font-medium">{event.title}</h4>
                {event.description ? (
                  <p className="mt-1 break-words text-[13px] text-muted-foreground whitespace-pre-wrap">{event.description}</p>
                ) : null}
                {link ? (
                  <Link
                    to={link.to}
                    params={link.params}
                    className="mt-2 inline-block font-mono text-[10px] uppercase tracking-[0.14em] text-gold hover:underline"
                  >
                    {link.label} →
                  </Link>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}

      <form onSubmit={(e) => void handleAddNote(e)} className="mt-8 border-t border-border/60 pt-6">
        <h4 className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Manual relationship note
        </h4>
        <p className="mt-1 text-[12px] text-muted-foreground">Internal only — not shown to customers.</p>
        <div className="mt-4 space-y-3">
          <input
            value={noteTitle}
            onChange={(e) => setNoteTitle(e.target.value)}
            placeholder="Note title"
            className="w-full rounded border border-border bg-surface-2 px-3 py-2 text-[13px]"
          />
          <textarea
            value={noteBody}
            onChange={(e) => setNoteBody(e.target.value)}
            placeholder="Context, conversation summary, opportunity, or risk note…"
            rows={4}
            className="w-full rounded border border-border bg-surface-2 px-3 py-2 text-[13px]"
          />
          <button
            type="submit"
            disabled={submittingNote || !noteTitle.trim() || !noteBody.trim()}
            className="rounded border border-gold/40 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-gold hover:bg-gold/5 disabled:opacity-60"
          >
            {submittingNote ? SUBMITTING_COPY.saving : "Add manual note"}
          </button>
        </div>
      </form>
    </section>
  );
}
