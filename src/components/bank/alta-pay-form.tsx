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
import { ReceiptBlock } from "@/components/shared/receipt-block";
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
import {
  formatBankActionError,
  withdrawalBlockedReason,
} from "@/lib/bank/account-status-copy";
import { formatCustomerActionError } from "@/lib/bank/bank-action-errors";

const fieldLabel = "type-meta";
const inputClass =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold/40";

type Step = "compose" | "review" | "confirmed";

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
}: {
  fundingSources: PayFundingSourceOption[];
  defaultFundingKey?: string;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const searchCompanies = useServerFn(searchPayableCompaniesForPay);
  const pay = useServerFn(submitAltaPay);

  const [step, setStep] = useState<Step>("compose");
  const [fundingKeyValue, setFundingKeyValue] = useState(() =>
    resolvePayFundingKey(fundingSources, defaultFundingKey),
  );
  const [companyQuery, setCompanyQuery] = useState("");
  const [companyResults, setCompanyResults] = useState<PayableCompany[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<PayableCompany | null>(null);
  const [searching, setSearching] = useState(false);
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmation, setConfirmation] = useState<SubmitAltaPayResult | null>(null);

  const selectedFunding =
    fundingSources.find((s) => fundingKey(s) === fundingKeyValue) ?? fundingSources[0];
  const availableBalance = selectedFunding?.availableBalance ?? 0;

  useEffect(() => {
    if (companyQuery.trim().length < 1) {
      setCompanyResults([]);
      return;
    }
    const handle = setTimeout(() => {
      setSearching(true);
      void searchCompanies({ data: companyQuery.trim() })
        .then(setCompanyResults)
        .catch(() => setCompanyResults([]))
        .finally(() => setSearching(false));
    }, 280);
    return () => clearTimeout(handle);
  }, [companyQuery, searchCompanies]);

  function goToReview() {
    setError(null);
    const payAmount = Number(amount);
    if (!selectedCompany) {
      setError("Select a verified company to pay.");
      return;
    }
    if (!selectedFunding) {
      setError("Select a funding source.");
      return;
    }
    if (!payAmount || payAmount <= 0) {
      setError("Enter a valid payment amount.");
      return;
    }
    if (payAmount > availableBalance) {
      setError(
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
        setError(blocked);
        return;
      }
    }
    setStep("review");
  }

  async function submitPayment() {
    if (!selectedCompany || !selectedFunding) return;
    setError(null);
    setPending(true);
    try {
      const result = await pay({
        data: {
          fundingSource: parseFundingKey(fundingKeyValue),
          companyId: selectedCompany.id,
          amount: Number(amount),
          memo: memo.trim() || undefined,
        },
      });
      setConfirmation(result);
      setStep("confirmed");
      onSuccess?.();
      await router.invalidate();
    } catch (err) {
      const raw =
        err instanceof Error ? err.message.replace(/^BAD_REQUEST:/, "") : "";
      const accountId =
        selectedFunding?.kind === "bank_account" ? selectedFunding.id : undefined;
      setError(
        raw
          ? formatBankActionError(raw, { action: "pay", accountId }).message
          : formatCustomerActionError(err, "pay", { accountId }),
      );
    } finally {
      setPending(false);
    }
  }

  if (step === "confirmed" && confirmation) {
    return (
      <ReceiptBlock
        kind="Alta Pay"
        reference={confirmation.referenceCode}
        timestamp={new Date().toISOString()}
        amount={confirmation.amount}
        account={confirmation.fundingSourceLabel}
        counterparty={confirmation.companyName}
        memo={memo.trim() || undefined}
        rows={[
          { label: "Settlement", value: "Instant intrabank" },
          { label: "Funding", value: confirmation.fundingSourceLabel },
        ]}
        actions={
          <button
            type="button"
            onClick={() => {
              setStep("compose");
              setConfirmation(null);
              setAmount("");
              setMemo("");
              setSelectedCompany(null);
              setCompanyQuery("");
            }}
            className="rounded-md border border-border-strong bg-surface-2 px-4 py-2 text-sm font-medium hover:bg-surface-2/80"
          >
            Send another payment
          </button>
        }
      />
    );
  }

  if (step === "review" && selectedCompany && selectedFunding) {
    return (
      <Card className="mx-auto max-w-lg !p-6">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">Review payment</div>
        <div className="mt-6 space-y-4 border-y border-border/60 py-6 text-sm">
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
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          Funds settle instantly to the company&apos;s Business Operating Account.
          {selectedFunding.kind === "alta_card"
            ? " Your Alta Card balance will increase and available credit will decrease."
            : null}
        </p>
        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setStep("compose")}
            className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface-2/60"
          >
            Back
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => void submitPayment()}
            className="rounded-md border border-border-strong bg-surface-2 px-4 py-2 text-sm font-medium hover:bg-surface-2/80 disabled:opacity-50"
          >
            {pending ? "Processing…" : "Confirm payment"}
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-2xl !p-6">
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">Alta Pay</div>
      <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
        Pay verified Newport businesses instantly — from a bank account or your Alta Card.
      </p>

      <form
        className="mt-8 space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          goToReview();
        }}
      >
        <label className="block">
          <span className={fieldLabel}>Pay from</span>
          <Select value={fundingKeyValue} onValueChange={setFundingKeyValue}>
            <SelectTrigger className="mt-2">
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
              }}
              placeholder="Company name, sector, or ticker"
            />
          </div>
          {searching && (
            <p className="mt-2 text-[12px] text-muted-foreground">Searching…</p>
          )}
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
            className={inputClass}
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
            className="mt-2 min-h-[4rem]"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="Invoice #, order reference, or note to the business"
          />
        </label>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <button
          type="submit"
          className="rounded-md border border-border-strong bg-surface-2 px-4 py-2 text-sm font-medium transition-colors hover:bg-surface-2/80"
        >
          Review payment
        </button>
      </form>
    </Card>
  );
}
