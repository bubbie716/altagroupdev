import { AlertCircle, Check, Info, Loader2, X } from "lucide-react";
import type { ReactNode } from "react";
import { SUBMITTING_COPY } from "@/lib/ui/route-loading";
import { cn } from "@/lib/utils";
import {
  BANK_ALTA_PAY_SUCCESS_BODY,
  BANK_CARD_PAYMENT_SUCCESS_BODY,
  BANK_CASH_ADVANCE_SUCCESS_BODY,
  BANK_COMMERCIAL_PRO_UPGRADE_SUCCESS_BODY,
  BANK_COMMERCIAL_PRO_DOWNGRADE_SUCCESS_BODY,
  BANK_LOAN_PAYMENT_SUCCESS_BODY,
  BANK_MERCHANT_INVOICE_PAY_SUCCESS_BODY,
  BANK_MERCHANT_INVOICE_SENT_SUCCESS_BODY,
  BANK_PAYMENT_LINK_CHECKOUT_SUCCESS_BODY,
  BANK_REQUEST_SUCCESS_BODY,
  BANK_SUBMISSION_ERROR_FALLBACK,
  BANK_TRANSFER_SUCCESS_BODY,
} from "@/lib/bank/bank-shared-copy";

export const BANK_REQUESTS_IN_PROGRESS_ID = "bank-requests-in-progress";

export type BankRequestSubmissionResult = {
  referenceCode: string;
  amount: number;
  submittedAt: string;
  accountName: string;
  accountNumber: string;
};

export type BankRequestKind =
  | "deposit"
  | "withdrawal"
  | "transfer"
  | "alta_pay"
  | "merchant_invoice"
  | "merchant_invoice_payment"
  | "payment_link_checkout"
  | "cash_advance"
  | "commercial_pro_upgrade"
  | "commercial_pro_downgrade"
  | "card_payment"
  | "loan_payment";

