"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Search, ShieldCheck } from "lucide-react";
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
import {
  searchPayableCompaniesForPay,
  submitAltaPay,
} from "@/lib/bank/alta-pay.functions";
import type {
  AltaPayFundingSource,
  PayableCompany,
  PayFundingSourceOption,
  SubmitAltaPayResult,
} from "@/lib/bank/alta-pay-types";
import { ALTA_PAY_FORM_INTRO } from "@/lib/bank/bank-shared-copy";
import {
  formatBankActionError,
  withdrawalBlockedReason,
} from "@/lib/bank/account-status-copy";
import { formatCustomerActionError } from "@/lib/bank/bank-action-errors";
import {
  BankRequestErrorCard,
  BankRequestSubmitButton,
  BankRequestSuccessCard,
  type BankRequestSubmissionResult,
} from "@/components/bank/bank-request-submission-ui";

const fieldLabel = "type-meta";
const inputClass =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold/40 disabled:cursor-not-allowed disabled:opacity-60";

type FormView = "compose" | "review" | "success" | "error";

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

function parseFundingKey(key: string): AltaPayFundingSource {
  const [kind, ...rest] = key.split(":");
  const id = rest.join(":");
  if (kind === "alta_card") return { kind: "alta_card", cardId: id };
  return { kind: "bank_account", accountId: id };
}

