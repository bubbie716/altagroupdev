"use client";

/**
 * Terminal order process UI — same motion language as Bank actions
 * (Details → Review → Processing → Success | Pending | Error).
 */
import type { ReactNode } from "react";
import { AlertCircle, Check, Clock3 } from "lucide-react";
import {
  BANK_PROCESS_MOTION,
  type BankProcessOutcomeKind,
  type BankProcessSummaryRow,
} from "@/lib/bank/bank-process";
import { cn } from "@/lib/utils";

export type TerminalProcessOutcomeKind = BankProcessOutcomeKind;
export type TerminalProcessSummaryRow = BankProcessSummaryRow;

export {
  BANK_PROCESS_MOTION as TERMINAL_PROCESS_MOTION,
  waitBankProcessMin as waitTerminalProcessMin,
} from "@/lib/bank/bank-process";

export function TerminalProcessSummary({
  rows,
  className,
}: {
  rows: TerminalProcessSummaryRow[];
  className?: string;
}) {
  return (
    <dl className={cn("space-y-3 text-[14px]", className)}>
      {rows.map((row) => (
        <div key={row.label} className="flex justify-between gap-4">
          <dt className="shrink-0 text-[var(--terminal-muted)]">{row.label}</dt>
          <dd
            className={cn(
              "min-w-0 text-right font-medium text-[var(--terminal-text)]",
              row.mono && "font-mono text-[12px] font-normal",
            )}
          >
            <span className="block break-words">{row.value}</span>
            {row.secondary ? (
              <span className="mt-0.5 block text-[12px] font-normal text-[var(--terminal-muted)]">
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
    <svg viewBox="0 0 40 40" className="size-10 text-[var(--terminal-text)]" aria-hidden>
      <circle
        cx="20"
        cy="20"
        r="16"
        className="stroke-[var(--terminal-surface-2)]"
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

export function TerminalProcessGraphic({
  kind,
}: {
  kind: TerminalProcessOutcomeKind | "processing";
}) {
  if (kind === "processing") {
    return <ProcessingGraphic />;
  }

  if (kind === "success") {
    return (
      <div
        className="flex size-12 items-center justify-center rounded-full bg-[var(--terminal-text)] text-[var(--terminal-bg)]"
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
        className="flex size-12 items-center justify-center rounded-full border border-[var(--terminal-border)] bg-[var(--terminal-surface-2)] text-[var(--terminal-text)]"
        aria-hidden
      >
        <Clock3 className="size-6" />
      </div>
    );
  }

  return (
    <div
      className="flex size-12 items-center justify-center rounded-full border border-[var(--terminal-red)]/40 bg-[var(--terminal-red)]/10 text-[var(--terminal-red)]"
      aria-hidden
    >
      <AlertCircle className="size-6" />
    </div>
  );
}

export function TerminalProcessState({
  kind,
  title,
  children,
  liveMessage,
  className,
}: {
  kind: TerminalProcessOutcomeKind | "processing";
  title: string;
  children?: ReactNode;
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
      <TerminalProcessGraphic kind={kind} />
      <div className="space-y-2">
        <p className="text-[15px] font-semibold text-[var(--terminal-text)]">{title}</p>
        {children ? (
          <div className="space-y-1.5 text-[13px] leading-relaxed text-[var(--terminal-muted)]">
            {children}
          </div>
        ) : null}
      </div>
      <span className="sr-only">{liveMessage ?? title}</span>
    </div>
  );
}

export function TerminalProcessResult({
  kind,
  title,
  children,
  summary,
  onDone,
  onSecondary,
  secondaryLabel,
  primaryLabel = "Done",
  onPrimary,
  liveMessage,
}: {
  kind: TerminalProcessOutcomeKind;
  title: string;
  children?: ReactNode;
  summary?: TerminalProcessSummaryRow[];
  onDone: () => void;
  onSecondary?: () => void;
  secondaryLabel?: string;
  primaryLabel?: string;
  onPrimary?: () => void;
  liveMessage?: string;
}) {
  return (
    <div className="space-y-5">
      <TerminalProcessState kind={kind} title={title} liveMessage={liveMessage}>
        {children}
      </TerminalProcessState>
      {summary && summary.length > 0 ? (
        <div className="rounded-xl border border-[var(--terminal-border)] px-4 py-3 text-left">
          <TerminalProcessSummary rows={summary} />
        </div>
      ) : null}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onPrimary ?? onDone}
          className="min-h-11 w-full rounded-md bg-[var(--terminal-green)] px-4 text-[13px] font-medium text-black"
        >
          {primaryLabel}
        </button>
        {onSecondary ? (
          <button
            type="button"
            onClick={onSecondary}
            className="min-h-11 w-full rounded-md border border-[var(--terminal-border)] px-4 text-[13px] text-[var(--terminal-text)]"
          >
            {secondaryLabel ?? "New order"}
          </button>
        ) : null}
        {onPrimary ? (
          <button
            type="button"
            onClick={onDone}
            className="min-h-11 w-full rounded-md text-[13px] text-[var(--terminal-muted)] hover:text-[var(--terminal-text)]"
          >
            Done
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function TerminalProcessError({
  title = "Something went wrong",
  message,
  onEdit,
  onRetry,
  onClose,
  editLabel = "Edit order",
  retryLabel = "Back to review",
  closeLabel = "Close",
}: {
  title?: string;
  message: string;
  onEdit?: () => void;
  onRetry?: () => void;
  onClose?: () => void;
  editLabel?: string;
  retryLabel?: string;
  closeLabel?: string;
}) {
  return (
    <div className="space-y-5">
      <TerminalProcessState kind="error" title={title} liveMessage={`${title}. ${message}`}>
        <p role="alert">{message}</p>
      </TerminalProcessState>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-md border border-[var(--terminal-border)] px-4 text-[13px] text-[var(--terminal-text)]"
          >
            {closeLabel}
          </button>
        ) : null}
        {onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="min-h-11 rounded-md border border-[var(--terminal-border)] px-4 text-[13px] text-[var(--terminal-text)]"
          >
            {editLabel}
          </button>
        ) : null}
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="min-h-11 rounded-md bg-[var(--terminal-green)] px-4 text-[13px] font-medium text-black"
          >
            {retryLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Dedicated processing view — mirrors BankActionProgressView. */
export function TerminalProcessProcessing({ label = "Submitting order…" }: { label?: string }) {
  return <TerminalProcessState kind="processing" title={label} liveMessage={label} />;
}
