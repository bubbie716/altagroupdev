import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import type {
  AltaCardApplicationThreadContext,
  AltaCardApplicationThreadMessageRow,
} from "@/lib/bank/alta-card-application-thread-types";
import {
  sendAltaCardApplicationThreadMessage,
  sendInternalAltaCardApplicationThreadMessage,
} from "@/lib/bank/alta-card-application.functions";
import { linkifyText } from "@/components/bank/loan-thread/thread-attachments";

export function AltaCardApplicationThreadView({
  context,
  messages: initialMessages,
  variant,
}: {
  context: AltaCardApplicationThreadContext;
  messages: AltaCardApplicationThreadMessageRow[];
  variant: "user" | "internal";
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState(initialMessages);
  const [ctx, setCtx] = useState(context);
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendUser = useServerFn(sendAltaCardApplicationThreadMessage);
  const sendInternal = useServerFn(sendInternalAltaCardApplicationThreadMessage);

  useEffect(() => {
    setMessages(initialMessages);
    setCtx(context);
  }, [initialMessages, context]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function submitMessage() {
    const text = body.trim();
    if (!text || !ctx.canSend || pending) return;
    setError(null);
    setPending(true);
    try {
      const send = variant === "internal" ? sendInternal : sendUser;
      const msg = await send({ data: { applicationId: ctx.applicationId, body: text } });
      setMessages((prev) => [...prev, msg]);
      setBody("");
      setCtx((c) => ({
        ...c,
        status: variant === "internal" ? "waiting_on_applicant" : "waiting_on_alta",
        statusLabel: variant === "internal" ? "Waiting on applicant" : "Waiting on Alta",
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message.replace(/^BAD_REQUEST:/, "") : "Failed to send");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface-1">
      <div className="border-b border-border px-4 py-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Application thread
        </p>
        <p className="mt-1 text-[13px]">{ctx.statusLabel}</p>
      </div>

      <div ref={scrollerRef} className="max-h-[420px] space-y-4 overflow-y-auto px-4 py-4">
        {messages.map((msg) => {
          const isApplicant = msg.senderRole === "applicant";
          const isSystem = msg.senderRole === "system";
          return (
            <div
              key={msg.id}
              className={`flex ${isApplicant && variant === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-lg border px-3 py-2 ${
                  isSystem
                    ? "border-border/60 bg-surface-2/80 text-[13px] text-muted-foreground"
                    : isApplicant
                      ? "border-gold/30 bg-gold/5"
                      : "border-border bg-surface-2"
                }`}
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  {msg.senderName}
                </p>
                {msg.body ? (
                  <p className="mt-1 whitespace-pre-wrap text-[14px] leading-relaxed">
                    {linkifyText(msg.body)}
                  </p>
                ) : null}
                <p className="mt-2 font-mono text-[10px] text-muted-foreground">{msg.createdAtLabel}</p>
              </div>
            </div>
          );
        })}
      </div>

      {ctx.canSend ? (
        <div className="border-t border-border p-4">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write a message…"
            rows={3}
            className="w-full resize-none rounded-md border border-border bg-surface-1 px-3 py-2 text-[14px]"
          />
          {error ? <p className="mt-2 text-[13px] text-destructive">{error}</p> : null}
          <button
            type="button"
            disabled={pending || !body.trim()}
            onClick={() => void submitMessage()}
            className="mt-3 rounded-md bg-foreground px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-background disabled:opacity-50"
          >
            {pending ? "Sending…" : "Send"}
          </button>
        </div>
      ) : (
        <div className="border-t border-border px-4 py-3 text-[13px] text-muted-foreground">
          This conversation is closed.
        </div>
      )}
    </div>
  );
}
