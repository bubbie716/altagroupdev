"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  BankActionFooter,
  BankActionPrimaryButton,
  BankActionSecondaryButton,
} from "@/components/bank/actions/bank-action-buttons";
import {
  BankActionProgressView,
  BankProcessResult,
} from "@/components/bank/actions/bank-process-ui";
import type { BankProcessSummaryRow } from "@/lib/bank/bank-process";

export {
  BankActionFooter,
  BankActionPrimaryButton,
  BankActionSecondaryButton,
} from "@/components/bank/actions/bank-action-buttons";

export function BankActionProgress({
  step,
  total,
  label,
}: {
  /** 1-based current step */
  step: number;
  total: number;
  label?: string;
}) {
  const safeStep = Math.min(Math.max(step, 1), total);
  return (
    <div className="mb-4" aria-label={label ?? `Step ${safeStep} of ${total}`}>
      <div className="flex gap-1">
        {Array.from({ length: total }).map((_, index) => (
          <div
            key={index}
            className={cn(
              "h-1 flex-1 rounded-full",
              index < safeStep ? "bg-foreground" : "bg-surface-2",
            )}
            aria-hidden
          />
        ))}
      </div>
      {label ? <p className="mt-2 text-[12px] text-muted-foreground">{label}</p> : null}
    </div>
  );
}

export function BankActionProcessing({
  label = "Processing…",
  variant = "progress",
}: {
  label?: string;
  variant?: "pulse" | "transfer" | "progress";
}) {
  return <BankActionProgressView label={label} variant={variant} />;
}

export function BankActionSuccess({
  title,
  children,
  onDone,
  onMakeAnother,
  makeAnotherLabel = "Make another",
  liveMessage,
  kind = "success",
  summary,
  refreshStatus,
  onRetryRefresh,
}: {
  title: string;
  children?: ReactNode;
  onDone: () => void;
  onMakeAnother?: () => void;
  makeAnotherLabel?: string;
  liveMessage?: string;
  kind?: "success" | "pending";
  summary?: BankProcessSummaryRow[];
  refreshStatus?: "idle" | "refreshing" | "updated" | "failed";
  onRetryRefresh?: () => void;
}) {
  return (
    <BankProcessResult
      kind={kind}
      title={title}
      liveMessage={liveMessage}
      summary={summary}
      onDone={onDone}
      onSecondary={onMakeAnother}
      secondaryLabel={makeAnotherLabel}
      refreshStatus={refreshStatus}
      onRetryRefresh={onRetryRefresh}
    >
      {children}
    </BankProcessResult>
  );
}

export function BankActionChoiceCard({
  title,
  description,
  icon,
  disabled,
  badge,
  onClick,
}: {
  title: string;
  description: string;
  icon?: ReactNode;
  disabled?: boolean;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl border border-border bg-surface-1 px-4 py-3.5 text-left transition-colors",
        "hover:border-border-strong hover:bg-[var(--menu-item-hover)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "min-h-11",
      )}
    >
      {icon ? <span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span> : null}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-[14px] font-medium text-foreground">{title}</span>
          {badge ? (
            <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted-foreground">
              {badge}
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 block text-[13px] text-muted-foreground">{description}</span>
      </span>
    </button>
  );
}
