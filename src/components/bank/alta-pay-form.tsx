"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Search, ShieldCheck, UserRound } from "lucide-react";
import { Card } from "@/components/page-shell";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { florin } from "@/lib/bank/api";
import { SEARCH_DEBOUNCE_MS } from "@/lib/ui/route-loading";
import {
  searchPayableRecipientsForPay,
  submitAltaPay,
  submitAltaPayToPersonPayment,
} from "@/lib/bank/alta-pay.functions";
import type {
  AltaPayFundingSource,
  PayableRecipient,
  PayFundingSourceOption,
  SubmitAltaPayResult,
} from "@/lib/bank/alta-pay-types";
import { ALTA_PAY_FORM_INTRO } from "@/lib/bank/bank-shared-copy";
import {
  formatBankActionError,
  transferBlockedReason,
  withdrawalBlockedReason,
} from "@/lib/bank/account-status-copy";
import { formatCustomerActionError } from "@/lib/bank/bank-action-errors";
import {
  BankRequestErrorCard,
  BankRequestSubmitButton,
  BankRequestSuccessCard,
  type BankRequestSubmissionResult,
} from "@/components/bank/bank-request-submission-ui";

const ALTA_PAY_SELF_COMPANY_BLOCKED = "Companies cannot send Alta Pay to themselves.";

const PERSON_RECEIVE_ACCOUNT_MISSING =
  "This customer does not have an active personal Alta Bank account to receive Alta Pay.";

type FormView = "compose" | "review" | "success" | "error";

function selfPayBlockedCompanyIdForFunding(
  source: PayFundingSourceOption | undefined,
): string | undefined {
  if (!source) return undefined;
  if (source.kind === "bank_account") return source.companyId ?? undefined;
  return source.employerCompanyId;
}

export { selfPayBlockedCompanyIdForFunding };

const fieldLabel = "type-meta";
const inputClass =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold/40 disabled:cursor-not-allowed disabled:opacity-60";

function fundingKey(source: PayFundingSourceOption): string {
  return `${source.kind}:${source.id}`;
}

export function resolvePayFundingKey(
  fundingSources: PayFundingSourceOption[],
  preferredKey?: string,
): string {
  if (preferredKey && fundingSources.some((source) => fundingKey(source) === preferredKey)) {
    return preferredKey;
  }
  return fundingKey(fundingSources[0]!);
}

export function employeeCardPayFundingKey(employeeCardId: string): string {
  return fundingKey({ kind: "alta_card", id: `employee:${employeeCardId}` });
}

export function altaCardPayFundingKey(cardId: string): string {
  return fundingKey({ kind: "alta_card", id: cardId });
}

export function bankAccountPayFundingKey(accountId: string): string {
  return fundingKey({ kind: "bank_account", id: accountId });
}

function parseFundingKey(key: string): AltaPayFundingSource {
  const [kind, ...rest] = key.split(":");
  const id = rest.join(":");
  if (kind === "alta_card") return { kind: "alta_card", cardId: id };
  return { kind: "bank_account", accountId: id };
}

export function parsePayFundingKey(key: string): AltaPayFundingSource {
  return parseFundingKey(key);
}

export function payFundingLabel(source: PayFundingSourceOption): string {
  if (source.kind === "alta_card") {
    if (
      source.label.includes("Employee") ||
      source.label.includes(" · Alta Card")
    ) {
      return source.label;
    }
    return source.cardLastFour
      ? `Alta Card •••• ${source.cardLastFour}`
      : source.label;
  }
  return `${source.label} · ${source.detail} · ${florin(source.availableBalance)}`;
}

function bankAccountFundingSources(sources: PayFundingSourceOption[]): PayFundingSourceOption[] {
  return sources.filter((source) => source.kind === "bank_account");
}

function recipientIcon(recipient: PayableRecipient) {
  return recipient.kind === "company" ? ShieldCheck : UserRound;
}

