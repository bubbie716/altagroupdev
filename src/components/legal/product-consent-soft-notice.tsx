"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Non-blocking notice for soft existing-obligation routes.
 * Does not cover the page or trap focus; Escape/backdrop dismissible via close control.
 */
export function ProductConsentSoftNotice({
  title,
  explanation,
  theme = "bank",
  onReview,
  onDismiss,
}: {
  title: string;
  explanation: string;
  theme?: "bank" | "terminal";
  onReview: () => void;
  onDismiss: () => void;
}) {
  const titleId = useId();
  const [visible, setVisible] = useState(true);
  if (!visible) return null;

  const isTerminal = theme === "terminal";

  return (
    <aside
      role="region"
      aria-labelledby={titleId}
      className={cn(
        "mb-4 rounded-lg border px-4 py-3",
        isTerminal
          ? "border-white/12 bg-[#14181c] text-white"
          : "border-border/70 bg-surface-2/50 text-foreground",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <p id={titleId} className="text-[13px] font-semibold tracking-tight">
            {title}
          </p>
          <p
            className={cn(
              "text-[12px] leading-relaxed",
              isTerminal ? "text-white/65" : "text-muted-foreground",
            )}
          >
            {explanation} You can continue viewing existing activity. New protected actions require
            acceptance.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onReview}
            className={cn(
              "inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-3 text-[13px] font-medium",
              "focus-visible:outline-none focus-visible:ring-2",
              isTerminal
                ? "bg-emerald-500 text-black focus-visible:ring-emerald-400/50"
                : "bg-foreground text-background focus-visible:ring-ring",
            )}
          >
            Review terms
          </button>
          <button
            type="button"
            onClick={() => {
              setVisible(false);
              onDismiss();
            }}
            className={cn(
              "inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border px-3 text-[13px]",
              "focus-visible:outline-none focus-visible:ring-2",
              isTerminal
                ? "border-white/15 text-white/80 hover:bg-white/5 focus-visible:ring-white/30"
                : "border-border text-muted-foreground hover:bg-surface-1 focus-visible:ring-ring/40",
            )}
          >
            Dismiss
          </button>
        </div>
      </div>
    </aside>
  );
}
