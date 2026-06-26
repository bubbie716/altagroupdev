import { useEffect, useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import {
  submitDealRoomMessage,
  submitDealRoomSystemUpdate,
  submitInternalDealRoomMessage,
} from "@/lib/bank/deal-room.functions";
import {
  DEAL_ROOM_MESSAGE_MAX_LENGTH,
  type DealRoomMessageRow,
} from "@/lib/bank/deal-room-types";
import { formatDealDateTime } from "@/lib/bank/deal-rooms-mock";

const QUICK_SYSTEM_UPDATES = [
  { label: "Request Information", body: "Additional information has been requested from the applicant." },
  {
    label: "Terms Updated",
    body: "Proposed facility terms have been updated. Please review the deal summary.",
    updateStatus: "NEGOTIATING_TERMS" as const,
  },
  {
    label: "Contract Drafting",
    body: "Facility documentation is being prepared for review.",
    updateStatus: "CONTRACT_DRAFTING" as const,
  },
  {
    label: "Ready for Acceptance",
    body: "Facility terms are ready for applicant acceptance.",
    updateStatus: "READY_FOR_ACCEPTANCE" as const,
  },
];

export function DealActivityFeed({
  dealRoomId,
  messages,
  variant,
  roomClosed = false,
}: {
  dealRoomId: string;
  messages: DealRoomMessageRow[];
  variant: "user" | "internal";
  roomClosed?: boolean;
}) {
  const router = useRouter();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [internalMode, setInternalMode] = useState<"officer" | "internal_note">("officer");
  const [quickPending, setQuickPending] = useState(false);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, pending]);

  async function refresh() {
    await router.invalidate();
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const body = draft.trim();
    if (!body || pending || roomClosed) return;

    setPending(true);
    setError(null);
    try {
      if (variant === "user") {
        await submitDealRoomMessage({ data: { dealRoomId, body, channel: "applicant" } });
      } else {
        await submitInternalDealRoomMessage({
          data: { dealRoomId, body, channel: internalMode },
        });
      }
      setDraft("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message.replace(/^BAD_REQUEST:/, "") : "Could not submit message.");
    } finally {
      setPending(false);
    }
  }

  async function handleQuickUpdate(
    body: string,
    updateStatus?: (typeof QUICK_SYSTEM_UPDATES)[number]["updateStatus"],
  ) {
    if (quickPending || roomClosed) return;
    setQuickPending(true);
    setError(null);
    try {
      await submitDealRoomSystemUpdate({
        data: { dealRoomId, body, ...(updateStatus ? { updateStatus } : {}) },
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message.replace(/^BAD_REQUEST:/, "") : "Could not post update.");
    } finally {
      setQuickPending(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-border/60 px-4 py-3 sm:px-6">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          Deal Activity Feed
        </h2>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Asynchronous underwriting messages · reviewed by Alta credit operations
        </p>
      </div>

      <div ref={scrollerRef} className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-2xl">
          {messages.length === 0 ? (
            <p className="py-12 text-center text-[14px] text-muted-foreground">No deal activity yet.</p>
          ) : (
            <ol className="space-y-5">
              {messages.map((message) => (
                <li key={message.id}>
                  <MessageEntry message={message} />
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <div className="border-t border-border bg-surface-1/80 px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-2xl space-y-3">
          {variant === "internal" ? (
            <div className="flex flex-wrap gap-2">
              {QUICK_SYSTEM_UPDATES.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  disabled={quickPending || roomClosed}
                  onClick={() => handleQuickUpdate(action.body, action.updateStatus)}
                  className="rounded-md border border-border bg-surface-2/60 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
                >
                  {action.label}
                </button>
              ))}
            </div>
          ) : null}

          {variant === "internal" ? (
            <div className="flex gap-2">
              <ComposerModeButton
                active={internalMode === "officer"}
                onClick={() => setInternalMode("officer")}
                label="Officer Message"
              />
              <ComposerModeButton
                active={internalMode === "internal_note"}
                onClick={() => setInternalMode("internal_note")}
                label="Internal Note"
              />
            </div>
          ) : null}

          {roomClosed ? (
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              This deal room is closed · messaging disabled
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value.slice(0, DEAL_ROOM_MESSAGE_MAX_LENGTH))}
                placeholder={
                  variant === "internal" && internalMode === "internal_note"
                    ? "Staff-only note — not visible to applicants…"
                    : variant === "internal"
                      ? "Message to applicant or company representatives…"
                      : "Message for the Alta credit desk…"
                }
                rows={3}
                className="block w-full resize-y rounded-lg border border-border bg-background px-4 py-3 text-[14px] leading-relaxed placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  {draft.length}/{DEAL_ROOM_MESSAGE_MAX_LENGTH}
                </span>
                <button
                  type="submit"
                  disabled={!draft.trim() || pending}
                  className="rounded-md bg-foreground px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-background transition-opacity disabled:opacity-40"
                >
                  {pending
                    ? "Submitting…"
                    : variant === "internal" && internalMode === "internal_note"
                      ? "Add Internal Note"
                      : "Submit Message"}
                </button>
              </div>
            </form>
          )}

          {error ? <p className="text-[13px] text-destructive">{error}</p> : null}

          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Secure deal room · messages are reviewed asynchronously · not live chat
          </p>
        </div>
      </div>
    </div>
  );
}

function ComposerModeButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] transition-colors",
        active
          ? "border-gold/40 bg-gold/10 text-gold"
          : "border-border bg-surface-2/60 text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

function MessageEntry({ message }: { message: DealRoomMessageRow }) {
  if (message.messageType === "system_update") {
    return (
      <div className="border-l-2 border-gold/40 py-1 pl-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">System Update</div>
        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{message.body}</p>
        <time className="mt-2 block font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70">
          {formatDealDateTime(message.createdAt)}
        </time>
      </div>
    );
  }

  if (message.messageType === "internal_note") {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber-700 dark:text-amber-400">
            Internal Note
          </span>
          <span className="rounded border border-amber-500/30 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-amber-700/80 dark:text-amber-400/80">
            Staff only
          </span>
        </div>
        <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed">{message.body}</p>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[12px] text-muted-foreground">
          {message.senderName ? <span>{message.senderName}</span> : null}
          <time className="font-mono text-[10px] uppercase tracking-[0.16em]">
            {formatDealDateTime(message.createdAt)}
          </time>
        </div>
      </div>
    );
  }

  const isOfficer = message.messageType === "officer_message";
  const label = isOfficer ? "Alta Loan Officer" : "Applicant";

  return (
    <article className="rounded-lg border border-border bg-surface-1 px-4 py-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed">{message.body}</p>
      <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1 border-t border-border/60 pt-2 text-[12px] text-muted-foreground">
        {message.senderName ? <span>{message.senderName}</span> : null}
        <time className="font-mono text-[10px] uppercase tracking-[0.16em]">
          {formatDealDateTime(message.createdAt)}
        </time>
      </div>
    </article>
  );
}
