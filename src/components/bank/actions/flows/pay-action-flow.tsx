"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Search, ShieldCheck, UserRound } from "lucide-react";
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
import {
  bankAccountPayFundingKey,
  parsePayFundingKey,
  payFundingLabel,
  resolvePayFundingKey,
  selfPayBlockedCompanyIdForFunding,
} from "@/components/bank/alta-pay-form";
import { florin } from "@/lib/bank/api";
import { ensureIdempotencyKey } from "@/lib/bank/bank-action-flow";
import { resolvePreferredAccountId } from "@/lib/bank/bank-action-account-context";
import { BANK_PROCESS_MOTION, waitBankProcessMin } from "@/lib/bank/bank-process";
import {
  mockBankActionSubmission,
  shouldUseBankActionUiLabMock,
  getUiLabPayableRecipients,
} from "@/lib/bank/bank-action-ui-lab";
import { isPayFormDirty } from "@/lib/bank/bank-action-dirty";
import {
  searchPayableRecipientsForPay,
  submitAltaPay,
  submitAltaPayToPersonPayment,
  fetchPayFundingSources,
} from "@/lib/bank/alta-pay.functions";
import type {
  PayableRecipient,
  PayFundingSourceOption,
  SubmitAltaPayResult,
} from "@/lib/bank/alta-pay-types";
import type { UserBankAccount } from "@/lib/bank/backend-types";
import {
  formatBankActionError,
  transferBlockedReason,
  withdrawalBlockedReason,
} from "@/lib/bank/account-status-copy";
import { formatCustomerActionError } from "@/lib/bank/bank-action-errors";
import { usePostFinancialRefresh } from "@/hooks/use-post-financial-refresh";
import { SEARCH_DEBOUNCE_MS } from "@/lib/ui/route-loading";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isUiLabMode } from "@/lib/auth/ui-lab";
import { useOptionalProductConsentAction } from "@/components/legal/product-consent-action-controller";
import { executeWithProductConsentResume } from "@/lib/legal/execute-with-product-consent";
import {
  assertUiLabProductConsentForAction,
  isConsentCancelledError,
} from "@/lib/legal/ui-lab-action-consent";
import {
  getUiLabAcceptedOverlaySnapshot,
  getUiLabProductConsentScenario,
} from "@/lib/legal/ui-lab-product-consent";

const ALTA_PAY_SELF_COMPANY_BLOCKED = "Companies cannot send Alta Pay to themselves.";
const PERSON_RECEIVE_ACCOUNT_MISSING =
  "This customer does not have an active personal Alta Bank account to receive Alta Pay.";

const fieldLabel = "type-meta";
const inputClass =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-base sm:text-sm shadow-none focus-visible:outline-none focus-visible:border-gold/60 focus-visible:ring-0 disabled:opacity-60 min-h-11";

function fundingKeyOf(source: PayFundingSourceOption): string {
  return `${source.kind}:${source.id}`;
}

function bankAccountFundingSources(sources: PayFundingSourceOption[]): PayFundingSourceOption[] {
  return sources.filter((source) => source.kind === "bank_account");
}

function scopeFundingSources(
  sources: PayFundingSourceOption[],
  context: { workspace?: string; companyId?: string } | undefined,
): PayFundingSourceOption[] {
  if (!context) return sources;
  if (context.companyId) {
    return sources.filter(
      (source) =>
        source.kind !== "bank_account" || source.companyId === context.companyId,
    );
  }
  if (context.workspace === "personal") {
    return sources.filter(
      (source) => source.kind !== "bank_account" || !source.companyId,
    );
  }
  return sources;
}

function recipientIcon(recipient: PayableRecipient) {
  return recipient.kind === "company" ? ShieldCheck : UserRound;
}

