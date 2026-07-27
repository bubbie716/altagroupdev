"use client";

import { useEffect, useRef, useState } from "react";
import {
  BankActionFooter,
  BankActionPrimaryButton,
  BankActionProcessing,
  BankActionProgress,
  BankActionSuccess,
} from "@/components/bank/actions/bank-action-chrome";
import {
  BankProcessError,
  BankProcessSummary,
} from "@/components/bank/actions/bank-process-ui";
import type { BankActionFlowController } from "@/components/bank/actions/bank-action-flow-types";
import { useCurrentUser } from "@/hooks/use-current-user";
import { openBankAccountRecord } from "@/lib/bank/bank.functions";
import { BANK_PROCESS_MOTION, waitBankProcessMin } from "@/lib/bank/bank-process";
import {
  mockBankActionSubmission,
  shouldUseBankActionUiLabMock,
} from "@/lib/bank/bank-action-ui-lab";
import { isOpenAccountFormDirty } from "@/lib/bank/bank-action-dirty";
import {
  defaultBankAccountTypeForOwnership,
  getBankAccountTypeOptionsForOpening,
  isInstantApprovalAccountType,
  type BankAccountTypeCode,
  type OpenBankAccountResult,
} from "@/lib/bank/backend-types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const fieldLabel = "type-meta";
const inputClass =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-base sm:text-sm shadow-none focus-visible:outline-none focus-visible:border-gold/60 focus-visible:ring-0 disabled:opacity-60 min-h-11";