export function AltaPayForm({
  fundingSources,
  defaultFundingKey,
  onSuccess,
  onSubmissionSuccess,
}: {
  fundingSources: PayFundingSourceOption[];
  defaultFundingKey?: string;
  onSuccess?: () => void;
  onSubmissionSuccess?: (result: BankRequestSubmissionResult) => void;
}) {
  const router = useRouter();
  const searchRecipients = useServerFn(searchPayableRecipientsForPay);
  const payCompany = useServerFn(submitAltaPay);
  const payPerson = useServerFn(submitAltaPayToPersonPayment);

  const [view, setView] = useState<FormView>("compose");
  const [fundingKeyValue, setFundingKeyValue] = useState(() =>
    resolvePayFundingKey(fundingSources, defaultFundingKey),
  );
  const [recipientQuery, setRecipientQuery] = useState("");
  const [recipientResults, setRecipientResults] = useState<PayableRecipient[]>([]);
  const [selectedRecipient, setSelectedRecipient] = useState<PayableRecipient | null>(null);
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [composeError, setComposeError] = useState<string | null>(null);
  const [errorReason, setErrorReason] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submission, setSubmission] = useState<BankRequestSubmissionResult | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);

  const activeFundingSources =
    selectedRecipient?.kind === "person"
      ? bankAccountFundingSources(fundingSources)
      : fundingSources;

  const selectedFunding =
    activeFundingSources.find((s) => fundingKey(s) === fundingKeyValue) ??
    activeFundingSources[0];
  const availableBalance = selectedFunding?.availableBalance ?? 0;
  const blockedSelfPayCompanyId = selfPayBlockedCompanyIdForFunding(selectedFunding);
  const payableResults =
    selectedRecipient?.kind === "company" && blockedSelfPayCompanyId
      ? recipientResults.filter(
          (recipient) =>
            recipient.kind !== "company" || recipient.id !== blockedSelfPayCompanyId,
        )
      : recipientResults;

  useEffect(() => {
    if (
      blockedSelfPayCompanyId &&
      selectedRecipient?.kind === "company" &&
      selectedRecipient.id === blockedSelfPayCompanyId
    ) {
      setSelectedRecipient(null);
      setRecipientQuery("");
    }
  }, [blockedSelfPayCompanyId, selectedRecipient]);

  useEffect(() => {
    if (selectedRecipient?.kind === "person") {
      const bankSources = bankAccountFundingSources(fundingSources);
      if (bankSources.length > 0 && selectedFunding?.kind === "alta_card") {
        setFundingKeyValue(fundingKey(bankSources[0]!));
      }
    }
  }, [selectedRecipient, fundingSources, selectedFunding?.kind]);

  useEffect(() => {
    if (recipientQuery.trim().length < 1) {
      setRecipientResults([]);
      return;
    }
    const handle = setTimeout(() => {
      void searchRecipients({ data: recipientQuery.trim() })
        .then(setRecipientResults)
        .catch(() => setRecipientResults([]));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [recipientQuery, searchRecipients]);

  function resetForm() {
    setView("compose");
    setComposeError(null);
    setErrorReason(null);
    setSubmission(null);
    setAmount("");
    setMemo("");
    setSelectedRecipient(null);
    setRecipientQuery("");
    setFundingKeyValue(resolvePayFundingKey(fundingSources, defaultFundingKey));
  }

  function showSubmitError(message: string) {
    setErrorReason(message);
    setView("error");
  }

  function validateFunding(payAmount: number): string | null {
    if (!selectedFunding) return "Select a funding source.";
    if (!payAmount || payAmount <= 0) return "Enter a valid payment amount.";
    if (payAmount > availableBalance) {
      return selectedFunding.kind === "bank_account" &&
        selectedFunding.accountStatusInfo &&
        selectedFunding.accountStatusInfo.heldFunds > 0
        ? "This payment couldn't be completed because your available balance is reduced by held funds."
        : "This payment couldn't be completed because your available balance is insufficient.";
    }
    if (selectedFunding.kind === "bank_account" && selectedFunding.accountStatusInfo) {
      const blocked =
        selectedRecipient?.kind === "person"
          ? transferBlockedReason(selectedFunding.accountStatusInfo, "source")
          : withdrawalBlockedReason(selectedFunding.accountStatusInfo);
      if (blocked) return blocked;
    }
    return null;
  }

  function goToReview() {
    setComposeError(null);
    const payAmount = Number(amount);

    if (!selectedRecipient) {
      setComposeError("Select a person or company to pay.");
      return;
    }
    if (selectedRecipient.kind === "person" && !selectedRecipient.canReceive) {
      setComposeError(PERSON_RECEIVE_ACCOUNT_MISSING);
      return;
    }
    if (
      selectedRecipient.kind === "company" &&
      blockedSelfPayCompanyId &&
      selectedRecipient.id === blockedSelfPayCompanyId
    ) {
      setComposeError(ALTA_PAY_SELF_COMPANY_BLOCKED);
      return;
    }
    if (selectedRecipient.kind === "person" && activeFundingSources.length === 0) {
      setComposeError("Open an Alta Bank account to send money to another Alta customer.");
      return;
    }

    const fundingError = validateFunding(payAmount);
    if (fundingError) {
      setComposeError(fundingError);
      return;
    }

    setView("review");
  }

  async function submitPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRecipient || !selectedFunding || submitting) return;

    setSubmitting(true);

    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = crypto.randomUUID();
    }
    const idempotencyKey = idempotencyKeyRef.current;

    try {
      let result: SubmitAltaPayResult;

      if (selectedRecipient.kind === "company") {
        result = await payCompany({
          data: {
            fundingSource: parseFundingKey(fundingKeyValue),
            companyId: selectedRecipient.id,
            amount: Number(amount),
            memo: memo.trim() || undefined,
            idempotencyKey,
          },
        });
      } else {
        const funding = parseFundingKey(fundingKeyValue);
        if (funding.kind !== "bank_account") return;

        result = await payPerson({
          data: {
            fundingSource: funding,
            recipientUserId: selectedRecipient.id,
            amount: Number(amount),
            memo: memo.trim() || undefined,
            idempotencyKey,
          },
        });
      }

      idempotencyKeyRef.current = null;

      const submitted: BankRequestSubmissionResult = {
        referenceCode: result.referenceCode,
        amount: result.amount,
        submittedAt: new Date().toISOString(),
        accountName: result.fundingSourceLabel,
        accountNumber: result.companyName,
      };

      setSubmission(submitted);
      setView("success");
      onSubmissionSuccess?.(submitted);
      onSuccess?.();
      await router.invalidate();
    } catch (err) {
      const raw =
        err instanceof Error ? err.message.replace(/^BAD_REQUEST:/, "") : "";
      const accountId =
        selectedFunding?.kind === "bank_account" ? selectedFunding.id : undefined;
      showSubmitError(
        raw
          ? formatBankActionError(raw, { action: "pay", accountId }).message
          : formatCustomerActionError(err, "pay", { accountId }),
      );
    } finally {
      setSubmitting(false);
    }
  }

  const canReview = !!selectedRecipient && !!amount && Number(amount) > 0;

  if (view === "success" && submission) {
    return (
      <BankRequestSuccessCard
        kind="alta_pay"
        result={submission}
        onSubmitAnother={resetForm}
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

  if (view === "review" && selectedRecipient && selectedFunding) {
    return (
      <form onSubmit={submitPayment} className="mx-auto max-w-2xl space-y-6">
        <Card className="space-y-6 !p-6">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">
              Review payment
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
              Confirm the details below before sending. Funds settle instantly to{" "}
              {selectedRecipient.destinationLabel}.
              {selectedFunding.kind === "alta_card"
                ? " Your Alta Card balance will increase and available credit will decrease."
                : null}
            </p>
          </div>

          <div className="space-y-4 border-y border-border/60 py-6 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">To</span>
              <span className="text-right">
                <span className="font-medium">{selectedRecipient.name}</span>
                <span className="mt-0.5 block text-[12px] text-muted-foreground">
                  {selectedRecipient.destinationLabel}
                </span>
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Amount</span>
              <span className="type-finance-nums">{florin(Number(amount))}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">From</span>
              <span className="text-right font-mono text-[12px]">{payFundingLabel(selectedFunding)}</span>
            </div>
            {memo.trim() && (
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Memo</span>
                <span className="max-w-[220px] text-right text-[13px]">{memo.trim()}</span>
              </div>
            )}
          </div>

          <fieldset disabled={submitting} className="flex flex-wrap items-center gap-2 border-0 p-0 m-0 min-w-0">
            <button
              type="button"
              disabled={submitting}
              onClick={() => setView("compose")}
              className="rounded-md border border-border px-4 py-2.5 text-[13px] font-medium transition-colors hover:bg-surface-2/60 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Back
            </button>
            <BankRequestSubmitButton
              kind="alta_pay"
              submitting={submitting}
              showContainer={false}
            />
          </fieldset>
        </Card>
      </form>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        goToReview();
      }}
      className="mx-auto max-w-2xl space-y-6"
    >
      <Card className="space-y-6 !p-6">
        <p className="text-[13px] leading-relaxed text-muted-foreground">{ALTA_PAY_FORM_INTRO}</p>

        <fieldset disabled={submitting} className="space-y-6 border-0 p-0 m-0 min-w-0">
          <div>
            <span className={fieldLabel}>Recipient</span>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                className={`${inputClass} pl-9`}
                value={recipientQuery}
                onChange={(e) => {
                  setRecipientQuery(e.target.value);
                  setSelectedRecipient(null);
                  setComposeError(null);
                }}
                placeholder="Person or company name"
              />
            </div>
            {payableResults.length > 0 && !selectedRecipient && (
              <ul className="mt-2 overflow-hidden rounded-md border border-border">
                {payableResults.map((recipient) => {
                  const Icon = recipientIcon(recipient);
                  return (
                    <li key={`${recipient.kind}-${recipient.id}`}>
                      <button
                        type="button"
                        onClick={() => {
                          if (recipient.kind === "person" && !recipient.canReceive) {
                            setComposeError(PERSON_RECEIVE_ACCOUNT_MISSING);
                            return;
                          }
                          setSelectedRecipient(recipient);
                          setRecipientQuery(recipient.name);
                          setRecipientResults([]);
                          setComposeError(null);
                        }}
                        className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2/60"
                      >
                        <Icon className="mt-0.5 size-4 shrink-0 text-gold" />
                        <span>
                          <span className="font-medium">{recipient.name}</span>
                          <span className="mt-0.5 block text-[12px] text-muted-foreground">
                            {recipient.kind === "company"
                              ? recipient.subtitle || "Verified company"
                              : recipient.subtitle}
                          </span>
                          <span className="mt-0.5 block text-[11px] text-muted-foreground">
                            {recipient.destinationLabel}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {recipientQuery.trim().length >= 1 &&
              recipientResults.length > 0 &&
              payableResults.length === 0 &&
              !selectedRecipient && (
                <p className="mt-2 text-[12px] text-muted-foreground">
                  {ALTA_PAY_SELF_COMPANY_BLOCKED}
                </p>
              )}
            {selectedRecipient && (
              <div className="mt-3 rounded-lg border border-gold/25 bg-gold/5 px-4 py-3">
                <div className="flex items-center gap-2">
                  {(() => {
                    const Icon = recipientIcon(selectedRecipient);
                    return <Icon className="size-4 text-gold" />;
                  })()}
                  <span className="font-medium">{selectedRecipient.name}</span>
                </div>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  {selectedRecipient.destinationLabel}
                </p>
              </div>
            )}
          </div>

          <label className="block">
            <span className={fieldLabel}>Amount (FLR)</span>
            <input
              className={`${inputClass} tabular`}
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            {selectedFunding && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Available {florin(availableBalance)}
              </p>
            )}
          </label>

          <label className="block">
            <span className={fieldLabel}>From account</span>
            <Select value={fundingKeyValue} onValueChange={setFundingKeyValue} disabled={submitting}>
              <SelectTrigger className={`${inputClass} h-auto min-h-10`}>
                <SelectValue placeholder="Select funding source" />
              </SelectTrigger>
              <SelectContent>
                {activeFundingSources.map((source) => (
                  <SelectItem key={fundingKey(source)} value={fundingKey(source)}>
                    {payFundingLabel(source)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedRecipient?.kind === "person" && activeFundingSources.length === 0 && (
              <p className="mt-2 text-[12px] text-muted-foreground">
                Open an Alta Bank account to send money to another Alta customer.
              </p>
            )}
          </label>

          <label className="block">
            <span className={fieldLabel}>Memo (optional)</span>
            <Textarea
              autoResize
              className={`${inputClass} min-h-[80px]`}
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="Invoice #, order reference, or payment note"
            />
          </label>
        </fieldset>

        {composeError && <p className="text-sm text-destructive">{composeError}</p>}

        <BankRequestSubmitButton
          kind="alta_pay"
          submitting={false}
          label="Review Payment"
          disabled={!canReview}
        />
      </Card>
    </form>
  );
}