const COPY = {
  deposit: {
    submit: "Submit Deposit",
    submitting: SUBMITTING_COPY.submittingDeposit,
    successTitle: "Deposit Submitted",
    submitAnother: "Submit Another Deposit",
    successBody: BANK_REQUEST_SUCCESS_BODY,
    successHint: (
      <>
        You can monitor the status of your request below under{" "}
        <strong className="font-medium text-foreground">Requests in Progress</strong>.
      </>
    ),
  },
  withdrawal: {
    submit: "Submit Withdrawal",
    submitting: SUBMITTING_COPY.submittingWithdrawal,
    successTitle: "Withdrawal Submitted",
    submitAnother: "Submit Another Withdrawal",
    successBody: BANK_REQUEST_SUCCESS_BODY,
    successHint: (
      <>
        You can monitor the status of your request below under{" "}
        <strong className="font-medium text-foreground">Requests in Progress</strong>.
      </>
    ),
  },
  transfer: {
    submit: "Transfer Funds",
    submitting: SUBMITTING_COPY.transferringFunds,
    successTitle: "Transfer Completed",
    submitAnother: "Make Another Transfer",
    successBody: BANK_TRANSFER_SUCCESS_BODY,
    successHint: (
      <>
        You can review this transfer below in{" "}
        <strong className="font-medium text-foreground">Transfer History</strong>.
      </>
    ),
  },
  alta_pay: {
    submit: "Confirm Payment",
    submitting: SUBMITTING_COPY.processingPayment,
    successTitle: "Payment Sent",
    submitAnother: "Send Another Payment",
    successBody: BANK_ALTA_PAY_SUCCESS_BODY,
    successHint: (
      <>
        You can review this payment below in{" "}
        <strong className="font-medium text-foreground">Payment History</strong>.
      </>
    ),
  },
  merchant_invoice: {
    submit: "Send Invoice",
    submitting: SUBMITTING_COPY.sendingInvoice,
    successTitle: "Invoice Sent",
    submitAnother: "Send Another Invoice",
    successBody: BANK_MERCHANT_INVOICE_SENT_SUCCESS_BODY,
    successHint: (
      <>
        Track status and send reminders from your{" "}
        <strong className="font-medium text-foreground">Merchant Invoices</strong> dashboard.
      </>
    ),
  },
  merchant_invoice_payment: {
    submit: "Confirm Payment",
    submitting: SUBMITTING_COPY.processingPayment,
    successTitle: "Invoice Paid",
    submitAnother: "View Invoices",
    successBody: BANK_MERCHANT_INVOICE_PAY_SUCCESS_BODY,
    successHint: (
      <>
        You can review this payment in your{" "}
        <strong className="font-medium text-foreground">Received Invoices</strong> inbox.
      </>
    ),
  },
  payment_link_checkout: {
    submit: "Confirm Payment",
    submitting: SUBMITTING_COPY.processingPayment,
    successTitle: "Payment Complete",
    submitAnother: "Back to Alta Bank",
    successBody: BANK_PAYMENT_LINK_CHECKOUT_SUCCESS_BODY,
    successHint: (
      <>
        Your receipt is available in{" "}
        <strong className="font-medium text-foreground">Notifications</strong>.
      </>
    ),
  },
  cash_advance: {
    submit: "Confirm Cash Advance",
    submitting: SUBMITTING_COPY.processingCashAdvance,
    successTitle: "Cash Advance Completed",
    submitAnother: "Request Another Cash Advance",
    successBody: BANK_CASH_ADVANCE_SUCCESS_BODY,
    successHint: (
      <>
        You can review this cash advance in your{" "}
        <strong className="font-medium text-foreground">Alta Card transaction history</strong>.
      </>
    ),
  },
  commercial_pro_upgrade: {
    submit: "Confirm Upgrade",
    submitting: SUBMITTING_COPY.processingUpgrade,
    successTitle: "Alta Commercial Pro Activated",
    submitAnother: "Close",
    successBody: BANK_COMMERCIAL_PRO_UPGRADE_SUCCESS_BODY,
    successHint: (
      <>
        Manage your plan and billing from{" "}
        <strong className="font-medium text-foreground">Commercial settings</strong>.
      </>
    ),
  },
  commercial_pro_downgrade: {
    submit: "Confirm Downgrade",
    submitting: SUBMITTING_COPY.processingDowngrade,
    successTitle: "Downgraded to Alta Commercial Core",
    submitAnother: "Close",
    successBody: BANK_COMMERCIAL_PRO_DOWNGRADE_SUCCESS_BODY,
    successHint: (
      <>
        Review your updated plan and limits from{" "}
        <strong className="font-medium text-foreground">Commercial settings</strong>.
      </>
    ),
  },
  card_payment: {
    submit: "Confirm Payment",
    submitting: SUBMITTING_COPY.processingPayment,
    successTitle: "Payment Posted",
    submitAnother: "Make Another Payment",
    successBody: BANK_CARD_PAYMENT_SUCCESS_BODY,
    successHint: (
      <>
        You can review this payment in your{" "}
        <strong className="font-medium text-foreground">Alta Card transaction history</strong>.
      </>
    ),
  },
  loan_payment: {
    submit: "Confirm Payment",
    submitting: SUBMITTING_COPY.processingPayment,
    successTitle: "Payment Posted",
    submitAnother: "Make Another Payment",
    successBody: BANK_LOAN_PAYMENT_SUCCESS_BODY,
    successHint: (
      <>
        You can review this payment in your{" "}
        <strong className="font-medium text-foreground">loan payment history</strong>.
      </>
    ),
  },
} as const;

const resultCardClass =
  "mx-auto w-full max-w-sm rounded-2xl border border-border/70 bg-surface-1 px-7 py-9 text-center shadow-[0_10px_40px_-16px_hsl(var(--foreground)/0.14)]";