export function OpenAccountActionFlow({
  phase,
  setPhase,
  setTitle,
  setDescription,
  setDirty,
  setShowBack,
  setFooter,
  registerBack,
  onDone,
  initialAccountType,
}: BankActionFlowController & {
  initialAccountType?: BankAccountTypeCode;
}) {
  const user = useCurrentUser();
  const seededType = initialAccountType ?? "alta_access";
  const seededOwnership =
    seededType === "business_operating" ? ("company" as const) : ("personal" as const);
  const [ownership, setOwnership] = useState<"personal" | "company">(seededOwnership);
  const [accountType, setAccountType] = useState<BankAccountTypeCode>(seededType);
  const [accountName, setAccountName] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<OpenBankAccountResult | null>(null);
  const submittingLockRef = useRef(false);
  const initialFormRef = useRef({
    accountName: "",
    ownership: seededOwnership,
    accountType: seededType,
    companyId: "",
  });

  const accountTypeOptions = getBankAccountTypeOptionsForOpening(ownership);
  const selectedAccountType =
    accountTypeOptions.find((option) => option.value === accountType) ?? accountTypeOptions[0];
  const verifiedCompanies = (user?.companyMemberships ?? []).filter(
    (company) => company.companyVerificationStatus === "Verified",
  );
  const instant =
    selectedAccountType &&
    (isInstantApprovalAccountType(selectedAccountType.value) ||
      (selectedAccountType.value === "business_operating" &&
        verifiedCompanies.some((company) => company.companyId === companyId)));

  const dirty = isOpenAccountFormDirty({
    accountName,
    ownership,
    accountType,
    companyId,
    initial: initialFormRef.current,
  });

  useEffect(() => {
    setDirty(dirty && phase !== "success" && phase !== "submitting");
  }, [dirty, phase, setDirty]);

  useEffect(() => {
    if (phase === "success") {
      setTitle(created?.instant ? "Account opened" : "Application pending review");
      setDescription(undefined);
      setShowBack(false);
      setFooter(null);
      registerBack(null);
      return;
    }
    if (phase === "submitting") {
      setTitle("Open an account");
      setDescription(undefined);
      setShowBack(false);
      setFooter(null);
      registerBack(null);
      return;
    }
    if (phase === "review") {
      setTitle("Review application");
      setDescription("Confirm product details before submitting.");
      setShowBack(true);
      registerBack(() => setPhase("details"));
      return;
    }
    if (phase === "error") {
      setTitle("Could not open account");
      setDescription("Your entries were preserved.");
      setShowBack(true);
      registerBack(() => setPhase("review"));
      setFooter(null);
      return;
    }
    setTitle("Open an account");
    setDescription("Choose a product and name your account.");
    setShowBack(false);
    registerBack(null);
  }, [phase, created, setTitle, setDescription, setShowBack, registerBack, setPhase, setFooter]);

  useEffect(() => {
    if (phase === "details") {
      setFooter(
        <BankActionFooter>
          <BankActionPrimaryButton
            disabled={
              !accountName.trim() ||
              !selectedAccountType ||
              (ownership === "company" && !companyId)
            }
            onClick={() => {
              setDetailsError(null);
              if (ownership === "company" && !companyId) {
                setDetailsError("Select the company that will own this account.");
                return;
              }
              setPhase("review");
            }}
          >
            Continue
          </BankActionPrimaryButton>
        </BankActionFooter>,
      );
    } else if (phase === "review") {
      // Header Back only — avoid duplicate footer Back.
      setFooter(
        <BankActionFooter>
          <BankActionPrimaryButton onClick={() => void submit()}>
            {instant ? "Open account" : "Submit for review"}
          </BankActionPrimaryButton>
        </BankActionFooter>,
      );
    } else {
      setFooter(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, accountName, selectedAccountType, ownership, companyId, instant]);

  async function submit() {
    if (submittingLockRef.current || phase === "submitting" || !selectedAccountType) return;
    submittingLockRef.current = true;
    setPhase("submitting");
    setError(null);
    const startedAt = Date.now();

    try {
      if (shouldUseBankActionUiLabMock()) {
        mockBankActionSubmission({ kind: "open", amount: 0, accountName });
        await waitBankProcessMin(startedAt, BANK_PROCESS_MOTION.minProcessingMs);
        setCreated({
          accountId: "ui-lab-account",
          accountNumber: "AB-5000-LAB001",
          routingNumber: "000000000",
          accountName,
          accountTypeLabel: selectedAccountType.label,
          statusLabel: instant ? "Active" : "Pending review",
          instant: Boolean(instant),
        });
        setPhase("success");
        return;
      }
      const result = await openBankAccountRecord({
        data: {
          accountType: selectedAccountType.value,
          accountName,
          ownership,
          companyId: ownership === "company" ? companyId : undefined,
        },
      });
      await waitBankProcessMin(startedAt, BANK_PROCESS_MOTION.minProcessingMs);
      setCreated(result);
      setPhase("success");
    } catch (err) {
      setError(
        err instanceof Error ? err.message.replace(/^BAD_REQUEST:/, "") : "Unable to open account.",
      );
      setPhase("error");
    } finally {
      submittingLockRef.current = false;
    }
  }

  if (phase === "submitting") {
    return (
      <BankActionProcessing
        label={instant ? "Opening your account…" : "Submitting application…"}
        variant="progress"
      />
    );
  }

  // Terminal state owns the whole view so the form never flashes back.
  if (phase === "success") {
    return (
      <BankActionSuccess
        kind={created?.instant ? "success" : "pending"}
        title={created?.instant ? "Account opened" : "Pending review"}
        liveMessage={
          created?.instant
            ? "Your account is open and ready to use."
            : "Your account application is pending review."
        }
        onDone={onDone}
        summary={
          created
            ? [
                { label: "Account", value: created.accountName },
                { label: "Number", value: created.accountNumber, mono: true },
                { label: "Product", value: created.accountTypeLabel },
                { label: "Status", value: created.statusLabel },
              ]
            : undefined
        }
      >
        {created?.instant ? (
          <p>You can fund it and start moving money right away.</p>
        ) : (
          <p>An Alta reviewer follows up once a decision is made.</p>
        )}
      </BankActionSuccess>
    );
  }

  if (phase === "error") {
    return (
      <BankProcessError
        message={error ?? "Unable to open account."}
        onEdit={() => setPhase("details")}
        onRetry={() => setPhase("review")}
      />
    );
  }

  if (phase === "review" && selectedAccountType) {
    return (
      <div className="space-y-4">
        <BankActionProgress step={2} total={3} label="Review" />
        <BankProcessSummary
          rows={[
            {
              label: "Owner",
              value: ownership === "company"
                ? verifiedCompanies.find((company) => company.companyId === companyId)
                    ?.companyName ?? "Company"
                : "Personal",
            },
            { label: "Product", value: selectedAccountType.label },
            { label: "Account name", value: accountName },
            { label: "Approval", value: instant ? "Instant" : "Manual review" },
          ]}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <BankActionProgress step={1} total={3} label="Details" />

      <fieldset className="space-y-2">
        <legend className={fieldLabel}>Owner</legend>
        {(
          [
            ["personal", "Personal"],
            ["company", "Company"],
          ] as const
        ).map(([value, label]) => (
          <label
            key={value}
            className="flex min-h-11 items-center gap-3 rounded-md border border-border px-3"
          >
            <input
              type="radio"
              name="ownership"
              checked={ownership === value}
              onChange={() => {
                setOwnership(value);
                setAccountType(defaultBankAccountTypeForOwnership(value));
                if (value === "personal") setCompanyId("");
                setDetailsError(null);
              }}
              disabled={value === "company" && verifiedCompanies.length === 0}
            />
            <span className="text-[14px]">{label}</span>
          </label>
        ))}
        {verifiedCompanies.length === 0 ? (
          <p className="text-[12px] text-muted-foreground">
            Company products require an existing verified company membership.
          </p>
        ) : null}
      </fieldset>

      {ownership === "company" ? (
        <label className="block">
          <span className={fieldLabel}>Company</span>
          <Select
            value={companyId}
            onValueChange={(value) => {
              setCompanyId(value);
              setDetailsError(null);
            }}
          >
            <SelectTrigger className={inputClass} aria-label="Company">
              <SelectValue placeholder="Select company" />
            </SelectTrigger>
            <SelectContent className="bg-[var(--menu-surface)]">
              {verifiedCompanies.map((company) => (
                <SelectItem key={company.companyId} value={company.companyId}>
                  {company.companyName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      ) : null}

      <label className="block">
        <span className={fieldLabel}>Product</span>
        <Select
          value={selectedAccountType?.value}
          onValueChange={(value) => setAccountType(value as BankAccountTypeCode)}
        >
          <SelectTrigger className={inputClass} aria-label="Product">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[var(--menu-surface)]">
            {accountTypeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>

      <label className="block">
        <span className={fieldLabel}>Account name</span>
        <input
          value={accountName}
          onChange={(e) => setAccountName(e.target.value)}
          className={inputClass}
          required
        />
      </label>

      {detailsError ? (
        <p className="text-[13px] text-destructive" role="alert">
          {detailsError}
        </p>
      ) : null}
    </div>
  );
}
