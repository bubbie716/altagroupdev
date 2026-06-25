"use client";

import { useState, type ReactNode } from "react";

export function OpsConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  variant = "default",
  requireReason = true,
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
  children?: ReactNode;
  onCancel: () => void;
  onConfirm: (reason: string) => void | Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleConfirm() {
    if (requireReason && !reason.trim()) {
      setError("Reason is required.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await onConfirm(reason.trim());
      setReason("");
      onCancel();
    } catch (e) {
      setError(e instanceof Error ? e.message.replace(/^BAD_REQUEST:/, "") : "Action failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-background p-5 shadow-elevated">
        <h3 className="text-base font-medium tracking-tight">{title}</h3>
        {description ? (
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
        {children ? <div className="mt-4 space-y-3">{children}</div> : null}
        {requireReason ? (
          <div className="mt-4">
            <label className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Reason (required)
            </label>
            <textarea
              className="mt-1 min-h-[72px] w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Document why this action is being taken"
            />
          </div>
        ) : null}
        {error ? <p className="mt-2 text-[12px] text-destructive">{error}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={onCancel}
            className="rounded-md border border-border px-3 py-2 text-[12px]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => void handleConfirm()}
            className={
              variant === "danger"
                ? "rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[12px] text-destructive"
                : "rounded-md border border-gold/40 bg-gold/10 px-3 py-2 text-[12px] text-gold"
            }
          >
            {pending ? "Processing…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