export function PayActionFlow({
  accounts,
  defaultAccountId,
  phase,
  setPhase,
  setTitle,
  setDescription,
  setDirty,
  setShowBack,
  setFooter,
  registerBack,
  onDone,
  onExitToChooser,
  accountContext,
}: BankActionFlowController & {
  accounts: UserBankAccount[];
  defaultAccountId?: string;
  onExitToChooser?: () => void;
}) {
  const {
    status: refreshStatus,
    refreshAfterSuccess,
    retryRefresh,
    reset: resetRefresh,
  } = usePostFinancialRefresh();
  const refreshPromiseRef = useRef<Promise<unknown> | null>(null);
  const loadFunding = useServerFn(fetchPayFundingSources);
  const searchRecipients = useServerFn(searchPayableRecipientsForPay);
  const payCompany = useServerFn(submitAltaPay);
  const payPerson = useServerFn(submitAltaPayToPersonPayment);
  const consentAction = useOptionalProductConsentAction();

  const preferredAccountId = useMemo(
    () =>
      resolvePreferredAccountId(accounts, {
        accountId: defaultAccountId ?? accountContext?.accountId,
        workspace: accountContext?.workspace,
        companyId: accountContext?.companyId,
      }),
    [accounts, defaultAccountId, accountContext],
  );

  const [fundingSources, setFundingSources] = useState<PayFundingSourceOption[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fundingKeyValue, setFundingKeyValue] = useState("");
  const [recipientQuery, setRecipientQuery] = useState("");
  const [recipientResults, setRecipientResults] = useState<PayableRecipient[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<PayableRecipient | null>(null);
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [errorReason, setErrorReason] = useState<string | null>(null);
  const [referenceCode, setReferenceCode] = useState<string | null>(null);
  const [resultLabel, setResultLabel] = useState<string | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);
  const submittingLockRef = useRef(false);
  const initialFundingKeyRef = useRef<string>("");

  useEffect(() => {
    let cancelled = false;
    void loadFunding()
      .then((rows) => {
        if (cancelled) return;
        setFundingSources(rows);
        const preferredKey = preferredAccountId
          ? bankAccountPayFundingKey(preferredAccountId)
          : undefined;
        const key = resolvePayFundingKey(rows, preferredKey);
        initialFundingKeyRef.current = key;
        setFundingKeyValue(key);
      })
      .catch(() => {
        if (!cancelled) setLoadError("Could not load payment sources.");
      });
    return () => {
      cancelled = true;
    };
  }, [loadFunding, preferredAccountId]);

  const activeFundingSources = useMemo(() => {
    if (!fundingSources) return [];
    const scoped = scopeFundingSources(fundingSources, {
      workspace: accountContext?.workspace,
      companyId: accountContext?.companyId,
    });
    return selectedRecipient?.kind === "person"
      ? bankAccountFundingSources(scoped)
      : scoped;
  }, [fundingSources, selectedRecipient, accountContext]);

  const selectedFunding =
    activeFundingSources.find((s) => fundingKeyOf(s) === fundingKeyValue) ??
    activeFundingSources[0];
  const availableBalance = selectedFunding?.availableBalance ?? 0;
  const blockedSelfPayCompanyId = selfPayBlockedCompanyIdForFunding(selectedFunding);

  const dirty = isPayFormDirty({
    amount,
    memo,
    hasSelectedRecipient: Boolean(selectedRecipient),
    fundingKey: fundingKeyValue,
    initialFundingKey: initialFundingKeyRef.current,
  });

  useEffect(() => {
    setDirty(dirty && phase !== "success" && phase !== "submitting" && phase !== "awaiting_consent");
  }, [dirty, phase, setDirty]);

  useEffect(() => {
    if (phase === "selection") setPhase("details");
  }, [phase, setPhase]);

  useEffect(() => {
    if (phase === "success") {
      setTitle("Payment sent");
      setDescription(undefined);
      setShowBack(false);
      setFooter(null);
      registerBack(null);
      return;
    }
    if (phase === "submitting") {
      setTitle("Pay");
      setDescription(undefined);
      setShowBack(false);
      setFooter(null);
      registerBack(null);
      return;
    }
    if (phase === "awaiting_consent") {
      setTitle("Review payment");
      setDescription("Accept required product terms to continue.");
      setShowBack(false);
      setFooter(null);
      registerBack(null);
      return;
    }
    if (phase === "review") {
      setTitle("Review payment");
      setDescription("Confirm the payment details.");
      setShowBack(true);
      registerBack(() => setPhase("details"));
      return;
    }
    if (phase === "error") {
      setTitle("Payment unsuccessful");
      setDescription("Your entries were preserved.");
      setShowBack(true);
      registerBack(() => setPhase("review"));
      setFooter(null);
      return;
    }
    setTitle("Pay");
    setDescription("Send Florin to a person or company.");
    setShowBack(Boolean(onExitToChooser));
    registerBack(onExitToChooser ? () => onExitToChooser() : null);
  }, [
    phase,
    setTitle,
    setDescription,
    setShowBack,
    registerBack,
    onExitToChooser,
    setPhase,
    setFooter,
  ]);

  useEffect(() => {
    if (phase === "details") {
      setFooter(
        <BankActionFooter>
          <BankActionPrimaryButton
            disabled={!selectedRecipient || !amount || Number(amount) <= 0 || !selectedFunding}
            onClick={() => goToReview()}
          >
            Continue
          </BankActionPrimaryButton>
        </BankActionFooter>,
      );
    } else if (phase === "review") {
      setFooter(
        <BankActionFooter>
          <BankActionPrimaryButton onClick={() => void submit()}>Confirm payment</BankActionPrimaryButton>
        </BankActionFooter>,
      );
    } else {
      setFooter(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, selectedRecipient, amount, selectedFunding]);

  useEffect(() => {
    if (recipientQuery.trim().length < 1) {
      setRecipientResults([]);
      setSearchBusy(false);
      return;
    }
    setSearchBusy(true);
    const handle = setTimeout(() => {
      if (isUiLabMode()) {
        setRecipientResults(getUiLabPayableRecipients(recipientQuery.trim()));
        setSearchBusy(false);
        return;
      }
      void searchRecipients({ data: recipientQuery.trim() })
        .then((rows) => {
          setRecipientResults(rows);
        })
        .catch(() => setRecipientResults([]))
        .finally(() => setSearchBusy(false));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [recipientQuery, searchRecipients]);

  const payableResults =
    selectedRecipient?.kind === "company" && blockedSelfPayCompanyId
      ? recipientResults.filter(
          (recipient) =>
            recipient.kind !== "company" || recipient.id !== blockedSelfPayCompanyId,
        )
      : recipientResults;

  function goToReview() {
    setDetailsError(null);
    const payAmount = Number(amount);
    if (!selectedRecipient) {
      setDetailsError("Select a person or company to pay.");
      return;
    }
    if (selectedRecipient.kind === "person" && !selectedRecipient.canReceive) {
      setDetailsError(PERSON_RECEIVE_ACCOUNT_MISSING);
      return;
    }
    if (
      selectedRecipient.kind === "company" &&
      blockedSelfPayCompanyId &&
      selectedRecipient.id === blockedSelfPayCompanyId
    ) {
      setDetailsError(ALTA_PAY_SELF_COMPANY_BLOCKED);
      return;
    }
    if (selectedRecipient.kind === "person" && activeFundingSources.length === 0) {
      setDetailsError("Open an Alta Bank account to send money to another Alta customer.");
      return;
    }
    if (!selectedFunding) {
      setDetailsError("Select a funding source.");
      return;
    }
    if (!payAmount || payAmount <= 0) {
      setDetailsError("Enter a valid payment amount.");
      return;
    }
    if (payAmount > availableBalance) {
      setDetailsError("Amount exceeds available balance.");
      return;
    }
    if (selectedFunding.kind === "bank_account" && selectedFunding.accountStatusInfo) {
      const blocked =
        selectedRecipient.kind === "person"
          ? transferBlockedReason(selectedFunding.accountStatusInfo, "source")
          : withdrawalBlockedReason(selectedFunding.accountStatusInfo);
      if (blocked) {
        setDetailsError(blocked);
        return;
      }
    }
    setPhase("review");
  }

  async function submit() {
    if (submittingLockRef.current || phase === "submitting" || phase === "awaiting_consent") return;
    if (!selectedRecipient || !selectedFunding) return;
    submittingLockRef.current = true;
    setPhase("awaiting_consent");
    const startedAt = Date.now();
    const key = ensureIdempotencyKey(idempotencyKeyRef);

    try {
      if (consentAction) {
        await consentAction.requestConsent(["BANK", "ALTA_PAY"]);
      }

      setPhase("submitting");
      const result = await executeWithProductConsentResume(async () => {
        if (shouldUseBankActionUiLabMock()) {
          assertUiLabProductConsentForAction("alta_pay.submit", {
            uiLabScenario: getUiLabProductConsentScenario(),
            uiLabAcceptedOverlay: getUiLabAcceptedOverlaySnapshot(
              getUiLabProductConsentScenario(),
            ),
          });
          return {
            referenceCode: mockBankActionSubmission({
              kind: "pay",
              amount: Number(amount),
              accountName: selectedFunding.label,
            }).referenceCode,
            companyName: selectedRecipient.name,
            mock: true as const,
          };
        }

        if (selectedRecipient.kind === "company") {
          const paid = await payCompany({
            data: {
              fundingSource: parsePayFundingKey(fundingKeyValue),
              companyId: selectedRecipient.id,
              amount: Number(amount),
              memo: memo.trim() || undefined,
              idempotencyKey: key,
            },
          });
          return { ...paid, mock: false as const };
        }

        const funding = parsePayFundingKey(fundingKeyValue);
        if (funding.kind !== "bank_account") {
          throw new Error("Person payments require a bank account.");
        }
        const paid = await payPerson({
          data: {
            fundingSource: funding,
            recipientUserId: selectedRecipient.id,
            amount: Number(amount),
            memo: memo.trim() || undefined,
            idempotencyKey: key,
          },
        });
        return { ...paid, mock: false as const };
      }, consentAction);

      await waitBankProcessMin(startedAt, BANK_PROCESS_MOTION.minProcessingMs);
      idempotencyKeyRef.current = null;
      setReferenceCode(result.referenceCode);
      setResultLabel(
        "companyName" in result && result.companyName
          ? result.companyName
          : selectedRecipient.name,
      );
      setPhase("success");
      const refreshPromise = refreshAfterSuccess("bank");
      refreshPromiseRef.current = refreshPromise;
      void refreshPromise.finally(() => {
        if (refreshPromiseRef.current === refreshPromise) {
          refreshPromiseRef.current = null;
        }
      });
    } catch (err) {
      if (isConsentCancelledError(err)) {
        setPhase("review");
        return;
      }
      const raw = err instanceof Error ? err.message.replace(/^BAD_REQUEST:/, "") : "";
      const accountId =
        selectedFunding?.kind === "bank_account" ? selectedFunding.id : undefined;
      setErrorReason(
        raw
          ? formatBankActionError(raw, { action: "pay", accountId }).message
          : formatCustomerActionError(err, "pay", { accountId }),
      );
      setPhase("error");
    } finally {
      submittingLockRef.current = false;
    }
  }

  if (loadError) {
    return <p className="text-[14px] text-muted-foreground">{loadError}</p>;
  }

  if (!fundingSources) {
    return (
      <div className="animate-pulse space-y-3" aria-busy="true">
        <div className="h-10 rounded-md bg-surface-2" />
        <div className="h-10 rounded-md bg-surface-2" />
      </div>
    );
  }

  if (fundingSources.length === 0) {
    return (
      <p className="text-[14px] text-muted-foreground">
        Open an Alta Bank account before sending Alta Pay.
      </p>
    );
  }

  if (phase === "submitting") {
    return <BankActionProcessing label="Sending payment…" variant="transfer" />;
  }

  if (phase === "success") {
    const recipientName = (resultLabel ?? "recipient").replace(/\.+$/, "");
    return (
      <BankActionSuccess
        title="Payment sent"
        liveMessage={`Sent ${florin(Number(amount))} to ${recipientName}`}
        onDone={() => {
          void (async () => {
            if (refreshPromiseRef.current) {
              try {
                await refreshPromiseRef.current;
              } catch {
                /* soft — transaction already succeeded */
              }
            }
            resetRefresh();
            onDone();
          })();
        }}
        refreshStatus={refreshStatus === "idle" ? "refreshing" : refreshStatus}
        onRetryRefresh={() => {
          void retryRefresh();
        }}
        summary={[
          { label: "Amount", value: florin(Number(amount) || 0) },
          { label: "To", value: recipientName },
          ...(referenceCode
            ? [{ label: "Reference", value: referenceCode, mono: true }]
            : []),
        ]}
      />
    );
  }

  if (phase === "error") {
    return (
      <BankProcessError
        message={errorReason ?? "Unable to send payment."}
        onEdit={() => setPhase("details")}
        onRetry={() => setPhase("review")}
      />
    );
  }

  if (phase === "review" && selectedRecipient && selectedFunding) {
    return (
      <div className="space-y-4">
        <BankActionProgress step={2} total={3} label="Review" />
        <BankProcessSummary
          rows={[
            {
              label: "To",
              value: selectedRecipient.name,
              secondary: selectedRecipient.destinationLabel ?? undefined,
            },
            {
              label: "From",
              value: payFundingLabel(selectedFunding),
              secondary: `Available ${florin(availableBalance)}`,
            },
            { label: "Amount", value: florin(Number(amount) || 0) },
            ...(memo.trim() ? [{ label: "Note", value: memo }] : []),
          ]}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <BankActionProgress step={1} total={3} label="Details" />
      <div>
        <span className={fieldLabel}>Recipient</span>
        <div className="relative mt-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className={`${inputClass} pl-9`}
            value={recipientQuery}
            onChange={(e) => {
              setRecipientQuery(e.target.value);
              setSelectedRecipient(null);
              setDetailsError(null);
            }}
            placeholder="Search people or companies"
            aria-label="Search recipients"
            autoComplete="off"
          />
        </div>
        {searchBusy ? (
          <p className="mt-2 text-[12px] text-muted-foreground">Searching…</p>
        ) : null}
        {recipientQuery.trim().length >= 1 &&
        !selectedRecipient &&
        !searchBusy &&
        payableResults.length === 0 ? (
          <p className="mt-2 text-[13px] text-muted-foreground">No matching recipients.</p>
        ) : null}
        {payableResults.length > 0 && !selectedRecipient ? (
          <ul
            className="mt-2 overflow-hidden rounded-md border border-border bg-[var(--menu-surface)] shadow-md"
            role="listbox"
            aria-label="Recipient results"
          >
            {payableResults.map((recipient) => {
              const Icon = recipientIcon(recipient);
              return (
                <li key={`${recipient.kind}-${recipient.id}`}>
                  <button
                    type="button"
                    role="option"
                    className="flex min-h-11 w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--menu-item-hover)]"
                    onClick={() => {
                      if (recipient.kind === "person" && !recipient.canReceive) {
                        setDetailsError(PERSON_RECEIVE_ACCOUNT_MISSING);
                        return;
                      }
                      setSelectedRecipient(recipient);
                      setRecipientQuery(recipient.name);
                      setRecipientResults([]);
                      setDetailsError(null);
                    }}
                  >
                    <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span>
                      <span className="font-medium">{recipient.name}</span>
                      <span className="mt-0.5 block text-[12px] text-muted-foreground">
                        {recipient.kind === "company"
                          ? recipient.subtitle || "Verified company"
                          : recipient.subtitle}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
        {selectedRecipient ? (
          <div className="mt-3 rounded-lg border border-border bg-surface-2/40 px-4 py-3">
            <div className="flex items-center gap-2">
              {(() => {
                const Icon = recipientIcon(selectedRecipient);
                return <Icon className="size-4 text-muted-foreground" aria-hidden />;
              })()}
              <span className="font-medium">{selectedRecipient.name}</span>
            </div>
            <p className="mt-1 text-[12px] text-muted-foreground">
              {selectedRecipient.destinationLabel}
            </p>
          </div>
        ) : null}
      </div>

      <label className="block">
        <span className={fieldLabel}>From</span>
        <Select value={fundingKeyValue} onValueChange={setFundingKeyValue}>
          <SelectTrigger className={inputClass} aria-label="From account">
            <SelectValue placeholder="Select funding source" />
          </SelectTrigger>
          <SelectContent className="bg-[var(--menu-surface)]">
            {activeFundingSources.map((source) => (
              <SelectItem key={fundingKeyOf(source)} value={fundingKeyOf(source)}>
                <span className="block min-w-0">
                  <span className="block truncate">{payFundingLabel(source)}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedFunding ? (
          <p className="mt-1.5 text-[12px] text-muted-foreground">
            Available {florin(availableBalance)}
          </p>
        ) : null}
      </label>

      <label className="block">
        <span className={fieldLabel}>Amount (ƒ)</span>
        <input
          className={`${inputClass} tabular-nums text-foreground`}
          type="number"
          min="0.01"
          step="0.01"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          aria-label="Payment amount in Florin"
        />
      </label>

      <label className="block">
        <span className={fieldLabel}>Note (optional)</span>
        <Textarea
          autoResize
          className={`${inputClass} min-h-[80px]`}
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
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

