import { useEffect, useRef, useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Florin } from "@/components/ui/florin";
import { cn } from "@/lib/utils";
import { AltaLogo } from "@/components/alta-logo";
import { ArrowLeft, Paperclip, Send, MoreHorizontal, ChevronDown, ChevronUp } from "lucide-react";
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
import {
  closeAltaCardApplicationThreadRecord,
  reopenAltaCardApplicationThreadRecord,
  sendAltaCardApplicationThreadMessage,
  sendInternalAltaCardApplicationThreadMessage,
  updateAltaCardApplicationThreadStatus,
} from "@/lib/bank/alta-card-application.functions";
import {
  closeAltaCardReviewThreadRecord,
  reopenAltaCardReviewThreadRecord,
  sendAltaCardReviewThreadMessage,
  sendInternalAltaCardReviewThreadMessage,
  updateAltaCardReviewThreadStatus,
} from "@/lib/bank/alta-card-review.functions";
import { mapAltaCardThreadContextToLoan } from "@/lib/bank/alta-card-thread-adapter";
import { mapAltaCardReviewThreadContextToLoan } from "@/lib/bank/alta-card-review-thread-adapter";
import { linkifyText, ThreadAttachmentList } from "@/components/bank/loan-thread/thread-attachments";
import {
  isTerminalThreadDecisionStatus,
  threadClosedDecisionMessage,
  threadDecisionTone,
} from "@/lib/bank/thread-decision-utils";
import {
  isOwnThreadMessage,
  normalizeThreadMessage,
} from "@/lib/bank/thread-message-utils";

type ApplicationThreadProduct = "loan" | "alta-card" | "alta-card-review";

const THREAD_PRODUCT_COPY: Record<
  ApplicationThreadProduct,
  {
    deskLabel: string;
    staffSenderLabel: string;
    systemDeskLabel: string;
    requestedMetaLabel: string;
    emptyStateTitle: string;
    emptyStateUser: string;
    emptyStateInternal: string;
    closedComposerMessage: string;
    blockedComposerMessage: string;
    closeActionLabel: string;
    reopenActionLabel: string;
    footerHint: string;
    attachmentPath: (applicationId: string) => string;
  }
> = {
  loan: {
    deskLabel: "Secure Deal Room",
    staffSenderLabel: "Alta Credit Desk",
    systemDeskLabel: "Secure Deal Room",
    requestedMetaLabel: "Requested",
    emptyStateTitle: "Application submitted",
    emptyStateUser:
      "Your application is under review. Ask a question, share a document, or respond to Alta here. If your Discord account is connected, you'll also receive notifications from the Alta Bot when new updates are available.",
    emptyStateInternal: "Reply to the applicant or request additional documents through the Secure Deal Room.",
    closedComposerMessage:
      "This Secure Deal Room is closed. Alta Bank will reopen it if further discussion is needed.",
    blockedComposerMessage: "You cannot send messages in this Secure Deal Room.",
    closeActionLabel: "Close Secure Deal Room",
    reopenActionLabel: "Reopen Secure Deal Room",
    footerHint:
      "Secure Deal Room · Enter to send · Shift + Enter for new line · Asynchronous messaging",
    attachmentPath: (applicationId) => `/api/loan-threads/${applicationId}/attachments`,
  },
  "alta-card": {
    deskLabel: "Secure Deal Room",
    staffSenderLabel: "Alta Credit Desk",
    systemDeskLabel: "Secure Deal Room",
    requestedMetaLabel: "Requested limit",
    emptyStateTitle: "Application submitted",
    emptyStateUser:
      "Your application is under review. Ask a question, share a document, or respond to Alta here. If your Discord account is connected, you'll also receive notifications from the Alta Bot when new updates are available.",
    emptyStateInternal: "Reply to the applicant or request additional documents through the Secure Deal Room.",
    closedComposerMessage:
      "This Secure Deal Room is closed. Alta Bank will reopen it if further discussion is needed.",
    blockedComposerMessage: "You cannot send messages in this Secure Deal Room.",
    closeActionLabel: "Close Secure Deal Room",
    reopenActionLabel: "Reopen Secure Deal Room",
    footerHint:
      "Secure Deal Room · Enter to send · Shift + Enter for new line · Asynchronous messaging",
    attachmentPath: (applicationId) => `/api/alta-card-threads/${applicationId}/attachments`,
  },
  "alta-card-review": {
    deskLabel: "Secure Deal Room",
    staffSenderLabel: "Alta Credit Desk",
    systemDeskLabel: "Secure Deal Room",
    requestedMetaLabel: "Review",
    emptyStateTitle: "Application submitted",
    emptyStateUser:
      "Your application is under review. Ask a question, share a document, or respond to Alta here. If your Discord account is connected, you'll also receive notifications from the Alta Bot when new updates are available.",
    emptyStateInternal: "Reply to the applicant or request additional documents through the Secure Deal Room.",
    closedComposerMessage:
      "This Secure Deal Room is closed. Alta Bank will reopen it if further discussion is needed.",
    blockedComposerMessage: "You cannot send messages in this Secure Deal Room.",
    closeActionLabel: "Close Secure Deal Room",
    reopenActionLabel: "Reopen Secure Deal Room",
    footerHint:
      "Secure Deal Room · Enter to send · Shift + Enter for new line · Asynchronous messaging",
    attachmentPath: (applicationId) => `/api/alta-card-review-threads/${applicationId}/attachments`,
  },
};

