import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LoanPaymentForm } from "@/components/bank/loan-payment-form";
import { florin } from "@/lib/bank/api";
import { fetchLoanPaymentContext } from "@/lib/bank/lending.functions";
import type { LoanPaymentContext, LoanRow } from "@/lib/bank/lending-types";

function parseLoadError(err: unknown): string {
  const message = err instanceof Error ? err.message : "Could not load payment form";
  if (message === "FORBIDDEN") return "You do not have permission to pay this loan.";
  if (message === "NOT_FOUND") return "Loan not found.";
  return message;
}

export function LoanRepaymentDialog({
  loan,
  open,
  onOpenChange,
  onPaid,
}: {
  loan: LoanRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPaid: () => void | Promise<void>;
}) {
  const loadContext = useServerFn(fetchLoanPaymentContext);
  const [context, setContext] = useState<LoanPaymentContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setContext(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void loadContext({ data: loan.id })
      .then((data) => {
        if (!cancelled) setContext(data);
      })
      .catch((err) => {
        if (!cancelled) setError(parseLoadError(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, loan.id, loadContext]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-border bg-background">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm uppercase tracking-[0.12em]">Make payment</DialogTitle>
          <DialogDescription>
            {loan.productLabel} · Payoff today {florin(loan.currentPayoffAmount)}
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <p className="text-[13px] text-muted-foreground">Loading payment options…</p>
        )}

        {error && (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-[13px] text-destructive">
            {error}
          </p>
        )}

        {context && !loading && !error && !context.canMakePayment && (
          <p className="text-[13px] text-muted-foreground">
            Payments are not available for this loan. It may be paid off, frozen, or you may have view-only access.
          </p>
        )}

        {context?.canMakePayment && !loading && (
          <LoanPaymentForm
            loan={context.loan}
            sourceAccounts={context.sourceAccounts}
            suggestedAmount={context.loan.currentPayoffAmount}
            onSuccess={async () => {
              await onPaid();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
