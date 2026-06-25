import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { AltaLogo } from "@/components/alta-logo";
import { InlineCard } from "./inline-cards";
import {
  formatDealDateTime,
  generateMockOfficerReply,
  type ChatMessage,
  type ChatPart,
  type DealRoom,
} from "@/lib/bank/deal-rooms-mock";

/**
 * Modern agent-chat surface for a Deal Room.
 * UI-only: composer appends an optimistic applicant message + a mocked
 * officer reply after a short delay. No backend, no streaming, no AI calls.
 */
export function DealRoomChat({ room }: { room: DealRoom }) {
  const seed = useMemo<ChatMessage[]>(() => room.messages ?? [], [room.messages]);
  const [messages, setMessages] = useState<ChatMessage[]>(seed);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setMessages(seed), [seed]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, pending]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const text = draft.trim();
    if (!text || pending) return;

    const now = new Date().toISOString();
    const applicantMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "applicant",
      author: room.applicant,
      timestamp: now,
      parts: [{ type: "text", text }],
    };
    setMessages((prev) => [...prev, applicantMsg]);
    setDraft("");
    setPending(true);

    window.setTimeout(() => {
      const reply: ChatMessage = {
        id: `o-${Date.now()}`,
        role: "officer",
        author: room.assignedOfficer,
        authorRole: room.officerTitle,
        timestamp: new Date().toISOString(),
        parts: generateMockOfficerReply(room, text),
      };
      setMessages((prev) => [...prev, reply]);
      setPending(false);
      window.setTimeout(() => textareaRef.current?.focus(), 0);
    }, 1100);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        ref={scrollerRef}
        className="flex-1 overflow-y-auto px-4 py-6 sm:px-6"
      >
        <div className="mx-auto flex max-w-2xl flex-col gap-5">
          {messages.map((msg) => (
            <ChatRow key={msg.id} room={room} message={msg} />
          ))}
          {pending ? (
            <ChatRow
              room={room}
              message={{
                id: "pending",
                role: "officer",
                author: room.assignedOfficer,
                authorRole: room.officerTitle,
                timestamp: new Date().toISOString(),
                parts: [{ type: "text", text: "" }],
              }}
              pending
            />
          ) : null}
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="border-t border-border bg-surface-1/80 px-4 py-3 sm:px-6"
      >
        <div className="mx-auto max-w-2xl">
          <div className="rounded-lg border border-border bg-background focus-within:border-border-strong focus-within:shadow-elevated transition-shadow">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder={`Message ${room.assignedOfficer}…`}
              rows={1}
              className="block min-h-[44px] w-full resize-none bg-transparent px-4 py-3 text-[14px] leading-relaxed placeholder:text-muted-foreground focus:outline-none"
            />
            <div className="flex items-center justify-between gap-3 border-t border-border/60 px-3 py-2">
              <button
                type="button"
                className="rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:bg-surface-2 hover:text-foreground"
              >
                + Attach
              </button>
              <div className="flex items-center gap-3">
                <span className="hidden font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground sm:inline">
                  Enter to send · Shift+Enter newline
                </span>
                <button
                  type="submit"
                  disabled={!draft.trim() || pending}
                  className="rounded-md bg-foreground px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-background transition-opacity disabled:opacity-40"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
          <p className="mt-2 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Secure channel · Alta Bank Credit Desk · UI preview, no transmission
          </p>
        </div>
      </form>
    </div>
  );
}

function ChatRow({
  room,
  message,
  pending,
}: {
  room: DealRoom;
  message: ChatMessage;
  pending?: boolean;
}) {
  if (message.role === "system") {
    return (
      <div className="my-1">
        {message.parts.map((part, i) => (
          <InlineCard key={i} part={part} />
        ))}
      </div>
    );
  }

  const isOfficer = message.role === "officer";
  return (
    <div
      className={cn(
        "flex items-end gap-3",
        isOfficer ? "flex-row" : "flex-row-reverse",
      )}
    >
      <Avatar role={message.role} room={room} />
      <div className={cn("flex max-w-[88%] flex-col gap-1", isOfficer ? "items-start" : "items-end")}>
        <div
          className={cn(
            "flex items-baseline gap-2 px-1",
            !isOfficer && "flex-row-reverse",
          )}
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {isOfficer ? room.assignedOfficer : message.author ?? "You"}
          </span>
          {message.authorRole ? (
            <span className="hidden text-[11px] text-muted-foreground/70 sm:inline">
              {message.authorRole}
            </span>
          ) : null}
        </div>

        <Bubble role={message.role} pending={pending}>
          {pending ? <TypingDots /> : <PartList parts={message.parts} />}
        </Bubble>

        <time className="px-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70">
          {formatDealDateTime(message.timestamp)}
        </time>
      </div>
    </div>
  );
}

function PartList({ parts }: { parts: ChatPart[] }) {
  return (
    <>
      {parts.map((part, i) => {
        if (part.type === "text") {
          return (
            <p
              key={i}
              className="whitespace-pre-wrap text-[14px] leading-relaxed"
            >
              {part.text}
            </p>
          );
        }
        return <InlineCard key={i} part={part} />;
      })}
    </>
  );
}

function Bubble({
  role,
  pending,
  children,
}: {
  role: "officer" | "applicant";
  pending?: boolean;
  children: React.ReactNode;
}) {
  if (role === "applicant") {
    return (
      <div className="rounded-2xl rounded-br-md bg-foreground px-4 py-2.5 text-background shadow-card">
        {children}
      </div>
    );
  }
  return (
    <div
      className={cn(
        "rounded-2xl rounded-bl-md border border-border bg-surface-1 px-4 py-2.5 text-foreground shadow-card",
        pending && "min-h-[44px]",
      )}
    >
      {children}
    </div>
  );
}

function Avatar({
  role,
  room,
}: {
  role: "officer" | "applicant" | "system";
  room: DealRoom;
}) {
  if (role === "system") return null;
  if (role === "officer") {
    return (
      <div className="grid size-8 shrink-0 place-items-center rounded-full border border-gold/40 bg-gold/10">
        <AltaLogo className="h-4 w-4 text-gold" />
      </div>
    );
  }
  const initials = initialsOf(room.applicant);
  return (
    <div className="grid size-8 shrink-0 place-items-center rounded-full border border-border bg-surface-2 font-mono text-[10px] uppercase tracking-wider text-foreground">
      {initials}
    </div>
  );
}

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-1.5" aria-label="Officer is typing">
      <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground/70 [animation-delay:0ms]" />
      <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground/70 [animation-delay:150ms]" />
      <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground/70 [animation-delay:300ms]" />
    </span>
  );
}