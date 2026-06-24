"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, Search, ShieldCheck } from "lucide-react";
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
import type { PayableCompany, SubmitAltaPayResult } from "@/lib/bank/alta-pay-types";
import type { UserBankAccount } from "@/lib/bank/backend-types";

const fieldLabel = "font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground";
const inputClass =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold/40";

type Step = "compose" | "review" | "confirmed";

function accountLabel(account: UserBankAccount) {
  const scope = account.isCompanyAccount && account.companyName
    ? `${account.companyName} · `
    : "";
  return `${scope}${account.accountName} · ${account.accountNumber} · ${florin(account.balance)}`;
}

export function AltaPayForm({
  accounts,
  onSuccess,
}: {
  accounts: UserBankAccount[];
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const searchCompanies = useServerFn(searchPayableCompaniesForPay);
  const pay = useServerFn(submitAltaPay);

  const [step, setStep] = useState<Step>("compose");
  const [fromAccountId, setFromAccountId] = useState(accounts[0]?.id ?? "");
  const [companyQuery, setCompanyQuery] = useState("");
  const [companyResults, setCompanyResults] = useState<PayableCompany[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<PayableCompany | null>(null);
  const [searching, setSearching] = useState(false);
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmation, setConfirmation] = useState<SubmitAltaPayResult | null>(null);

  const fromAccount = accounts.find((a) => a.id === fromAccountId);
  const availableBalance = fromAccount?.balance ?? 0;

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
    if (!payAmount || payAmount <= 0) {
      setError("Enter a valid payment amount.");
      return;
    }
    if (payAmount > availableBalance) {
      setError("Insufficient balance for this payment.");
      return;
    }
    setStep("review");
  }

  async function submitPayment() {
    if (!selectedCompany) return;
    setError(null);
    setPending(true);
    try {
      const result = await pay({
        data: {
          fromAccountId,
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
      setError(err instanceof Error ? err.message.replace(/^BAD_REQUEST:/, "") : "Payment failed.");
    } finally {
      setPending(false);
    }
  }

  if (step === "confirmed" && confirmation) {
    return (
      <Card className="mx-auto max-w-lg !p-8 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full border border-gold/30 bg-gold/10">
          <Check className="size-6 text-gold" />
        </div>
        <div className="mt-6 font-mono text-[10px] uppercase tracking-[0.22em] text-gold">Payment sent</div>
        <h2 className="mt-3 text-xl font-semibold">{florin(confirmation.amount)}</h2>
        <p className="mt-2 text-[14px] text-muted-foreground">Paid to {confirmation.companyName}</p>
        <p className="mt-4 font-mono text-[11px] text-muted-foreground">
          Reference {confirmation.referenceCode}
        </p>
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
          className="mt-8 rounded-md border border-border-strong bg-surface-2 px-4 py-2 text-sm font-medium hover:bg-surface-2/80"
        >
          Send another payment
        </button>
      </Card>
    );
  }

  if (step === "review" && selectedCompany && fromAccount) {
    return (
      <Card className="mx-auto max-w-lg !p-6">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">Review payment</div>
        <div className="mt-6 space-y-4 border-y border-border/60 py-6 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">From</span>
            <span className="text-right font-mono text-[12px]">
              {fromAccount.isCompanyAccount && fromAccount.companyName
                ? `${fromAccount.companyName} · ${fromAccount.accountName}`
                : fromAccount.accountName}
            </span>
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
            <span className="font-mono tabular-nums">{florin(Number(amount))}</span>
          </div>
          {memo.trim() && (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Memo</span>
              <span className="max-w-[220px] text-right text-[13px]">{memo.trim()}</span>
            </div>
          )}
        </div>
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          Funds settle instantly to the company&apos;s Business Operating Account via Alta Bank intrabank
          transfer.
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
        Pay verified Newport businesses instantly — from a personal account or a Business Operating
        Account you manage.
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
          <Select value={fromAccountId} onValueChange={setFromAccountId}>
            <SelectTrigger className="mt-2">
              <SelectValue placeholder="Select account" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {accountLabel(account)}
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
                      <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                        {company.destinationLabel}
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
                <span className="rounded-full border border-gold/30 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-gold">
                  Verified
                </span>
              </div>
              <p className="mt-2 text-[12px] text-muted-foreground">
                {selectedCompany.sector ?? "Newport company"}
                {selectedCompany.ticker ? ` · ${selectedCompany.ticker}` : ""}
              </p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Destination: {selectedCompany.destinationLabel}
              </p>
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
            className="mt-2 min-h-[4rem] resize-none"
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