function ResultIcon({ variant, compact = false }: { variant: "success" | "error"; compact?: boolean }) {
  const isSuccess = variant === "success";
  return (
    <div
      className={cn(
        "mx-auto flex items-center justify-center rounded-full",
        compact ? "size-12" : "size-[4.5rem]",
        isSuccess ? "bg-[var(--success)]/14" : "bg-destructive/12",
      )}
    >
      {isSuccess ? (
        <Check
          className={cn(compact ? "size-6" : "size-9", "text-[var(--success)]")}
          strokeWidth={2.25}
          aria-hidden
        />
      ) : (
        <X
          className={cn(compact ? "size-6" : "size-9", "text-destructive")}
          strokeWidth={2.25}
          aria-hidden
        />
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

const primaryActionButtonClass =
  "inline-flex w-full items-center justify-center gap-2 rounded-md bg-foreground px-5 py-2.5 text-[13px] font-medium tracking-wide text-background transition-opacity disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto";

/** Primary action button for non-form flows (onClick handlers). */
export function BankRequestActionButton({
  children,
  onClick,
  submitting = false,
  submittingLabel,
  disabled = false,
}: {
  children: ReactNode;
  onClick: () => void;
  submitting?: boolean;
  submittingLabel?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || submitting}
      className={primaryActionButtonClass}
    >
      {submitting ? (
        <>
          <Loader2 className="size-4 animate-spin opacity-80" aria-hidden />
          {submittingLabel ?? SUBMITTING_COPY.working}
        </>
      ) : (
        children
      )}
    </button>
  );
}

export function BankRequestSubmitButton({
  kind,
  submitting,
  disabled,
  label,
  submittingLabel,
  showContainer = true,
}: {
  kind: BankRequestKind;
  submitting: boolean;
  disabled?: boolean;
  label?: string;
  submittingLabel?: string;
  showContainer?: boolean;
}) {
  const labels = COPY[kind];
  const button = (
    <button
      type="submit"
      disabled={disabled || submitting}
      className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-foreground px-5 py-2.5 text-[13px] font-medium tracking-wide text-background transition-opacity disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
    >
      {submitting ? (
        <>
          <Loader2 className="size-4 animate-spin opacity-80" aria-hidden />
          {submittingLabel ?? labels.submitting}
        </>
      ) : (
        label ?? labels.submit
      )}
    </button>
  );

  if (!showContainer) return button;
  return <div className="pt-4">{button}</div>;
}

export function BankRequestSuccessCard({
  kind,
  onSubmitAnother,
  variant = "standalone",
}: {
  kind: BankRequestKind;
  result: BankRequestSubmissionResult;
  onSubmitAnother: () => void;
  variant?: "standalone" | "embedded";
}) {
  const labels = COPY[kind];
  const embedded = variant === "embedded";

  return (
    <div
      className={cn(
        embedded ? "text-center" : resultCardClass,
        "animate-in fade-in zoom-in-95 duration-300",
      )}
    >
      <ResultIcon variant="success" compact={embedded} />

      <h2
        className={cn(
          "font-semibold tracking-tight",
          embedded ? "mt-4 text-lg" : "mt-5 text-[1.2rem]",
        )}
      >
        {labels.successTitle}
      </h2>

      <p
        className={cn(
          "leading-relaxed text-muted-foreground",
          embedded ? "mt-2 text-[13px]" : "mt-2.5 text-[14px]",
        )}
      >
        {labels.successBody}
      </p>

      <div className={cn("border-t border-border/70", embedded ? "my-4" : "my-6")} />

      <Callout variant="info">{labels.successHint}</Callout>

      <div className={embedded ? "mt-4" : "mt-5"}>
        <SecondaryButton onClick={onSubmitAnother}>{labels.submitAnother}</SecondaryButton>
      </div>
    </div>
  );
}

export function BankRequestErrorCard({
  reason,
  onTryAgain,
  variant = "standalone",
}: {
  reason?: string | null;
  onTryAgain: () => void;
  variant?: "standalone" | "embedded";
}) {
  const embedded = variant === "embedded";

  return (
    <div
      className={cn(
        embedded ? "text-center" : resultCardClass,
        "animate-in fade-in slide-in-from-bottom-2 duration-300",
      )}
    >
      <ResultIcon variant="error" compact={embedded} />

      <h2
        className={cn(
          "font-semibold tracking-tight",
          embedded ? "mt-4 text-lg" : "mt-5 text-[1.2rem]",
        )}
      >
        We couldn&apos;t submit your request.
      </h2>

      <p
        className={cn(
          "leading-relaxed text-muted-foreground",
          embedded ? "mt-2 text-[13px]" : "mt-2.5 text-[14px]",
        )}
      >
        Your request wasn&apos;t submitted. Please try again.
      </p>

      <div className={cn("border-t border-border/70", embedded ? "my-4" : "my-6")} />

      <Callout variant="warning">
        {reason ?? BANK_SUBMISSION_ERROR_FALLBACK}
      </Callout>

      <div className={embedded ? "mt-4" : "mt-5"}>
        <SecondaryButton onClick={onTryAgain}>Try Again</SecondaryButton>
      </div>
    </div>
  );
}
