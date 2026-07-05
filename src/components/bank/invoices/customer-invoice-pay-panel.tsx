"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/page-shell";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { florin } from "@/lib/bank/api";
import type {
  MerchantInvoiceDetail,
  MerchantInvoicePaymentQuote,
} from "@/lib/bank/merchant-invoice-types";
import type { PayFundingSourceOption } from "@/lib/bank/alta-pay-types";
import {
  payCustomerInvoice,
  quoteCustomerInvoicePayment,
} from "@/lib/bank/merchant-invoice.functions";
import {
  parsePayFundingKey,
  payFundingLabel,
  resolvePayFundingKey,
} from "@/components/bank/alta-pay-form";
import { formatBankActionError } from "@/lib/bank/account-status-copy";
import { formatCustomerActionError } from "@/lib/bank/bank-action-errors";
import {
  BankRequestErrorCard,
  BankRequestSubmitButton,
  BankRequestSuccessCard,
  type BankRequestSubmissionResult,
} from "@/components/bank/bank-request-submission-ui";
import { MerchantInvoiceStatusBadge } from "@/components/bank/merchant-invoices/merchant-invoice-status-badge";
import {
  CommercialBrandedCheckoutShell,
  CommercialBrandedReceiptShell,
} from "@/components/bank/commercial/commercial-branded-checkout-shell";

type FormView = "detail" | "review" | "success" | "error";

const fieldLabel = "type-meta";
const inputClass =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold/40 disabled:cursor-not-allowed disabled:opacity-60";