function fundingLabel(source: PayFundingSourceOption): string {
  if (source.kind === "alta_card") {
    return source.cardLastFour
      ? `Alta Card •••• ${source.cardLastFour}`
      : source.label;
  }
  return `${source.label} · ${source.detail} · ${florin(source.availableBalance)}`;
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
  const searchCompanies = useServerFn(searchPayableCompaniesForPay);
  const pay = useServerFn(submitAltaPay);

  const [view, setView] = useState<FormView>("compose");
  const [fundingKeyValue, setFundingKeyValue] = useState(() =>
    resolvePayFundingKey(fundingSources, defaultFundingKey),
  );
  const [companyQuery, setCompanyQuery] = useState("");
  const [companyResults, setCompanyResults] = useState<PayableCompany[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<PayableCompany | null>(null);
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [composeError, setComposeError] = useState<string | null>(null);
  const [errorReason, setErrorReason] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submission, setSubmission] = useState<BankRequestSubmissionResult | null>(null);

  const selectedFunding =
    fundingSources.find((s) => fundingKey(s) === fundingKeyValue) ?? fundingSources[0];
  const availableBalance = selectedFunding?.availableBalance ?? 0;

  useEffect(() => {
    if (companyQuery.trim().length < 1) {
      setCompanyResults([]);
      return;
    }
    const handle = setTimeout(() => {
      void searchCompanies({ data: companyQuery.trim() })
        .then(setCompanyResults)
        .catch(() => setCompanyResults([]));
    }, 280);
    return () => clearTimeout(handle);
  }, [companyQuery, searchCompanies]);

  function resetForm() {
    setView("compose");
    setComposeError(null);
    setErrorReason(null);
    setSubmission(null);
    setAmount("");
    setMemo("");
    setSelectedCompany(null);
    setCompanyQuery("");
    setFundingKeyValue(resolvePayFundingKey(fundingSources, defaultFundingKey));
  }

  function showSubmitError(message: string) {
    setErrorReason(message);
    setView("error");
  }

  function goToReview() {
    setComposeError(null);
    const payAmount = Number(amount);
    if (!selectedCompany) {
      setComposeError("Select a verified company to pay.");
      return;
    }
    if (!selectedFunding) {
      setComposeError("Select a funding source.");
      return;
    }
    if (!payAmount || payAmount <= 0) {
      setComposeError("Enter a valid payment amount.");
      return;
    }
    if (payAmount > availableBalance) {
      setComposeError(
        selectedFunding.kind === "bank_account" &&
          selectedFunding.accountStatusInfo &&
          selectedFunding.accountStatusInfo.heldFunds > 0
          ? "This payment couldn't be completed because your available balance is reduced by held funds."
          : "This payment couldn't be completed because your available balance is insufficient.",
      );
      return;
    }
    if (
      selectedFunding.kind === "bank_account" &&
      selectedFunding.accountStatusInfo
    ) {
      const blocked = withdrawalBlockedReason(selectedFunding.accountStatusInfo);
      if (blocked) {
        setComposeError(blocked);
        return;
      }
    }
    setView("review");
  }

  async function submitPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCompany || !selectedFunding || submitting) return;

    setSubmitting(true);

    try {
      const result: SubmitAltaPayResult = await pay({
        data: {
          fundingSource: parseFundingKey(fundingKeyValue),
          companyId: selectedCompany.id,
          amount: Number(amount),
          memo: memo.trim() || undefined,
        },
      });

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

  if (view === "review" && selectedCompany && selectedFunding) {
    return (
      <form onSubmit={submitPayment} className="mx-auto max-w-2xl space-y-6">
        <Card className="space-y-6 !p-6">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">
              Review payment
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
              Confirm the details below before sending. Funds settle instantly to the company&apos;s
              Business Operating Account.
              {selectedFunding.kind === "alta_card"
                ? " Your Alta Card balance will increase and available credit will decrease."
                : null}
            </p>
          </div>

          <div className="space-y-4 border-y border-border/60 py-6 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">From</span>
              <span className="text-right font-mono text-[12px]">{fundingLabel(selectedFunding)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">To</span>
              <span className="text-right">
                <span className="font-medium">{selectedCompany.name}</span>
                <span className="mt-0.5 block text-[12px] text-muted-foreground">
                  {selectedCompany.destinationLabel}
                </span>
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Amount</span>
              <span className="type-finance-nums">{florin(Number(amount))}</span>
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
          <label className="block">
            <span className={fieldLabel}>Pay from</span>
            <Select value={fundingKeyValue} onValueChange={setFundingKeyValue} disabled={submitting}>
              <SelectTrigger className={`${inputClass} h-auto min-h-10`}>
                <SelectValue placeholder="Select funding source" />
              </SelectTrigger>
              <SelectContent>
                {fundingSources.map((source) => (
                  <SelectItem key={fundingKey(source)} value={fundingKey(source)}>
                    {fundingLabel(source)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <div>
            <span className={fieldLabel}>Pay to — search verified company</span>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                className={`${inputClass} pl-9`}
                value={companyQuery}
                onChange={(e) => {
                  setCompanyQuery(e.target.value);
                  setSelectedCompany(null);
                  setComposeError(null);
                }}
                placeholder="Company name, sector, or ticker"
              />
            </div>
            {companyResults.length > 0 && !selectedCompany && (
              <ul className="mt-2 overflow-hidden rounded-md border border-border">
                {companyResults.map((company) => (
                  <li key={company.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCompany(company);
                        setCompanyQuery(company.name);
                        setCompanyResults([]);
                        setComposeError(null);
                      }}
                      className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2/60"
                    >
                      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-gold" />
                      <span>
                        <span className="font-medium">{company.name}</span>
                        <span className="mt-0.5 block text-[12px] text-muted-foreground">
                          {[company.sector, company.ticker].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {selectedCompany && (
              <div className="mt-3 rounded-lg border border-gold/25 bg-gold/5 px-4 py-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-gold" />
                  <span className="font-medium">{selectedCompany.name}</span>
                </div>
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
            <p className="mt-1 text-[11px] text-muted-foreground">
              Available {florin(availableBalance)}
            </p>
          </label>

          <label className="block">
            <span className={fieldLabel}>Memo (optional)</span>
            <Textarea
              autoResize
              className={`${inputClass} min-h-[80px]`}
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="Invoice #, order reference, or note to the business"
            />
          </label>
        </fieldset>

        {composeError && <p className="text-sm text-destructive">{composeError}</p>}

        <BankRequestSubmitButton
          kind="alta_pay"
          submitting={false}
          label="Review Payment"
        />
      </Card>
    </form>
  );
}
