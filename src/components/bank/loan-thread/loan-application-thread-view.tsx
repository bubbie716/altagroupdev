import { useEffect, useRef, useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Florin } from "@/components/ui/florin";
import { cn } from "@/lib/utils";
import { ArrowLeft, Paperclip, Send, MoreHorizontal, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import type {
  LoanApplicationThreadContext,
  LoanApplicationThreadMessageRow,
  LoanApplicationThreadStatusCode,
  ThreadAttachment,
} from "@/lib/bank/loan-application-thread-types";
import {
  closeLoanApplicationThread,
  reopenLoanApplicationThread,
  sendInternalLoanApplicationThreadMessage,
  sendLoanApplicationThreadMessage,
  updateLoanApplicationThreadStatus,
} from "@/lib/bank/loan-application-thread.functions";
import { linkifyText, ThreadAttachmentList } from "@/components/bank/loan-thread/thread-attachments";

export function LoanApplicationThreadView({
  context,
  messages: initialMessages,
  variant,
  backTo,
  backLabel,
  className,
}: {
  context: LoanApplicationThreadContext;
  messages: LoanApplicationThreadMessageRow[];
  variant: "user" | "internal";
  backTo: string;
  backLabel: string;
  className?: string;
}) {
  const router = useRouter();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [messages, setMessages] = useState(initialMessages);
  const [ctx, setCtx] = useState(context);
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMeta, setShowMeta] = useState(false);

  const sendUser = useServerFn(sendLoanApplicationThreadMessage);
  const sendInternal = useServerFn(sendInternalLoanApplicationThreadMessage);
  const updateStatus = useServerFn(updateLoanApplicationThreadStatus);
  const closeThread = useServerFn(closeLoanApplicationThread);
  const reopen = useServerFn(reopenLoanApplicationThread);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Auto-grow composer textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "0px";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, [body]);

  async function refresh() {
    await router.invalidate();
  }

  async function submitMessage() {
    const text = body.trim();
    if (!text || !ctx.canSend || pending) return;
    setError(null);
    setPending(true);
    try {
      const send = variant === "internal" ? sendInternal : sendUser;
      const msg = await send({
        data: { applicationId: ctx.applicationId, body: text },
      });
      setMessages((prev) => [...prev, msg]);
      setBody("");
      setCtx((c) => ({
        ...c,
        status: variant === "internal" ? "waiting_on_applicant" : "waiting_on_alta",
        statusLabel: variant === "internal" ? "Waiting on applicant" : "Waiting on Alta",
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message.replace(/^BAD_REQUEST:/, "") : "Failed to send.");
    } finally {
      setPending(false);
    }
  }

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    await submitMessage();
  }

  function onComposerKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    void submitMessage();
  }

  async function onAttachFile(file: File) {
    setError(null);
    setPending(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/loan-threads/${ctx.applicationId}/attachments`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Upload failed.");
      }
      const attachment = (await res.json()) as ThreadAttachment;
      const send = variant === "internal" ? sendInternal : sendUser;
      const msg = await send({
        data: {
          applicationId: ctx.applicationId,
          body: body.trim() || undefined,
          attachments: [attachment],
        },
      });
      setMessages((prev) => [...prev, msg]);
      setBody("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col bg-[#f8f7f4] text-[#0f1729] dark:bg-background dark:text-foreground",
        className,
      )}
    >
      {/* Header — simple status header */}
      <header className="sticky top-0 z-20 shrink-0 border-b border-border/60 bg-[#f8f7f4]/85 backdrop-blur-md supports-[backdrop-filter]:bg-[#f8f7f4]/70 dark:bg-background/85 dark:supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link
            to={backTo}
            aria-label={backLabel}
            className="-ml-1.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0f1729] text-gold dark:bg-gold dark:text-[#0f1729]">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate font-serif text-[16px] leading-tight tracking-tight sm:text-[17px]">
                {variant === "internal" ? ctx.applicantName : "Alta Loan Desk"}
              </h1>
              <StatusDot status={ctx.status} />
            </div>
            <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
              {ctx.productLabel} · {ctx.statusLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowMeta((s) => !s)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground"
            aria-label="Toggle details"
          >
            {showMeta ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>

        {showMeta && (
          <div className="border-t border-border/60 bg-surface-1/60 px-4 py-3 sm:px-6">
            <dl className="mx-auto grid max-w-3xl grid-cols-2 gap-x-6 gap-y-3 text-[12px] sm:grid-cols-4">
              <MetaCell label="Requested">
                <span className="tabular-nums">
                  <Florin value={ctx.requestedAmount} fractionDigits={0} />
                </span>
              </MetaCell>
              <MetaCell label="Submitted">{ctx.submittedAtLabel}</MetaCell>
              <MetaCell label="Applicant">{ctx.applicantName}</MetaCell>
              <MetaCell label={ctx.companyName ? "Company" : "Status"}>
                {ctx.companyName ?? ctx.applicationStatusLabel}
              </MetaCell>
            </dl>
            {variant === "internal" && (
              <InternalThreadControls
                context={ctx}
                onStatus={async (status) => {
                  const next = await updateStatus({ data: { applicationId: ctx.applicationId, status } });
                  setCtx(next);
                }}
                onClose={async () => {
                  const next = await closeThread({ data: ctx.applicationId });
                  setCtx(next);
                }}
                onReopen={async () => {
                  const next = await reopen({ data: ctx.applicationId });
                  setCtx(next);
                }}
              />
            )}
          </div>
        )}
      </header>

      {/* Messages */}
      <div
        ref={scrollerRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-6 sm:px-6"
        style={{ WebkitOverflowScrolling: "touch" } as React.CSSProperties}
      >
        <div className="mx-auto max-w-3xl">
          {messages.length === 0 ? (
            <div className="py-16 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#0f1729] text-gold dark:bg-gold dark:text-[#0f1729]">
                <Sparkles className="h-5 w-5" />
              </div>
              <p className="mt-4 font-serif text-[16px] tracking-tight">Start the conversation</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                {variant === "internal"
                  ? "Reply to the applicant or request additional documents."
                  : "Ask a question, share a document, or request an update from your Alta loan officer."}
              </p>
            </div>
          ) : (
            renderMessageStream(messages, variant, ctx.viewerUserId)
          )}
        </div>
      </div>

      {/* Composer */}
      <footer
        className="shrink-0 border-t border-border/60 bg-[#f8f7f4]/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md dark:bg-background/95 sm:px-6 sm:pt-4"
      >
        <form onSubmit={(e) => void onSend(e)} className="mx-auto max-w-3xl">
          {error && (
            <p className="mb-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-[12px] text-destructive">
              {error}
            </p>
          )}
          {!ctx.canSend ? (
            <p className="rounded-xl border border-dashed border-border bg-surface-1 px-4 py-3 text-center text-[12.5px] text-muted-foreground">
              {ctx.status === "closed"
                ? "This thread is closed. Alta Bank will reopen it if further discussion is needed."
                : "You cannot send messages in this thread."}
            </p>
          ) : (
            <div className="group relative flex items-end gap-2 rounded-[22px] border border-border/70 bg-white px-2 py-2 shadow-[0_1px_0_rgba(15,23,41,0.04),0_8px_30px_-12px_rgba(15,23,41,0.18)] transition focus-within:border-foreground/30 focus-within:shadow-[0_1px_0_rgba(15,23,41,0.04),0_12px_40px_-12px_rgba(15,23,41,0.25)] dark:border-border dark:bg-surface-1">
              <label
                className={cn(
                  "flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground",
                  pending && "pointer-events-none opacity-50",
                )}
                aria-label="Attach a file"
              >
                <Paperclip className="h-4 w-4" />
                <input
                  type="file"
                  accept="image/*,.pdf,.doc,.docx"
                  className="sr-only"
                  disabled={pending}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void onAttachFile(file);
                    e.target.value = "";
                  }}
                />
              </label>
              <textarea
                ref={textareaRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={onComposerKeyDown}
                placeholder={
                  variant === "internal"
                    ? "Reply to applicant…"
                    : "Message Alta Bank…"
                }
                rows={1}
                disabled={pending}
                className="max-h-[200px] min-h-[36px] flex-1 resize-none border-0 bg-transparent px-1 py-1.5 text-[15px] leading-snug text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus-visible:outline-none focus-visible:ring-0"
                style={{ fontSize: "16px" }}
              />
              <button
                type="submit"
                disabled={pending || !body.trim()}
                aria-label="Send message"
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition",
                  body.trim()
                    ? "bg-[#0f1729] text-white hover:bg-[#0f1729]/90 dark:bg-gold dark:text-[#0f1729]"
                    : "bg-foreground/10 text-muted-foreground",
                  pending && "opacity-50",
                )}
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          )}
          <p className="mt-2 hidden text-center font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground/60 sm:block">
            Enter to send · Shift + Enter for new line · Asynchronous messaging
          </p>
        </form>
      </footer>
    </div>
  );
}

function MetaCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-foreground">{children}</dd>
    </div>
  );
}

function StatusDot({ status }: { status: LoanApplicationThreadStatusCode }) {
  const tone =
    status === "closed"
      ? "bg-muted-foreground/40"
      : status === "waiting_on_alta"
        ? "bg-gold animate-pulse"
        : status === "waiting_on_applicant"
          ? "bg-emerald-500"
          : "bg-foreground/50";
  return <span className={cn("inline-block h-1.5 w-1.5 shrink-0 rounded-full", tone)} aria-hidden />;
}

function renderMessageStream(
  messages: LoanApplicationThreadMessageRow[],
  variant: "user" | "internal",
  viewerUserId: string,
) {
  const nodes: React.ReactNode[] = [];
  let lastDay = "";
  let prevSenderKey = "";
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    const day = new Date(m.createdAt).toDateString();
    if (day !== lastDay) {
      nodes.push(<DaySeparator key={`day-${m.id}`} date={m.createdAt} />);
      lastDay = day;
      prevSenderKey = "";
    }
    const senderKey = `${m.senderRole}:${m.senderUserId ?? ""}`;
    const isGrouped = senderKey === prevSenderKey && m.senderRole !== "system";
    nodes.push(
      <ThreadMessageBubble
        key={m.id}
        message={m}
        variant={variant}
        viewerUserId={viewerUserId}
        grouped={isGrouped}
      />,
    );
    prevSenderKey = m.senderRole === "system" ? "" : senderKey;
  }
  return <div className="flex flex-col gap-1">{nodes}</div>;
}

function DaySeparator({ date }: { date: string }) {
  const d = new Date(date);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yest.toDateString();
  const label = sameDay
    ? "Today"
    : isYesterday
      ? "Yesterday"
      : d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  return (
    <div className="my-4 flex items-center gap-3 px-2 first:mt-0">
      <div className="h-px flex-1 bg-border/60" />
      <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
      <div className="h-px flex-1 bg-border/60" />
    </div>
  );
}

function ThreadMessageBubble({
  message,
  variant,
  viewerUserId,
  grouped,
}: {
  message: LoanApplicationThreadMessageRow;
  variant: "user" | "internal";
  viewerUserId: string;
  grouped: boolean;
}) {
  if (message.senderRole === "system") {
    return (
      <div className="my-2 flex justify-center px-4">
        <p className="max-w-md rounded-full border border-border/60 bg-surface-1 px-3.5 py-1 text-center text-[11.5px] text-muted-foreground">
          {message.body}
        </p>
      </div>
    );
  }

  const isStaff = message.senderRole === "alta_staff";
  const isOwnMessage =
    variant === "internal"
      ? isStaff
      : message.senderRole === "applicant" ||
        (message.senderUserId != null && message.senderUserId === viewerUserId);

  const senderName = isStaff ? "Alta Loan Desk" : (message.senderName ?? "Applicant");
  const initials = getInitials(senderName);
  const timeLabel = formatTimeOnly(message.createdAt) || message.createdAtLabel;
  const tone: "light" | "dark" = isOwnMessage ? "dark" : "light";

  return (
    <div
      className={cn(
        "flex items-end gap-2",
        isOwnMessage ? "flex-row-reverse" : "flex-row",
        grouped ? "mt-0.5" : "mt-3",
      )}
    >
      <div className="w-8 shrink-0">
        {!grouped && (
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full font-mono text-[10px] font-medium uppercase tracking-wide",
              isStaff
                ? "bg-[#0f1729] text-gold dark:bg-gold dark:text-[#0f1729]"
                : "border border-border/70 bg-surface-1 text-foreground",
            )}
            aria-hidden
          >
            {isStaff ? "A" : initials}
          </div>
        )}
      </div>
      <div className={cn("flex max-w-[82%] flex-col sm:max-w-[72%]", isOwnMessage ? "items-end" : "items-start")}>
        {!grouped && (
          <div className="mb-1 flex items-center gap-2 px-1">
            <span className="text-[11.5px] font-medium text-foreground/80">
              {isOwnMessage ? "You" : senderName}
            </span>
            <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground/80">
              {timeLabel}
            </span>
          </div>
        )}
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-[14.5px] leading-relaxed",
            isOwnMessage
              ? "bg-[#0f1729] text-white"
              : "border border-border/70 bg-white text-[#0f1729] dark:bg-surface-1 dark:text-foreground",
            isOwnMessage
              ? grouped
                ? "rounded-br-md"
                : "rounded-br-md"
              : grouped
                ? "rounded-bl-md"
                : "rounded-bl-md",
          )}
        >
          {message.body && (
            <p className="whitespace-pre-wrap break-words">{linkifyText(message.body)}</p>
          )}
          <ThreadAttachmentList attachments={message.attachments} tone={tone} />
        </div>
      </div>
    </div>
  );
}

function InternalThreadControls({
  context,
  onStatus,
  onClose,
  onReopen,
}: {
  context: LoanApplicationThreadContext;
  onStatus: (status: LoanApplicationThreadStatusCode) => Promise<void>;
  onClose: () => Promise<void>;
  onReopen: () => Promise<void>;
}) {
  return (
    <div className="mx-auto mt-3 flex max-w-3xl flex-wrap items-center gap-2 border-t border-border/40 pt-3">
      <ActionBtn label="Waiting on applicant" onClick={() => onStatus("waiting_on_applicant")} />
      <ActionBtn label="Waiting on Alta" onClick={() => onStatus("waiting_on_alta")} />
      {context.status === "closed" ? (
        <ActionBtn label="Reopen" onClick={onReopen} accent />
      ) : (
        <ActionBtn label="Close thread" onClick={onClose} />
      )}
    </div>
  );
}

function ActionBtn({
  label,
  onClick,
  accent,
}: {
  label: string;
  onClick: () => Promise<void>;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => void onClick()}
      className={cn(
        "rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] transition",
        accent
          ? "border-gold/50 bg-gold/10 text-gold hover:bg-gold/15"
          : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "·";
}

function formatTimeOnly(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

// Suppress unused import warning for MoreHorizontal (kept for future menu hook)
void MoreHorizontal;
