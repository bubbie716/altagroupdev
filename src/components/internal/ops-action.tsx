"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { OpsConfirmDialog } from "@/components/internal/ops-confirm-dialog";

export type OpsActionVariant = "default" | "primary" | "danger";

const triggerStyles: Record<OpsActionVariant, string> = {
  default:
    "h-7 rounded border border-border bg-surface-1 px-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground hover:border-border-strong hover:text-foreground disabled:opacity-40",
  primary:
    "h-7 rounded border border-gold/40 bg-gold/10 px-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-gold hover:bg-gold/15 disabled:opacity-40",
  danger:
    "h-7 rounded border border-destructive/30 bg-transparent px-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-destructive/90 hover:bg-destructive/10 disabled:opacity-40",
};

/**
 * Safe internal mutation trigger — confirmation + required reason + audit on server.
 */
export function OpsAction({
  label,
  variant = "default",
  title,
  description,
  impact,
  confirmLabel,
  requireReason = true,
  disabled = false,
  className,
  children,
  onConfirm,
}: {
  label: string;
  variant?: OpsActionVariant;
  title: string;
  description?: string;
  impact?: ReactNode;
  confirmLabel?: string;
  requireReason?: boolean;
  disabled?: boolean;
  className?: string;
  children?: ReactNode;
  onConfirm: (reason: string) => void | Promise<void>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className={cn(triggerStyles[variant], className)}
      >
        {label}
      </button>
      <OpsConfirmDialog
        open={open}
        title={title}
        description={description}
        confirmLabel={confirmLabel ?? label}
        variant={variant === "danger" ? "danger" : "default"}
        requireReason={requireReason}
        onCancel={() => setOpen(false)}
        onConfirm={async (reason) => {
          await onConfirm(reason);
          await router.invalidate();
        }}
      >
        {impact ? (
          <div className="rounded border border-border/60 bg-surface-2/40 px-3 py-2 text-[12px] leading-relaxed text-muted-foreground">
            {impact}
          </div>
        ) : null}
        {children}
      </OpsConfirmDialog>
    </>
  );
}

/** Compact approve / deny pair for queue rows. */
export function OpsApproveDenyActions({
  approveLabel = "Approve",
  denyLabel = "Deny",
  approveTitle,
  denyTitle,
  approveDescription,
  denyDescription,
  approveImpact,
  denyImpact,
  disabled,
  onApprove,
  onDeny,
}: {
  approveLabel?: string;
  denyLabel?: string;
  approveTitle: string;
  denyTitle: string;
  approveDescription?: string;
  denyDescription?: string;
  approveImpact?: ReactNode;
  denyImpact?: ReactNode;
  disabled?: boolean;
  onApprove: (reason: string) => Promise<void>;
  onDeny: (reason: string) => Promise<void>;
}) {
  return (
    <div className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
      <OpsAction
        label={approveLabel}
        variant="primary"
        title={approveTitle}
        description={approveDescription}
        impact={approveImpact}
        confirmLabel={approveLabel}
        disabled={disabled}
        onConfirm={onApprove}
      />
      <OpsAction
        label={denyLabel}
        variant="danger"
        title={denyTitle}
        description={denyDescription}
        impact={denyImpact}
        confirmLabel={denyLabel}
        disabled={disabled}
        onConfirm={onDeny}
      />
    </div>
  );
}
