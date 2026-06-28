"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { invalidateRouteData } from "@/lib/router/invalidate-route-data";
import { OpsAction } from "@/components/internal/ops-action";

function formatActionError(error: unknown): string {
  if (error instanceof Error) {
    return error.message.replace(/^BAD_REQUEST:/, "").replace(/^FORBIDDEN$/, "Admin permission required.");
  }
  return "This action could not be completed. Try again.";
}

/**
 * Internal review action — delegates to OpsAction with confirmation + reason.
 * Set requireReason=false only for customer-facing business UI (not internal console).
 */
export function BankReviewButton({
  label,
  variant = "default",
  title,
  description,
  impact,
  confirmLabel,
  onAction,
  requireReason = true,
}: {
  label: string;
  variant?: "default" | "primary" | "danger";
  title?: string;
  description?: string;
  impact?: ReactNode;
  confirmLabel?: string;
  onAction: (reason: string) => Promise<void>;
  requireReason?: boolean;
}) {
  const router = useRouter();
  const [legacyError, setLegacyError] = useState<string | null>(null);
  const [legacyPending, setLegacyPending] = useState(false);

  if (!requireReason) {
    async function handleLegacyClick() {
      setLegacyPending(true);
      setLegacyError(null);
      try {
        await onAction("");
        await invalidateRouteData(router);
      } catch (err) {
        setLegacyError(formatActionError(err));
      } finally {
        setLegacyPending(false);
      }
    }

    return (
      <span className="inline-flex flex-col gap-1">
        <button
          type="button"
          disabled={legacyPending}
          onClick={() => void handleLegacyClick()}
          className={cn(
            "h-7 rounded border px-2.5 text-[11px] font-medium disabled:opacity-50",
            variant === "primary" && "border-gold/40 bg-gold/10 text-gold",
            variant === "danger" && "border-destructive/30 text-destructive/90",
            variant === "default" && "border-border bg-surface-1 text-foreground",
          )}
        >
          {legacyPending ? "…" : label}
        </button>
        {legacyError ? (
          <span className="max-w-[220px] text-[10px] leading-snug text-destructive">{legacyError}</span>
        ) : null}
      </span>
    );
  }

  return (
    <OpsAction
      label={label}
      variant={variant}
      title={title ?? label}
      description={description}
      impact={impact}
      confirmLabel={confirmLabel ?? label}
      requireReason
      onConfirm={async (reason) => {
        await onAction(reason);
        await invalidateRouteData(router);
      }}
    />
  );
}