export function LoanApplicationThreadView({
  context,
  messages: initialMessages,
  variant,
  backTo,
  backLabel,
  backParams,
  className,
  product = "loan",
}: {
  context: LoanApplicationThreadContext;
  messages: LoanApplicationThreadMessageRow[];
  variant: "user" | "internal";
  backTo: string;
  backLabel: string;
  backParams?: Record<string, string>;
  className?: string;
  product?: ApplicationThreadProduct;
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

  const copy = THREAD_PRODUCT_COPY[product];
  const decisionFinal = isTerminalThreadDecisionStatus(ctx.applicationStatus);
  const headerStatusLabel = decisionFinal ? ctx.applicationStatusLabel : ctx.statusLabel;
  const metaStatusLabel = decisionFinal ? ctx.applicationStatusLabel : ctx.statusLabel;
  const closedComposerMessage = decisionFinal
    ? threadClosedDecisionMessage(ctx.applicationStatusLabel)
    : copy.closedComposerMessage;

  const sendUserLoan = useServerFn(sendLoanApplicationThreadMessage);
  const sendInternalLoan = useServerFn(sendInternalLoanApplicationThreadMessage);
  const updateStatusLoan = useServerFn(updateLoanApplicationThreadStatus);
  const closeThreadLoan = useServerFn(closeLoanApplicationThread);
  const reopenLoan = useServerFn(reopenLoanApplicationThread);

  const sendUserAltaCard = useServerFn(sendAltaCardApplicationThreadMessage);
  const sendInternalAltaCard = useServerFn(sendInternalAltaCardApplicationThreadMessage);
  const updateStatusAltaCard = useServerFn(updateAltaCardApplicationThreadStatus);
  const closeThreadAltaCard = useServerFn(closeAltaCardApplicationThreadRecord);
  const reopenAltaCard = useServerFn(reopenAltaCardApplicationThreadRecord);

  const sendUserAltaCardReview = useServerFn(sendAltaCardReviewThreadMessage);
  const sendInternalAltaCardReview = useServerFn(sendInternalAltaCardReviewThreadMessage);
  const updateStatusAltaCardReview = useServerFn(updateAltaCardReviewThreadStatus);
  const closeThreadAltaCardReview = useServerFn(closeAltaCardReviewThreadRecord);
  const reopenAltaCardReview = useServerFn(reopenAltaCardReviewThreadRecord);

  const sendUser =
    product === "alta-card-review"
      ? sendUserAltaCardReview
      : product === "alta-card"
        ? sendUserAltaCard
        : sendUserLoan;
  const sendInternal =
    product === "alta-card-review"
      ? sendInternalAltaCardReview
      : product === "alta-card"
        ? sendInternalAltaCard
        : sendInternalLoan;
  const updateStatus =
    product === "alta-card-review"
      ? updateStatusAltaCardReview
      : product === "alta-card"
        ? updateStatusAltaCard
        : updateStatusLoan;
  const closeThread =
    product === "alta-card-review"
      ? closeThreadAltaCardReview
      : product === "alta-card"
        ? closeThreadAltaCard
        : closeThreadLoan;
  const reopen =
    product === "alta-card-review"
      ? reopenAltaCardReview
      : product === "alta-card"
        ? reopenAltaCard
        : reopenLoan;

  async function applyContextUpdate(next: unknown) {
    if (product === "alta-card-review") {
      setCtx(
        mapAltaCardReviewThreadContextToLoan(
          next as import("@/lib/bank/alta-card-review-thread-types").AltaCardReviewThreadContext,
        ),
      );
      return;
    }
    if (product === "alta-card") {
      setCtx(mapAltaCardThreadContextToLoan(next as import("@/lib/bank/alta-card-application-thread-types").AltaCardApplicationThreadContext));
      return;
    }
    setCtx(next as LoanApplicationThreadContext);
  }

  useEffect(() => {
    setMessages(initialMessages);
    setCtx(context);
  }, [initialMessages, context]);

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
      const raw = await send({
        data: { applicationId: ctx.applicationId, body: text },
      });
      const msg = normalizeThreadMessage(product, raw);
      setMessages((prev) => [...prev, msg]);
      setBody("");
      if (product !== "alta-card-review") {
        setCtx((c) => ({
          ...c,
          status: variant === "internal" ? "waiting_on_applicant" : "waiting_on_alta",
          statusLabel: variant === "internal" ? "Waiting on You" : "Waiting on Alta",
        }));
      }
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
      const res = await fetch(copy.attachmentPath(ctx.applicationId), {
        method: "POST",
        body: form,
      });
      const responseBody = (await res.json().catch(() => null)) as
        | (ThreadAttachment & { error?: string; message?: string })
        | { error?: string; message?: string }
        | null;
      if (!res.ok) {
        throw new Error(responseBody?.error ?? responseBody?.message ?? "Upload failed.");
      }
      const attachment = responseBody as ThreadAttachment;
      const send = variant === "internal" ? sendInternal : sendUser;
      const raw = await send({
        data: {
          applicationId: ctx.applicationId,
          body: body.trim() || undefined,
          attachments: [attachment],
        },
      });
      const msg = normalizeThreadMessage(product, raw);
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
            params={backParams}
            aria-label={backLabel}
            className="-ml-1.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-[#0f1729] dark:bg-gold/10">
            {variant === "internal" && ctx.applicantAvatarUrl ? (
              <img
                src={ctx.applicantAvatarUrl}
                alt=""
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              <AltaLogo className="h-5 w-5 text-gold" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-serif text-[16px] leading-tight tracking-tight sm:text-[17px]">
              {variant === "internal" ? ctx.applicantName : copy.deskLabel}
            </h1>
            <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
              {ctx.productLabel} · {headerStatusLabel}
              {decisionFinal && ctx.status === "closed" ? " · Deal room closed" : null}
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
              <MetaCell label={copy.requestedMetaLabel}>
                <span className="tabular-nums">
                  <Florin value={ctx.requestedAmount} fractionDigits={0} />
                </span>
              </MetaCell>
              <MetaCell label="Submitted">{ctx.submittedAtLabel}</MetaCell>
              <MetaCell label="Applicant">{ctx.applicantName}</MetaCell>
              {ctx.companyName ? <MetaCell label="Company">{ctx.companyName}</MetaCell> : null}
              <MetaCell label={decisionFinal ? "Decision" : "Status"}>
                <ThreadDecisionStatus status={ctx.applicationStatus} label={metaStatusLabel} />
              </MetaCell>
            </dl>
            {variant === "internal" && (
              <InternalThreadControls
                context={ctx}
                copy={copy}
                allowReopen={!decisionFinal}
                onStatus={async (status) => {
                  const next = await updateStatus({ data: { applicationId: ctx.applicationId, status } });
                  await applyContextUpdate(next);
                }}
                onClose={async () => {
                  const next = await closeThread({ data: ctx.applicationId });
                  await applyContextUpdate(next);
                }}
                onReopen={async () => {
                  const next = await reopen({ data: ctx.applicationId });
                  await applyContextUpdate(next);
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
          {decisionFinal ? (
            <ThreadDecisionBanner status={ctx.applicationStatus} label={ctx.applicationStatusLabel} />
          ) : null}
          {messages.length === 0 ? (
            <div className="py-16 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-gold/40 bg-[#0f1729] dark:bg-gold/10">
                <AltaLogo className="h-6 w-6 text-gold" />
              </div>
              <p className="mt-4 font-serif text-[16px] tracking-tight">{copy.emptyStateTitle}</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                {variant === "internal" ? copy.emptyStateInternal : copy.emptyStateUser}
              </p>
            </div>
          ) : (
            renderMessageStream(messages, variant, ctx.viewerUserId, ctx.applicantAvatarUrl, copy)
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
                ? closedComposerMessage
                : copy.blockedComposerMessage}
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
            {copy.footerHint}
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

function renderMessageStream(
  messages: LoanApplicationThreadMessageRow[],
  variant: "user" | "internal",
  viewerUserId: string,
  applicantAvatarUrl: string | null,
  copy: (typeof THREAD_PRODUCT_COPY)[ApplicationThreadProduct],
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
        applicantAvatarUrl={applicantAvatarUrl}
        grouped={isGrouped}
        copy={copy}
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
  applicantAvatarUrl,
  grouped,
  copy,
}: {
  message: LoanApplicationThreadMessageRow;
  variant: "user" | "internal";
  viewerUserId: string;
  applicantAvatarUrl: string | null;
  grouped: boolean;
  copy: (typeof THREAD_PRODUCT_COPY)[ApplicationThreadProduct];
}) {
  if (message.senderRole === "system") {
    return (
      <div className="my-4 flex justify-center px-4">
        <div className="max-w-md rounded-2xl border border-border/60 bg-white px-4 py-3 text-center shadow-sm dark:bg-surface-1">
          <div className="mb-2 flex items-center justify-center gap-2">
            <ThreadAltaAvatar className="h-7 w-7" />
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
              {copy.systemDeskLabel}
            </span>
          </div>
          <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-foreground/85">
            {message.body}
          </p>
        </div>
      </div>
    );
  }

  const isStaff = message.senderRole === "alta_staff";
  const isOwnMessage = isOwnThreadMessage(message, variant, viewerUserId);

  const senderName = isStaff ? copy.staffSenderLabel : (message.senderName ?? "Applicant");
  const initials = getInitials(senderName);
  const avatarUrl = message.senderAvatarUrl ?? applicantAvatarUrl;
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
        {!grouped &&
          (isStaff ? (
            <ThreadAltaAvatar />
          ) : (
            <ThreadUserAvatar avatarUrl={avatarUrl} initials={initials} name={senderName} />
          ))}
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

function ThreadAltaAvatar({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-full border border-gold/40 bg-[#0f1729] dark:bg-gold/10",
        className,
      )}
      aria-hidden
    >
      <AltaLogo className="h-4 w-4 text-gold" />
    </div>
  );
}

function ThreadUserAvatar({
  avatarUrl,
  initials,
  name,
  className,
}: {
  avatarUrl: string | null;
  initials: string;
  name: string;
  className?: string;
}) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={cn("h-8 w-8 rounded-full border border-border/70 object-cover", className)}
      />
    );
  }
  return (
    <div
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-full border border-border/70 bg-surface-1 font-mono text-[10px] font-medium uppercase tracking-wide text-foreground",
        className,
      )}
      aria-hidden
    >
      {initials}
    </div>
  );
}

function ThreadDecisionStatus({ status, label }: { status: string; label: string }) {
  const tone = threadDecisionTone(status);
  const toneClass =
    tone === "success"
      ? "text-[var(--success)]"
      : tone === "danger"
        ? "text-[var(--destructive)]"
        : tone === "warning"
          ? "text-amber-700 dark:text-amber-300"
          : "text-muted-foreground";

  return <span className={cn("font-medium capitalize", toneClass)}>{label}</span>;
}

function ThreadDecisionBanner({ status, label }: { status: string; label: string }) {
  const tone = threadDecisionTone(status);
  const styles =
    tone === "success"
      ? "border-[var(--success)]/25 bg-[var(--success)]/8 text-[var(--success)]"
      : tone === "danger"
        ? "border-[var(--destructive)]/25 bg-[var(--destructive)]/8 text-[var(--destructive)]"
        : tone === "warning"
          ? "border-amber-500/25 bg-amber-500/8 text-amber-800 dark:text-amber-200"
          : "border-border bg-surface-1 text-muted-foreground";

  return (
    <div className={cn("mb-6 rounded-xl border px-4 py-3 text-center", styles)}>
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] opacity-80">Decision</p>
      <p className="mt-1 font-serif text-[18px] tracking-tight">{label}</p>
      <p className="mt-1 text-[12px] opacity-80">This secure deal room is closed.</p>
    </div>
  );
}

function InternalThreadControls({
  context,
  copy,
  allowReopen = true,
  onStatus,
  onClose,
  onReopen,
}: {
  context: LoanApplicationThreadContext;
  copy: (typeof THREAD_PRODUCT_COPY)[ApplicationThreadProduct];
  allowReopen?: boolean;
  onStatus: (status: LoanApplicationThreadStatusCode) => Promise<void>;
  onClose: () => Promise<void>;
  onReopen: () => Promise<void>;
}) {
  return (
    <div className="mx-auto mt-3 flex max-w-3xl flex-wrap items-center gap-2 border-t border-border/40 pt-3">
      <ActionBtn label="Waiting on You" onClick={() => onStatus("waiting_on_applicant")} />
      <ActionBtn label="Waiting on Alta" onClick={() => onStatus("waiting_on_alta")} />
      {context.status === "closed" ? (
        allowReopen ? (
          <ActionBtn label={copy.reopenActionLabel} onClick={onReopen} accent />
        ) : null
      ) : (
        <ActionBtn label={copy.closeActionLabel} onClick={onClose} />
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