export function CustomerInvoicePayPanel({
  invoice,
  fundingSources,
  startInPayMode = false,
}: {
  invoice: MerchantInvoiceDetail;
  fundingSources: PayFundingSourceOption[];
  startInPayMode?: boolean;
}) {
  const router = useRouter();
  const quoteFn = useServerFn(quoteCustomerInvoicePayment);
  const payFn = useServerFn(payCustomerInvoice);

  const [view, setView] = useState<FormView>(startInPayMode ? "detail" : "detail");
  const [fundingKey, setFundingKey] = useState(() => resolvePayFundingKey(fundingSources));
  const [quote, setQuote] = useState<MerchantInvoicePaymentQuote | null>(null);
  const [composeError, setComposeError] = useState<string | null>(null);
  const [errorReason, setErrorReason] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submission, setSubmission] = useState<BankRequestSubmissionResult | null>(null);

  const payable = ["SENT", "VIEWED", "OVERDUE"].includes(invoice.status);
  const selectedSource = fundingSources.find(
    (source) => `${source.kind}:${source.id}` === fundingKey,
  );
  const availableBalance = selectedSource?.availableBalance ?? 0;

  useEffect(() => {
    if (!startInPayMode || !payable || fundingSources.length === 0) return;
    void goToReview();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on initial pay mode
  }, []);

  function showSubmitError(message: string) {
    setErrorReason(message);
    setView("error");
  }

  function validateFunding(amountDue: number): string | null {
    if (!selectedSource) return "Select a funding source.";
    if (amountDue <= 0) return "This invoice has no balance due.";
    if (amountDue > availableBalance) {
      return selectedSource.kind === "bank_account" &&
        selectedSource.accountStatusInfo &&
        selectedSource.accountStatusInfo.heldFunds > 0
        ? "This payment couldn't be completed because your available balance is reduced by held funds."
        : "This payment couldn't be completed because your available balance is insufficient.";
    }
    return null;
  }

  async function goToReview() {
    setComposeError(null);
    if (!selectedSource) {
      setComposeError("Select an account to pay from.");
      return;
    }

    setSubmitting(true);
    try {
      const nextQuote = await quoteFn({ data: invoice.id });
      const fundingError = validateFunding(nextQuote.amount);
      if (fundingError) {
        setComposeError(fundingError);
        return;
      }
      setQuote(nextQuote);
      setView("review");
    } catch (err) {
      setComposeError(formatCustomerActionError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSource || submitting) return;

    setSubmitting(true);
    const idempotencyKey =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;

    try {
      const payment = await payFn({
        data: {
          invoiceId: invoice.id,
          fundingSource: parsePayFundingKey(fundingKey),
          idempotencyKey,
        },
      });

      setSubmission({
        referenceCode: payment.paymentReferenceCode,
        amount: payment.totalDebited,
        submittedAt: new Date().toISOString(),
        accountName: payment.merchantName,
        accountNumber: payment.fundingSourceLabel,
      });
      setView("success");
      await router.invalidate();
    } catch (err) {
      const raw = err instanceof Error ? err.message.replace(/^BAD_REQUEST:/, "") : "";
      showSubmitError(
        raw
          ? formatBankActionError(raw, {
              action: "pay",
              accountId: selectedSource.id,
            }).message
          : formatCustomerActionError(err, "pay", {
              accountId: selectedSource.kind === "bank_account" ? selectedSource.id : undefined,
            }),
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (view === "success" && submission) {
    return (
      <CommercialBrandedReceiptShell
        branding={invoice.branding}
        merchantName={invoice.merchantName}
        footerText={invoice.branding?.invoiceFooterText}
      >
        <BankRequestSuccessCard
          kind="merchant_invoice_payment"
          result={submission}
          onSubmitAnother={() =>
            void router.navigate({ to: "/bank/invoices" })
          }
        />
      </CommercialBrandedReceiptShell>
    );
  }

  if (view === "error") {
    return (
      <BankRequestErrorCard
        reason={errorReason}
        onTryAgain={() => {
          setErrorReason(null);
          setView("review");
        }}
      />
    );
  }

  if (view === "review" && quote && selectedSource) {
    return (
      <CommercialBrandedCheckoutShell
        branding={invoice.branding}
        merchantName={invoice.merchantName}
        footerText={invoice.branding?.invoiceFooterText}
      >
        <form onSubmit={submitPayment} className="space-y-6">
          <Card className="space-y-6 !p-6">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">
              Review payment
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
              Confirm the details below before paying. Funds settle instantly to{" "}
              {invoice.merchantName}.
              {invoice.recipientKind === "company"
                ? " This payment will debit your selected funding source."
                : null}
            </p>
          </div>

          <div className="space-y-4 border-y border-border/60 py-6 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Merchant</span>
              <span className="text-right font-medium">{quote.merchantName}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Invoice</span>
              <span className="font-mono text-[12px]">{quote.referenceCode}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Amount</span>
              <span className="type-finance-nums">{florin(quote.amount)}</span>
            </div>
            {quote.feeAmount > 0 ? (
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Processing fee</span>
                <span className="type-finance-nums">{florin(quote.feeAmount)}</span>
              </div>
            ) : null}
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Total debited</span>
              <span className="type-finance-nums font-medium">{florin(quote.totalDebited)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Pay from</span>
              <span className="text-right font-mono text-[12px]">{payFundingLabel(selectedSource)}</span>
            </div>
          </div>

          <fieldset disabled={submitting} className="flex flex-wrap items-center gap-2 border-0 p-0 m-0 min-w-0">
            <button
              type="button"
              disabled={submitting}
              onClick={() => setView("detail")}
              className="rounded-md border border-border px-4 py-2.5 text-[13px] font-medium transition-colors hover:bg-surface-2/60 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Back
            </button>
            <BankRequestSubmitButton
              kind="merchant_invoice_payment"
              submitting={submitting}
              showContainer={false}
            />
          </fieldset>
        </Card>
        </form>
      </CommercialBrandedCheckoutShell>
    );
  }

  return (
    <CommercialBrandedCheckoutShell
      branding={invoice.branding}
      merchantName={invoice.merchantName}
      footerText={invoice.branding?.invoiceFooterText}
    >
      <Card className="space-y-6 !p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="type-meta text-muted-foreground">{invoice.referenceCode}</p>
          <h2 className="text-xl font-semibold">{invoice.merchantName}</h2>
        </div>
        <MerchantInvoiceStatusBadge status={invoice.status} />
      </div>

      <dl className="grid gap-3 text-sm">
        <div>
          <dt className="text-muted-foreground">Amount due</dt>
          <dd className="text-lg font-semibold tabular-nums">{florin(invoice.amount)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Description</dt>
          <dd>{invoice.description}</dd>
        </div>
        {invoice.dueDate ? (
          <div>
            <dt className="text-muted-foreground">Due date</dt>
            <dd>{new Date(invoice.dueDate).toLocaleDateString()}</dd>
          </div>
        ) : null}
        {invoice.recipientKind === "company" ? (
          <div>
            <dt className="text-muted-foreground">Bill to</dt>
            <dd>{invoice.recipientName}</dd>
          </div>
        ) : null}
      </dl>

      {payable && fundingSources.length > 0 ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void goToReview();
          }}
          className="space-y-4 border-t border-border/60 pt-6"
        >
          <label className="block">
            <span className={fieldLabel}>Pay from</span>
            <Select value={fundingKey} onValueChange={setFundingKey} disabled={submitting}>
              <SelectTrigger className={`${inputClass} h-auto min-h-10`}>
                <SelectValue placeholder="Select funding source" />
              </SelectTrigger>
              <SelectContent>
                {fundingSources.map((source) => (
                  <SelectItem key={`${source.kind}:${source.id}`} value={`${source.kind}:${source.id}`}>
                    {payFundingLabel(source)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedSource ? (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Available {florin(availableBalance)}
              </p>
            ) : null}
          </label>

          {composeError ? <p className="text-sm text-destructive">{composeError}</p> : null}

          <BankRequestSubmitButton
            kind="merchant_invoice_payment"
            submitting={submitting}
            label="Review Payment"
            disabled={!selectedSource}
          />
        </form>
      ) : null}

      {payable && fundingSources.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {invoice.recipientKind === "company"
            ? "You need treasury access to your company's operating account or an Alta Card to pay this invoice."
            : "You need an active Alta Bank account or Alta Card to pay this invoice."}
        </p>
      ) : null}

      {!payable && invoice.status === "PAID" ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-300">
          Paid{invoice.paymentReferenceCode ? ` · ${invoice.paymentReferenceCode}` : ""}.
        </p>
      ) : null}
      </Card>
    </CommercialBrandedCheckoutShell>
  );
}
