import { useState } from "react";
import { RouteButton } from "@/components/bank/route-button";
import { Card } from "@/components/page-shell";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentUser } from "@/hooks/use-current-user";
import { isPrivateClient } from "@/lib/auth/permissions";
import { openBankAccountRecord } from "@/lib/bank/bank.functions";
import {
  defaultBankAccountTypeForOwnership,
  getBankAccountTypeOptionsForOpening,
  isInstantApprovalAccountType,
  isPrivateBankingAccountType,
  type BankAccountTypeCode,
  type OpenBankAccountInput,
  type OpenBankAccountResult,
} from "@/lib/bank/backend-types";

const fieldLabel = "type-meta";
const inputClass =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold/40";

export function BankAccountOpenForm() {
  const user = useCurrentUser();
  const hasPrivateAccess = user ? isPrivateClient(user) : false;

  const [ownership, setOwnership] = useState<"personal" | "company">("personal");
  const [accountType, setAccountType] = useState<BankAccountTypeCode>("alta_access");
  const [accountName, setAccountName] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [openingNotes, setOpeningNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdAccount, setCreatedAccount] = useState<OpenBankAccountResult | null>(null);

  const accountTypeOptions = getBankAccountTypeOptionsForOpening(ownership, hasPrivateAccess);
  const selectedAccountType =
    accountTypeOptions.find((option) => option.value === accountType) ?? accountTypeOptions[0];
  const resolvedAccountType = selectedAccountType?.value ?? "alta_access";
  const companies = user?.companyMemberships ?? [];
  const verifiedCompanies = companies.filter(
    (company) => company.companyVerificationStatus === "Verified",
  );
  const instant =
    selectedAccountType &&
    (isInstantApprovalAccountType(selectedAccountType.value) ||
      (hasPrivateAccess && isPrivateBankingAccountType(selectedAccountType.value)) ||
      (selectedAccountType.value === "business_operating" &&
        verifiedCompanies.some((company) => company.companyId === companyId)));

  function handleOwnershipChange(nextOwnership: "personal" | "company") {
    setOwnership(nextOwnership);
    setAccountType(defaultBankAccountTypeForOwnership(nextOwnership));
    if (nextOwnership === "personal") {
      setCompanyId("");
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreatedAccount(null);
    setSubmitting(true);

    const resolvedType = resolvedAccountType;

    try {
      const input: OpenBankAccountInput = {
        accountType: resolvedType,
        accountName,
        ownership,
        companyId: ownership === "company" ? companyId : undefined,
        openingNotes,
      };
      const result = await openBankAccountRecord({ data: input });
      setCreatedAccount(result);
    } catch (err) {
      const message = err instanceof Error ? err.message.replace(/^BAD_REQUEST:/, "") : "Unable to open account.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (createdAccount) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card className="space-y-6 !p-8 text-center">
          <p className="type-meta">
            Account created
          </p>
          <h2 className="text-2xl font-semibold tracking-tight">{createdAccount.accountName}</h2>
          <p className="text-[13px] text-muted-foreground">{createdAccount.accountTypeLabel}</p>

          <div className="mx-auto max-w-sm rounded-lg border border-border bg-surface-2/40 px-5 py-4 text-left">
            <div className="flex flex-col gap-1 border-b border-border/50 py-3">
              <span className={fieldLabel}>Routing number</span>
              <span className="font-mono text-[13px]">{createdAccount.routingNumber}</span>
            </div>
            <div className="flex flex-col gap-1 py-3">
              <span className={fieldLabel}>Account number</span>
              <span className="font-mono text-[13px]">{createdAccount.accountNumber}</span>
            </div>
            <div className="flex flex-col gap-1 border-t border-border/50 py-3">
              <span className={fieldLabel}>Status</span>
              <span className="font-mono text-[13px]">{createdAccount.statusLabel}</span>
            </div>
          </div>

          <p className="text-[13px] leading-relaxed text-muted-foreground">
            {createdAccount.instant
              ? "Your Alta Bank account is now active."
              : "Your opening request has been submitted. An Alta Bank operator will review it shortly."}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <RouteButton
              to="/bank/account/$accountId"
              params={{ accountId: createdAccount.accountId }}
              className="rounded-md bg-foreground px-5 py-2.5 text-[13px] font-medium tracking-wide text-background"
            >
              View account
            </RouteButton>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-2xl space-y-6">
      <Card className="space-y-6 !p-6">
        <label className="block">
          <span className={fieldLabel}>Ownership</span>
          <Select value={ownership} onValueChange={(v) => handleOwnershipChange(v as "personal" | "company")}>
            <SelectTrigger className={`${inputClass} h-auto min-h-10`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="personal">Personal account</SelectItem>
              <SelectItem value="company">Company account</SelectItem>
            </SelectContent>
          </Select>
        </label>

        {ownership === "company" && (
          <label className="block">
            <span className={fieldLabel}>Linked company</span>
            <Select value={companyId} onValueChange={setCompanyId} required>
              <SelectTrigger className={`${inputClass} h-auto min-h-10`}>
                <SelectValue placeholder="Select company" />
              </SelectTrigger>
              <SelectContent>
                {verifiedCompanies.map((c) => (
                  <SelectItem key={c.companyId} value={c.companyId}>
                    {c.companyName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {verifiedCompanies.length === 0 && (
              <p className="mt-2 text-[12px] text-muted-foreground">
                You need a verified company before opening a business operating account. Ask Alta
                operations to verify your company in the internal admin panel.
              </p>
            )}
          </label>
        )}

        <label className="block">
          <span className={fieldLabel}>Account type</span>
          <Select
            value={resolvedAccountType}
            onValueChange={(v) => setAccountType(v as BankAccountTypeCode)}
          >
            <SelectTrigger className={`${inputClass} h-auto min-h-10`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {accountTypeOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedAccountType && (
            <p className="mt-2 text-[12px] text-muted-foreground">{selectedAccountType.description}</p>
          )}
        </label>

        <label className="block">
          <span className={fieldLabel}>Account name</span>
          <input
            type="text"
            required
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            placeholder={ownership === "company" ? "Operating Account" : "Primary Checking"}
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className={fieldLabel}>Reason / notes</span>
          <Textarea
            autoResize
            value={openingNotes}
            onChange={(e) => setOpeningNotes(e.target.value)}
            placeholder="Tell us how you plan to use this account…"
            className={`${inputClass} min-h-[100px]`}
          />
        </label>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-[13px] text-destructive">
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={submitting || (ownership === "company" && !companyId) || !selectedAccountType}
          className="rounded-md bg-foreground px-5 py-2.5 text-[13px] font-medium tracking-wide text-background disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Submitting…" : instant ? "Open account" : "Submit opening request"}
        </button>
      </Card>
    </form>
  );
}
