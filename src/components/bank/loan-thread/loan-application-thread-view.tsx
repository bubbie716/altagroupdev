import { useEffect, useRef, useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Florin } from "@/components/ui/florin";
import { StatusBadge } from "@/components/internal/status-badge";
import { cn } from "@/lib/utils";
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
  const [messages, setMessages] = useState(initialMessages);
  const [ctx, setCtx] = useState(context);
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      {/* Header */}
      <header className="shrink-0 border-b border-border/60 bg-surface-1/90 px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-3xl flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              to={backTo}
              className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-gold"
            >
              {backLabel}
            </Link>
            <h1 className="mt-2 font-serif text-[22px] tracking-tight">
              {variant === "internal" ? "Application thread" : "Secure Deal Room"}
            </h1>
            <p className="mt-1 text-[13px] text-muted-foreground">{ctx.productLabel}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={ctx.applicationStatusLabel} />
            <span
              className={cn(
                "rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em]",
                ctx.status === "closed"
                  ? "border-border text-muted-foreground"
                  : ctx.status === "waiting_on_alta"
                    ? "border-gold/40 bg-gold/10 text-gold"
                    : "border-border bg-surface-2 text-foreground",
              )}
            >
              {ctx.statusLabel}
            </span>
          </div>
        </div>
        <dl className="mx-auto mt-4 grid max-w-3xl grid-cols-2 gap-3 text-[12px] sm:grid-cols-4">
          <div>
            <dt className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">Requested</dt>
            <dd className="mt-0.5 tabular-nums">
              <Florin value={ctx.requestedAmount} fractionDigits={0} />
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">Submitted</dt>
            <dd className="mt-0.5">{ctx.submittedAtLabel}</dd>
          </div>
          <div>
            <dt className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">Applicant</dt>
            <dd className="mt-0.5">{ctx.applicantName}</dd>
          </div>
          {ctx.companyName && (
            <div>
              <dt className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">Company</dt>
              <dd className="mt-0.5">{ctx.companyName}</dd>
            </div>
          )}
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
      </header>

      {/* Messages */}
      <div ref={scrollerRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-3xl space-y-4">
          {messages.length === 0 ? (
            <p className="py-12 text-center text-[13px] text-muted-foreground">
              Your application thread will appear here.
            </p>
          ) : (
            messages.map((m) => (
              <ThreadMessageBubble key={m.id} message={m} variant={variant} viewerUserId={ctx.viewerUserId} />
            ))
          )}
        </div>
      </div>

      {/* Composer */}
      <footer className="shrink-0 border-t border-border/60 bg-surface-1/90 px-4 py-4 sm:px-6">
        <form onSubmit={(e) => void onSend(e)} className="mx-auto max-w-3xl">
          {error && <p className="mb-2 text-[12px] text-destructive">{error}</p>}
          {!ctx.canSend ? (
            <p className="text-center text-[13px] text-muted-foreground">
              {ctx.status === "closed"
                ? "This thread is closed. Alta Bank will reopen it if further discussion is needed."
                : "You cannot send messages in this thread."}
            </p>
          ) : (
            <div className="flex gap-2">
              <label className="flex shrink-0 cursor-pointer items-center rounded-lg border border-border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground hover:border-gold/40">
                Attach
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
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={onComposerKeyDown}
                placeholder={
                  variant === "internal"
                    ? "Reply to applicant…"
                    : "Message Alta Bank about this application…"
                }
                rows={2}
                disabled={pending}
                className="min-h-[44px] flex-1 resize-none rounded-xl border border-border bg-background px-4 py-2.5 text-[14px] shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold/40"
              />
              <button
                type="submit"
                disabled={pending || !body.trim()}
                className="shrink-0 self-end rounded-xl bg-[#0f1729] px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.18em] text-white hover:bg-[#0f1729]/90 disabled:opacity-40 dark:bg-gold dark:text-[#0f1729]"
              >
                Send
              </button>
            </div>
          )}
          <p className="mt-2 text-center font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground/70">
            Enter to send · Shift+Enter for new line · asynchronous messaging
          </p>
        </form>
      </footer>
    </div>
  );
}

function ThreadMessageBubble({
  message,
  variant,
  viewerUserId,
}: {
  message: LoanApplicationThreadMessageRow;
  variant: "user" | "internal";
  viewerUserId: string;
}) {
  if (message.senderRole === "system") {
    return (
      <div className="flex justify-center px-4">
        <p className="max-w-md rounded-full bg-surface-2/80 px-4 py-1.5 text-center text-[12px] text-muted-foreground">
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

  return (
    <div className={cn("flex", isOwnMessage ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-3 sm:max-w-[72%]",
          isOwnMessage
            ? "rounded-tl-md bg-[#0f1729] text-white"
            : "rounded-tr-md border border-border/60 bg-white text-[#0f1729] shadow-sm",
        )}
      >
        <div className={cn("mb-1 text-[11px] font-medium", isOwnMessage ? "text-white/80" : "text-muted-foreground")}>
          {isOwnMessage ? "You" : isStaff ? "Loan Officer" : (message.senderName ?? "Applicant")}
        </div>
        {message.body && (
          <p className="whitespace-pre-wrap text-[14px] leading-relaxed">{linkifyText(message.body)}</p>
        )}
        <ThreadAttachmentList attachments={message.attachments} />
        <div className={cn("mt-1.5 text-[10px]", isOwnMessage ? "text-white/60" : "text-muted-foreground")}>
          {message.createdAtLabel}
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
    <div className="mx-auto mt-4 flex max-w-3xl flex-wrap items-center gap-2 border-t border-border/40 pt-4">
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
        "rounded-md border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em]",
        accent
          ? "border-gold/50 bg-gold/10 text-gold"
          : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}
