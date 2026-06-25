import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import type { InternalNoteTargetType } from "@prisma/client";
import { Card } from "@/components/page-shell";
import { formatActivityDateTime } from "@/lib/format-datetime";
import {
  createInternalNoteRecord,
  fetchInternalNotes,
} from "@/lib/internal/internal-note.functions";
import type { InternalNoteRow } from "@/lib/internal/internal-note.types";

export function InternalNotePanel({
  targetType,
  targetId,
  initialNotes,
}: {
  targetType: InternalNoteTargetType;
  targetId: string;
  initialNotes?: InternalNoteRow[];
}) {
  const router = useRouter();
  const loadNotes = useServerFn(fetchInternalNotes);
  const createNote = useServerFn(createInternalNoteRecord);
  const [notes, setNotes] = useState<InternalNoteRow[]>(initialNotes ?? []);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const next = await loadNotes({ data: { targetType, targetId } });
    setNotes(next);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await createNote({ data: { targetType, targetId, note: text } });
      setText("");
      await refresh();
      await router.invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message.replace(/^BAD_REQUEST:/, "") : "Failed to save note.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="!p-5">
      <form onSubmit={onSubmit} className="space-y-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add an internal note visible to operators…"
          className="min-h-[80px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          required
        />
        {error && <p className="text-[12px] text-destructive">{error}</p>}
        <button
          type="submit"
          disabled={submitting || !text.trim()}
          className="rounded-md bg-foreground px-4 py-2 text-[12px] font-medium text-background disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Add note"}
        </button>
      </form>
      <ul className="mt-5 space-y-3 border-t border-border pt-4">
        {notes.length === 0 ? (
          <li className="text-[13px] text-muted-foreground">No internal notes.</li>
        ) : (
          notes.map((note) => (
            <li key={note.id} className="rounded-md border border-border/60 bg-surface-2/30 px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                <span>{note.authorUsername}</span>
                <span>{formatActivityDateTime(note.createdAt)}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-[13px]">{note.note}</p>
            </li>
          ))
        )}
      </ul>
    </Card>
  );
}
