"use client";

import type { ReactNode } from "react";
import { AlertCircle, Check, Clock3 } from "lucide-react";
import {
  BankActionFooter,
  BankActionPrimaryButton,
  BankActionSecondaryButton,
} from "@/components/bank/actions/bank-action-buttons";
import {
  BANK_PROCESS_MOTION,
  type BankProcessOutcomeKind,
  type BankProcessSummaryRow,
} from "@/lib/bank/bank-process";
import { cn } from "@/lib/utils";

export function BankProcessSummary({
  rows,
  className,
}: {
  rows: BankProcessSummaryRow[];
  className?: string;
}) {
  return (
    <dl className={cn("space-y-3 text-[14px]", className)}>
      {rows.map((row) => (
        <div key={row.label} className="flex justify-between gap-4">
          <dt className="shrink-0 text-muted-foreground">{row.label}</dt>
          <dd
            className={cn(
              "min-w-0 text-right font-medium text-foreground",
              row.mono && "font-mono text-[12px] font-normal",
            )}
          >
            <span className="block break-words">{row.value}</span>
            {row.secondary ? (
              <span className="mt-0.5 block text-[12px] font-normal text-muted-foreground">
                {row.secondary}
              </span>
            ) : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function ProcessingGraphic() {
  return (
    <svg viewBox="0 0 40 40" className="size-10 text-foreground" aria-hidden>
      <circle
        cx="20"
        cy="20"
        r="16"
        className="stroke-surface-2"
        strokeWidth="3"
        fill="none"
      />
      <circle
        cx="20"
        cy="20"
        r="16"
        className="origin-center stroke-current motion-safe:animate-[spin_1.1s_linear_infinite] motion-reduce:animate-none"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="70 100"
        fill="none"
      />
    </svg>
  );
}

export function BankProcessGraphic({
  kind,
}: {
  kind: BankProcessOutcomeKind | "processing";
  /** @deprecated Transfer arrow removed; all processing uses the progress ring. */
  variant?: "pulse" | "transfer" | "progress";
}) {
  if (kind === "processing") {
    return <ProcessingGraphic />;
  }

  if (kind === "success") {
    return (
      <div
        className="flex size-12 items-center justify-center rounded-full bg-foreground text-background"
        aria-hidden
        style={{ animationDuration: `${BANK_PROCESS_MOTION.successMs}ms` }}
      >
        <Check className="size-6 motion-safe:animate-in motion-safe:zoom-in-50 motion-reduce:animate-none" />
      </div>
    );
  }

  if (kind === "pending") {
    return (
      <div
        className="flex size-12 items-center justify-center rounded-full border border-border bg-surface-2 text-foreground"
        aria-hidden
      >
        <Clock3 className="size-6" />
      </div>
    );
  }

  return (
    <div
      className="flex size-12 items-center justify-center rounded-full border border-destructive/40 bg-destructive/10 text-destructive"
      aria-hidden
    >
      <AlertCircle className="size-6" />
    </div>
  );
}

export function BankProcessState({
  kind,
  title,
  children,
  graphicVariant: _graphicVariant = "progress",
  liveMessage,
  className,
}: {
  kind: BankProcessOutcomeKind | "processing";
  title: string;
  children?: ReactNode;
  /** @deprecated Ignored — processing always uses the progress ring. */
  graphicVariant?: "pulse" | "transfer" | "progress";
  liveMessage?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-4 py-6 text-center",
        kind === "processing" && "py-10",
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy={kind === "processing" ? true : undefined}
    >
      <BankProcessGraphic kind={kind} />
      <div className="space-y-2">
        <p className="text-[15px] font-semibold text-foreground">{title}</p>
        {children ? (
          <div className="space-y-1.5 text-[13px] leading-relaxed text-muted-foreground">
            {children}
          </div>
        ) : null}
      </div>
      <span className="sr-only">{liveMessage ?? title}</span>
    </div>
  );
}

export function BankProcessResult({
  kind,
  title,
  children,
  summary,
  onDone,
  onSecondary,
  secondaryLabel,
  liveMessage,
  graphicVariant,
}: {
  kind: BankProcessOutcomeKind;
  title: string;
  children?: ReactNode;
  summary?: BankProcessSummaryRow[];
  onDone: () => void;
  onSecondary?: () => void;
  secondaryLabel?: string;
  liveMessage?: string;
  graphicVariant?: "pulse" | "transfer" | "progress";
}) {
  return (
    <div className="space-y-5">
      <BankProcessState
        kind={kind}
        title={title}
        liveMessage={liveMessage}
        graphicVariant={graphicVariant}
      >
        {children}
      </BankProcessState>
      {summary && summary.length > 0 ? (
        <div className="rounded-xl border border-border/70 px-4 py-3 text-left">
          <BankProcessSummary rows={summary} />
        </div>
      ) : null}
      <BankActionFooter>
        {onSecondary ? (
          <BankActionSecondaryButton onClick={onSecondary}>
            {secondaryLabel ?? "Make another"}
          </BankActionSecondaryButton>
        ) : null}
        <BankActionPrimaryButton onClick={onDone}>Done</BankActionPrimaryButton>
      </BankActionFooter>
    </div>
  );
}

export function BankProcessError({
  title = "Something went wrong",
  message,
  onEdit,
  onRetry,
  editLabel = "Edit details",
  retryLabel = "Back to review",
}: {
  title?: string;
  message: string;
  onEdit?: () => void;
  onRetry?: () => void;
  editLabel?: string;
  retryLabel?: string;
}) {
  return (
    <div className="space-y-5">
      <BankProcessState kind="error" title={title} liveMessage={`${title}. ${message}`}>
        <p role="alert">{message}</p>
      </BankProcessState>
      <BankActionFooter>
        {onEdit ? (
          <BankActionSecondaryButton onClick={onEdit}>{editLabel}</BankActionSecondaryButton>
        ) : null}
        {onRetry ? (
          <BankActionPrimaryButton onClick={onRetry}>{retryLabel}</BankActionPrimaryButton>
        ) : null}
      </BankActionFooter>
    </div>
  );
}

/** Dedicated processing view — never fall back to Details. */
export function BankActionProgressView({
  label,
  variant = "progress",
}: {
  label: string;
  variant?: "pulse" | "transfer" | "progress";
}) {
  return (
    <BankProcessState kind="processing" title={label} graphicVariant={variant} liveMessage={label} />
  );
}
