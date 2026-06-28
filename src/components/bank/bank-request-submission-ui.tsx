import { AlertCircle, Check, Info, Loader2, X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { BANK_REQUEST_SUCCESS_BODY, BANK_SUBMISSION_ERROR_FALLBACK } from "@/lib/bank/bank-shared-copy";

export const BANK_REQUESTS_IN_PROGRESS_ID = "bank-requests-in-progress";

export type BankRequestSubmissionResult = {
  referenceCode: string;
  amount: number;
  submittedAt: string;
  accountName: string;
  accountNumber: string;
};

export type BankRequestKind = "deposit" | "withdrawal";

const COPY = {
  deposit: {
    submit: "Submit Deposit",
    submitting: "Submitting Deposit…",
    successTitle: "Deposit Submitted",
    submitAnother: "Submit Another Deposit",
  },
  withdrawal: {
    submit: "Submit Withdrawal",
    submitting: "Submitting Withdrawal…",
    successTitle: "Withdrawal Submitted",
    submitAnother: "Submit Another Withdrawal",
  },
} as const;

const resultCardClass =
  "mx-auto w-full max-w-sm rounded-2xl border border-border/70 bg-surface-1 px-7 py-9 text-center shadow-[0_10px_40px_-16px_hsl(var(--foreground)/0.14)]";

function ResultIcon({ variant }: { variant: "success" | "error" }) {
  const isSuccess = variant === "success";
  return (
    <div
      className={cn(
        "mx-auto flex size-[4.5rem] items-center justify-center rounded-full",
        isSuccess ? "bg-[var(--success)]/14" : "bg-destructive/12",
      )}
    >
      {isSuccess ? (
        <Check className="size-9 text-[var(--success)]" strokeWidth={2.25} aria-hidden />
      ) : (
        <X className="size-9 text-destructive" strokeWidth={2.25} aria-hidden />
      )}
    </div>
  );
}

function Callout({
  variant,
  children,
}: {
  variant: "info" | "warning";
  children: ReactNode;
}) {
  const isInfo = variant === "info";
  return (
    <div
      className={cn(
        "flex gap-3 rounded-xl px-4 py-3.5 text-left text-[13px] leading-relaxed",
        isInfo ? "bg-gold/10 text-muted-foreground" : "bg-destructive/8 text-muted-foreground",
      )}
    >
      {isInfo ? (
        <Info className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden />
      ) : (
        <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
      )}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function SecondaryButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-xl border border-border/80 bg-background px-4 py-3 text-[14px] font-medium tracking-tight text-foreground transition-colors hover:bg-surface-2/60"
    >
      {children}
    </button>
  );
}

export function BankRequestSubmitButton({
  kind,
  submitting,
  disabled,
}: {
  kind: BankRequestKind;
  submitting: boolean;
  disabled?: boolean;
}) {
  const labels = COPY[kind];
  return (
    <div className="pt-4">
      <button
        type="submit"
        disabled={disabled || submitting}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-foreground px-5 py-2.5 text-[13px] font-medium tracking-wide text-background transition-opacity disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {submitting ? (
          <>
            <Loader2 className="size-4 animate-spin opacity-80" aria-hidden />
            {labels.submitting}
          </>
        ) : (
          labels.submit
        )}
      </button>
    </div>
  );
}

export function BankRequestSuccessCard({
  kind,
  onSubmitAnother,
}: {
  kind: BankRequestKind;
  result: BankRequestSubmissionResult;
  onSubmitAnother: () => void;
}) {
  const labels = COPY[kind];

  return (
    <div className={cn(resultCardClass, "animate-in fade-in zoom-in-95 duration-300")}>
      <ResultIcon variant="success" />

      <h2 className="mt-5 text-[1.2rem] font-semibold tracking-tight">{labels.successTitle}</h2>

      <p className="mt-2.5 text-[14px] leading-relaxed text-muted-foreground">
        {BANK_REQUEST_SUCCESS_BODY}
      </p>

      <div className="my-6 border-t border-border/70" />

      <Callout variant="info">
        You can monitor the status of your request below under{" "}
        <strong className="font-medium text-foreground">Requests in Progress</strong>.
      </Callout>

      <div className="mt-5">
        <SecondaryButton onClick={onSubmitAnother}>{labels.submitAnother}</SecondaryButton>
      </div>
    </div>
  );
}

export function BankRequestErrorCard({
  reason,
  onTryAgain,
}: {
  reason?: string | null;
  onTryAgain: () => void;
}) {
  return (
    <div className={cn(resultCardClass, "animate-in fade-in slide-in-from-bottom-2 duration-300")}>
      <ResultIcon variant="error" />

      <h2 className="mt-5 text-[1.2rem] font-semibold tracking-tight">
        We couldn&apos;t submit your request.
      </h2>

      <p className="mt-2.5 text-[14px] leading-relaxed text-muted-foreground">
        Your request wasn&apos;t submitted. Please try again.
      </p>

      <div className="my-6 border-t border-border/70" />

      <Callout variant="warning">
        {reason ?? BANK_SUBMISSION_ERROR_FALLBACK}
      </Callout>

      <div className="mt-5">
        <SecondaryButton onClick={onTryAgain}>Try Again</SecondaryButton>
      </div>
    </div>
  );
}
