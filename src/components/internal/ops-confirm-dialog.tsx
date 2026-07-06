"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { SilentNotificationToggle } from "@/components/internal/silent-notification-toggle";
import type { OpsConfirmOptions } from "@/lib/internal/operator-notification-options";
import { SUBMITTING_COPY } from "@/lib/ui/route-loading";

export function OpsConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  variant = "default",
  requireReason = true,
  showSilentNotificationToggle = false,
  children,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  variant?: "default" | "danger";
  requireReason?: boolean;
  /** When true, shows "Silent (Do not notify customer)" — default OFF. */
  showSilentNotificationToggle?: boolean;
  children?: ReactNode;
  onCancel: () => void;
  onConfirm: (reason: string, options?: OpsConfirmOptions) => void | Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [silentNotification, setSilentNotification] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, pending, onCancel]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      setReason("");
      setSilentNotification(false);
      setError(null);
      dialogRef.current?.focus();
    }
  }, [open]);

  if (!open || !mounted) return null;

  async function handleConfirm() {
    if (requireReason && !reason.trim()) {
      setError("A reason is required for this action.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await onConfirm(
        reason.trim(),
        showSilentNotificationToggle ? { silentNotification } : undefined,
      );
      setReason("");
      onCancel();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message.replace(/^BAD_REQUEST:/, "").replace(/^FORBIDDEN$/, "Admin permission required.")
          : "This action could not be completed. Try again.",
      );
    } finally {
      setPending(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] overflow-y-auto bg-black/60 p-4"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) onCancel();
      }}
    >
      <div className="flex min-h-full items-center justify-center">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description ? descId : undefined}
          tabIndex={-1}
          className="my-auto w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-lg border border-border bg-background p-5 shadow-elevated outline-none"
          onClick={(e) => e.stopPropagation()}
        >
        <h3 id={titleId} className="text-[15px] font-medium tracking-tight">
          {title}
        </h3>
        {description ? (
          <p id={descId} className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
        {children ? <div className="mt-4 space-y-3">{children}</div> : null}
        {requireReason ? (
          <div className="mt-4">
            <label
              htmlFor="ops-confirm-reason"
              className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground"
            >
              Reason (required)
            </label>
            <textarea
              id="ops-confirm-reason"
              className="mt-1 min-h-[72px] w-full rounded border border-border bg-surface-1 px-3 py-2 text-[13px] outline-none focus:border-gold/40"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Document why this action is being taken"
            />
          </div>
        ) : null}
        {showSilentNotificationToggle ? (
          <div className="mt-4">
            <SilentNotificationToggle
              checked={silentNotification}
              onChange={setSilentNotification}
              disabled={pending}
            />
          </div>
        ) : null}
        {error ? (
          <p className="mt-2 text-[12px] text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={onCancel}
            className="h-8 rounded border border-border px-3 text-[12px] text-muted-foreground hover:bg-surface-2 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => void handleConfirm()}
            className={
              variant === "danger"
                ? "h-8 rounded border border-destructive/40 bg-destructive/10 px-3 text-[12px] font-medium text-destructive hover:bg-destructive/15 disabled:opacity-50"
                : "h-8 rounded border border-gold/40 bg-gold/10 px-3 text-[12px] font-medium text-gold hover:bg-gold/15 disabled:opacity-50"
            }
          >
            {pending ? SUBMITTING_COPY.processing : confirmLabel}
          </button>
        </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
