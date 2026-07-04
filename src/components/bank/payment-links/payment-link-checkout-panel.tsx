"use client";

import { useMemo, useState } from "react";
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
  PaymentLinkCheckoutContext,
  PaymentLinkPaymentQuote,
} from "@/lib/bank/payment-link-types";
import type { PayFundingSourceOption } from "@/lib/bank/alta-pay-types";
import {
  payPaymentLinkCheckout,
  quotePaymentLinkCheckout,
} from "@/lib/bank/payment-link.functions";
import {
  bankAccountPayFundingKey,
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
import { PaymentLinkStatusBadge } from "@/components/bank/payment-links/payment-link-status-badge";

type FormView = "detail" | "review" | "success" | "error";

const fieldLabel = "type-meta";
const inputClass =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold/40";

function fundingLabel(source: PayFundingSourceOption): string {
  return `${source.label} · ${florin(source.availableBalance)} available`;
}

export function PaymentLinkCheckoutPanel({
  checkout,
  fundingSources,
}: {
  checkout: PaymentLinkCheckoutContext;
  fundingSources: PayFundingSourceOption[];
}) {
  const router = useRouter();
  const quoteFn = useServerFn(quotePaymentLinkCheckout);
  const payFn = useServerFn(payPaymentLinkCheckout);

  const bankSources = useMemo(
    () => fundingSources.filter((source) => source.kind === "bank_account"),
    [fundingSources],
  );

  const [view, setView] = useState<FormView>("detail");
  const [openAmount, setOpenAmount] = useState("");
  const [fundingKey, setFundingKey] = useState(() =>
    resolvePayFundingKey(
      bankSources,
      bankSources[0] ? bankAccountPayFundingKey(bankSources[0].id) : undefined,
    ),
  );
  const [quote, setQuote] = useState<PaymentLinkPaymentQuote | null>(null);
  const [composeError, setComposeError] = useState<string | null>(null);
  const [errorReason, setErrorReason] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submission, setSubmission] = useState<BankRequestSubmissionResult | null>(null);

  const selectedSource = bankSources.find(
    (source) => bankAccountPayFundingKey(source.id) === fundingKey,
  );
  const availableBalance = selectedSource?.availableBalance ?? 0;
  const parsedOpenAmount = Number(openAmount);

  function showSubmitError(message: string) {
    setErrorReason(message);
    setView("error");
  }

  function validateFunding(amountDue: number): string | null {
    if (!selectedSource) return "Select a funding source.";
    if (amountDue <= 0) return "Enter a valid payment amount.";
    if (amountDue > availableBalance) {
      return selectedSource.accountStatusInfo && selectedSource.accountStatusInfo.heldFunds > 0
        ? "This payment couldn't be completed because your available balance is reduced by held funds."
        : "This payment couldn't be completed because your available balance is insufficient.";
    }
    return null;
  }

  async function goToReview() {
    setComposeError(null);
    if (!checkout.payable) {
      setComposeError(checkout.statusMessage ?? "This payment link is not available.");
      return;
    }
    if (!selectedSource) {
      setComposeError("Select an account to pay from.");
      return;
    }
    if (checkout.amountType === "OPEN") {
      if (!Number.isFinite(parsedOpenAmount) || parsedOpenAmount <= 0) {
        setComposeError("Enter a valid payment amount.");
        return;
      }
    }

    setSubmitting(true);
    try {
      const nextQuote = await quoteFn({
        data: {
          slug: checkout.slug,
          amount: checkout.amountType === "OPEN" ? parsedOpenAmount : undefined,
        },
      });
      const fundingError = validateFunding(nextQuote.totalDebited);
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
          slug: checkout.slug,
          amount: checkout.amountType === "OPEN" ? parsedOpenAmount : undefined,
          fundingSource: { kind: "bank_account", accountId: selectedSource.id },
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
          : formatCustomerActionError(err, "pay", { accountId: selectedSource.id }),
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (view === "success" && submission) {
    return (
      <BankRequestSuccessCard
        kind="payment_link_checkout"
        result={submission}
        onSubmitAnother={() => void router.navigate({ to: "/bank" })}
      />
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
      <form onSubmit={submitPayment} className="mx-auto max-w-lg space-y-6">
        <Card className="space-y-6 !p-6">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">
              Confirm payment
            </div>
            <p className="mt-2 text-[13px] text-muted-foreground">
              Review the details below before confirming. Funds settle instantly to{" "}
              {quote.merchantName}.
            </p>
          </div>
          <div className="space-y-3 border-y border-border/60 py-6 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Merchant</span>
              <span className="font-medium">{quote.merchantName}</span>
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
            <div className="flex justify-between gap-4 font-medium">
              <span>Total</span>
              <span className="type-finance-nums">{florin(quote.totalDebited)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">From</span>
              <span>{selectedSource.label}</span>
            </div>
          </div>
          <fieldset disabled={submitting} className="flex flex-wrap gap-2 border-0 p-0 m-0">
            <button
              type="button"
              disabled={submitting}
              onClick={() => setView("detail")}
              className="rounded-md border border-border px-4 py-2.5 text-[13px] font-medium"
            >
              Back
            </button>
            <BankRequestSubmitButton
              kind="payment_link_checkout"
              submitting={submitting}
              showContainer={false}
            />
          </fieldset>
        </Card>
      </form>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Card className="space-y-5 !p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="type-meta text-muted-foreground">Pay with Alta Bank</p>
            <h1 className="text-xl font-semibold">{checkout.merchantName}</h1>
            {checkout.title ? (
              <p className="mt-1 text-sm font-medium">{checkout.title}</p>
            ) : null}
          </div>
          <PaymentLinkStatusBadge status={checkout.status} />
        </div>

        <p className="text-[13px] leading-relaxed text-muted-foreground">{checkout.description}</p>

        {checkout.amountType === "FIXED" && checkout.amount != null ? (
          <div className="rounded-md border border-border bg-surface-2/30 px-4 py-3">
            <p className="type-meta text-muted-foreground">Amount due</p>
            <p className="mt-1 text-2xl font-semibold type-finance-nums">
              {florin(checkout.amount)}
            </p>
          </div>
        ) : (
          <label className="block">
            <span className={fieldLabel}>Amount (FLR)</span>
            <input
              className={`${inputClass} tabular`}
              type="number"
              min="0.01"
              step="0.01"
              value={openAmount}
              onChange={(e) => setOpenAmount(e.target.value)}
              disabled={!checkout.payable}
            />
            {checkout.minAmount != null || checkout.maxAmount != null ? (
              <p className="mt-1 text-[12px] text-muted-foreground">
                {checkout.minAmount != null ? `Min ${florin(checkout.minAmount)}` : null}
                {checkout.minAmount != null && checkout.maxAmount != null ? " · " : null}
                {checkout.maxAmount != null ? `Max ${florin(checkout.maxAmount)}` : null}
              </p>
            ) : null}
          </label>
        )}

        {checkout.expiresAt ? (
          <p className="text-[12px] text-muted-foreground">
            Expires {new Date(checkout.expiresAt).toLocaleString()}
          </p>
        ) : null}

        {!checkout.payable ? (
          <p className="text-sm text-destructive">
            {checkout.statusMessage ?? "This payment link is not available."}
          </p>
        ) : bankSources.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Open an Alta Bank account to pay with Alta Bank.
          </p>
        ) : (
          <>
            <label className="block">
              <span className={fieldLabel}>Pay from</span>
              <Select value={fundingKey} onValueChange={setFundingKey}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {bankSources.map((source) => (
                    <SelectItem
                      key={source.id}
                      value={bankAccountPayFundingKey(source.id)}
                    >
                      {fundingLabel(source)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            {composeError ? <p className="text-sm text-destructive">{composeError}</p> : null}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void goToReview();
              }}
            >
              <BankRequestSubmitButton
                kind="payment_link_checkout"
                label="Review payment"
                submitting={submitting}
                submittingLabel="Loading quote…"
                showContainer={false}
              />
            </form>
          </>
        )}
      </Card>
    </div>
  );
}
