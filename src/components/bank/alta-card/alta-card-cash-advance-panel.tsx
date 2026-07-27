"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  BankRequestSubmitButton,
  type BankRequestSubmissionResult,
} from "@/components/bank/bank-request-submission-ui";
import {
  BankActionProcessing,
} from "@/components/bank/actions/bank-action-chrome";
import { BankProcessError, BankProcessResult } from "@/components/bank/actions/bank-process-ui";
import { BANK_PROCESS_MOTION, waitBankProcessMin } from "@/lib/bank/bank-process";
import { SkeletonFormPanel } from "@/components/ui/skeleton-form-panel";
import { LOADING_COPY } from "@/lib/ui/route-loading";
import { florin } from "@/lib/bank/api";
import { formatCustomerActionError } from "@/lib/bank/bank-action-errors";
import {
  fetchCashAdvanceContext,
  fetchEmployeeCashAdvanceContext,
  submitCashAdvanceRecord,
  submitEmployeeCashAdvanceRecord,
} from "@/lib/bank/alta-card.functions";
import type { AltaCardRow, UserEmployeeAltaCardSummary } from "@/lib/bank/alta-card-types";
import { formatAltaCardCurrency } from "@/lib/bank/alta-card-types";
import { AltaCardActionButton } from "@/components/bank/alta-card/alta-card-ui-primitives";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { closeAllBankWorkflows, registerBankWorkflow } from "@/lib/ui/bank-workflow-registry";
import { registerTransientOverlay } from "@/lib/ui/transient-overlay-registry";
import {
  mockBankActionSubmission,
  shouldUseBankActionUiLabMock,
} from "@/lib/bank/bank-action-ui-lab";
import { applyUiLabAltaCardCashAdvance } from "@/lib/bank/ui-lab-alta-card-state";
import { isUiLabMode } from "@/lib/auth/ui-lab";
import { cn } from "@/lib/utils";

const fieldLabel = "type-meta";
const inputClass =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-none focus-visible:outline-none focus-visible:border-gold/60 focus-visible:ring-0 focus-visible:shadow-none disabled:cursor-not-allowed disabled:opacity-60";

type FormView = "compose" | "review" | "submitting" | "success" | "error";

type AltaCardCashAdvancePanelProps = {
  variant?: "button" | "quick" | "panel";
} & (
  | { card: AltaCardRow; employeeCard?: never }
  | { employeeCard: UserEmployeeAltaCardSummary; card?: never }
);

export function AltaCardCashAdvancePanel({
  card,
  employeeCard,
  variant = "button",
}: AltaCardCashAdvancePanelProps) {
  const router = useRouter();
  const isEmployee = Boolean(employeeCard);
  const loadCardContext = useServerFn(fetchCashAdvanceContext);
  const loadEmployeeContext = useServerFn(fetchEmployeeCashAdvanceContext);
  const submitCardAdvance = useServerFn(submitCashAdvanceRecord);
  const submitEmployeeAdvance = useServerFn(submitEmployeeCashAdvanceRecord);
  const isModal = variant === "quick" || variant === "button";

  const [open, setOpen] = useState(variant === "panel");
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<FormView>("compose");
  const [destinationAccountId, setDestinationAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [accounts, setAccounts] = useState<
    { id: string; accountName: string; accountNumber: string }[]
  >([]);
  const [availableCredit, setAvailableCredit] = useState(
    isEmployee ? employeeCard!.employeeAvailableLimit : card!.availableCredit,
  );
  const [currentBalance, setCurrentBalance] = useState(
    isEmployee ? employeeCard!.employeeCurrentBalance : card!.currentBalance,
  );
  const [composeError, setComposeError] = useState<string | null>(null);
  const [errorReason, setErrorReason] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submission, setSubmission] = useState<BankRequestSubmissionResult | null>(null);
  const loadedRef = useRef(false);
  const submittingLockRef = useRef(false);

  const disabled = isEmployee
    ? employeeCard!.status !== "active" || employeeCard!.employeeAvailableLimit <= 0
    : card!.status !== "active" || card!.availableCredit <= 0;

  const advanceDescription = isEmployee
    ? "Transfer available employee credit to one of your personal Alta accounts. Cash advances increase your employee spend balance."
    : card!.cardType === "business"
      ? "Transfer available credit to a personal or business operating account. Cash advances increase the company card balance."
      : "Transfer available credit to your checking account. Cash advances increase your Alta Card balance.";

  const cardSourceLabel = isEmployee
    ? `Employee Alta Card •••• ${employeeCard!.cardLastFour}`
    : `Alta Card •••• ${card!.cardLastFour}`;

  const balanceLabel = isEmployee ? "Employee spend balance" : "Current balance";
  const advanceAmount = Number(amount) || 0;
  const resultingBalance = currentBalance + advanceAmount;
  const resultingAvailable = Math.max(0, availableCredit - advanceAmount);
  const selectedAccount = accounts.find((account) => account.id === destinationAccountId);

  const resetForm = useCallback(() => {
    setView("compose");
    setComposeError(null);
    setErrorReason(null);
    setSubmission(null);
    setAmount("");
    setMemo("");
    setSubmitting(false);
    submittingLockRef.current = false;
  }, []);

  const openPanel = useCallback(async () => {
    closeAllBankWorkflows();
    setOpen(true);
    resetForm();
    setLoading(true);
    try {
      if (shouldUseBankActionUiLabMock() && !isEmployee) {
        const mockAccounts = [
          {
            id: "ui-lab-checking",
            accountName: "UI Lab Checking",
            accountNumber: "AB-5000-000001",
          },
        ];
        setAccounts(mockAccounts);
        setAvailableCredit(card!.availableCredit);
        setCurrentBalance(card!.currentBalance);
        setDestinationAccountId(mockAccounts[0].id);
      } else if (isEmployee) {
        const ctx = await loadEmployeeContext({ data: employeeCard!.id });
        setAccounts(ctx.destinationAccounts);
        setAvailableCredit(ctx.availableCredit);
        setCurrentBalance(ctx.currentBalance);
        setDestinationAccountId(ctx.destinationAccounts[0]?.id ?? "");
        if (ctx.destinationAccounts.length === 0) {
          setComposeError("Open a personal Alta account to receive cash advances.");
        }
      } else {
        const ctx = await loadCardContext({ data: card!.id });
        setAccounts(ctx.destinationAccounts);
        setAvailableCredit(ctx.availableCredit);
        setCurrentBalance(ctx.card.currentBalance);
        setDestinationAccountId(ctx.destinationAccounts[0]?.id ?? "");
      }
    } catch (err) {
      setComposeError(
        err instanceof Error
          ? err.message.replace(/^BAD_REQUEST:/, "")
          : "Could not load cash advance options",
      );
    } finally {
      setLoading(false);
    }
  }, [
    card,
    employeeCard,
    isEmployee,
    loadCardContext,
    loadEmployeeContext,
    resetForm,
  ]);

  useEffect(() => {
    if (!open || !isModal) return;
    const forceClose = () => {
      setOpen(false);
      resetForm();
    };
    const unsubWorkflow = registerBankWorkflow(forceClose);
    const unsubTransient = registerTransientOverlay(forceClose);
    return () => {
      unsubWorkflow();
      unsubTransient();
    };
  }, [open, isModal, resetForm]);

  function handleOpenChange(next: boolean) {
    if (!next && (view === "submitting" || submittingLockRef.current)) return;
    setOpen(next);
    if (!next) {
      resetForm();
    }
  }

  useEffect(() => {
    if (variant === "panel" && !loadedRef.current) {
      loadedRef.current = true;
      void openPanel();
    }
  }, [variant, openPanel]);

  function goToReview() {
    setComposeError(null);
    if (!destinationAccountId) {
      setComposeError("Select a destination account.");
      return;
    }
    if (!advanceAmount || advanceAmount <= 0) {
      setComposeError("Enter a valid amount.");
      return;
    }
    if (advanceAmount > availableCredit) {
      setComposeError("Amount exceeds available credit.");
      return;
    }
    setView("review");
  }

  async function submitAdvance(e: React.FormEvent) {
    e.preventDefault();
    if (!destinationAccountId || submittingLockRef.current || view === "submitting") return;

    submittingLockRef.current = true;
    setSubmitting(true);
    setView("submitting");
    setErrorReason(null);
    const startedAt = Date.now();

    try {
      let referenceCode: string;

      if (shouldUseBankActionUiLabMock() && !isEmployee) {
        const mock = mockBankActionSubmission({
          kind: "cash_advance",
          amount: advanceAmount,
          accountName: selectedAccount?.accountName,
          accountNumber: selectedAccount?.accountNumber,
        });
        referenceCode = mock.referenceCode;
        applyUiLabAltaCardCashAdvance(card!.id, advanceAmount);
      } else {
        const res = (isEmployee
          ? await submitEmployeeAdvance({
              data: {
                employeeCardId: employeeCard!.id,
                destinationAccountId,
                amount: advanceAmount,
                memo: memo.trim() || undefined,
              },
            })
          : await submitCardAdvance({
              data: {
                cardId: card!.id,
                destinationAccountId,
                amount: advanceAmount,
                memo: memo.trim() || undefined,
              },
            })) as { referenceCode: string };
        referenceCode = res.referenceCode;
        if (isUiLabMode() && !isEmployee && card) {
          applyUiLabAltaCardCashAdvance(card.id, advanceAmount);
        }
      }

      const submitted: BankRequestSubmissionResult = {
        referenceCode,
        amount: advanceAmount,
        submittedAt: new Date().toISOString(),
        accountName: selectedAccount?.accountName ?? "—",
        accountNumber: selectedAccount?.accountNumber ?? "—",
      };

      await waitBankProcessMin(startedAt, BANK_PROCESS_MOTION.minProcessingMs);
      setSubmission(submitted);
      setView("success");
      if (!(shouldUseBankActionUiLabMock() && !isEmployee)) {
        await router.invalidate();
      }
    } catch (err) {
      setErrorReason(formatCustomerActionError(err, "cash_advance"));
      setView("error");
    } finally {
      setSubmitting(false);
      submittingLockRef.current = false;
    }
  }

  function renderContent() {
    if (loading) {
      return <SkeletonFormPanel fields={3} label={LOADING_COPY.cashAdvanceOptions} />;
    }

    if (view === "submitting") {
      return <BankActionProcessing label="Processing cash advance…" />;
    }

    if (view === "success" && submission) {
      return (
        <BankProcessResult
          kind="success"
          title="Cash advance completed"
          liveMessage={`Advanced ${florin(submission.amount)} to ${submission.accountName}.`}
          summary={[
            { label: "Amount", value: florin(submission.amount) },
            {
              label: "To",
              value: submission.accountName,
              secondary: submission.accountNumber,
            },
            {
              label: "Card balance after",
              value: formatAltaCardCurrency(resultingBalance),
            },
            {
              label: "Available credit after",
              value: formatAltaCardCurrency(resultingAvailable),
            },
            { label: "Reference", value: submission.referenceCode, mono: true },
          ]}
          onDone={() => handleOpenChange(false)}
        />
      );
    }

    if (view === "error") {
      return (
        <BankProcessError
          title="Cash advance failed"
          message={errorReason ?? "Your cash advance could not be completed."}
          onRetry={() => {
            setErrorReason(null);
            setView("review");
          }}
          retryLabel="Try again"
        />
      );
    }

    if (view === "review" && selectedAccount) {
      return (
        <form
          onSubmit={submitAdvance}
          className={cn(!isModal && "mx-auto max-w-2xl space-y-6")}
        >
          <Card className="space-y-6 !p-6">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">
                Review cash advance
              </div>
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                Confirm the details below before submitting. Cash advances increase your{" "}
                {isEmployee ? "employee spend balance" : "Alta Card balance"} and deposit funds to
                your selected account instantly.
              </p>
            </div>

            <div className="space-y-4 border-y border-border/60 py-6 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">From</span>
                <span className="text-right font-mono text-[12px]">{cardSourceLabel}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">To</span>
                <span className="text-right">
                  <span className="font-medium">{selectedAccount.accountName}</span>
                  <span className="mt-0.5 block font-mono text-[12px] text-muted-foreground">
                    {selectedAccount.accountNumber}
                  </span>
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Amount</span>
                <span className="type-finance-nums">{florin(advanceAmount)}</span>
              </div>
              {memo.trim() ? (
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Memo</span>
                  <span className="max-w-[220px] text-right text-[13px]">{memo.trim()}</span>
                </div>
              ) : null}
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">{balanceLabel} after</span>
                <span className="type-finance-nums">{formatAltaCardCurrency(resultingBalance)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Available credit after</span>
                <span className="type-finance-nums">{formatAltaCardCurrency(resultingAvailable)}</span>
              </div>
            </div>

            <fieldset
              disabled={submitting}
              className="flex flex-wrap items-center gap-2 border-0 p-0 m-0 min-w-0"
            >
              <button
                type="button"
                disabled={submitting}
                onClick={() => setView("compose")}
                className="rounded-md border border-border px-4 py-2.5 text-[13px] font-medium transition-colors hover:bg-surface-2/60 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Back
              </button>
              <BankRequestSubmitButton
                kind="cash_advance"
                submitting={false}
                disabled={submitting}
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
        className={cn(!isModal && "mx-auto max-w-2xl space-y-6", isModal ? "space-y-4" : "space-y-6")}
      >
        <Card
          className={cn(
            isModal
              ? "space-y-4 border-0 bg-transparent p-0 shadow-none"
              : "space-y-6 !p-6",
          )}
        >
          {!isModal ? (
            <>
              <p className="font-serif text-[18px]">Cash advance</p>
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                {advanceDescription} Available credit {formatAltaCardCurrency(availableCredit)}.
              </p>
            </>
          ) : null}

          <fieldset
            disabled={submitting}
            className={cn(
              "border-0 p-0 m-0 min-w-0",
              isModal ? "space-y-4" : "space-y-6",
            )}
          >
            <label className="block">
              <span className={fieldLabel}>Destination account</span>
              <Select
                value={destinationAccountId}
                onValueChange={setDestinationAccountId}
                disabled={submitting || accounts.length === 0}
              >
                <SelectTrigger className={`${inputClass} h-auto min-h-10`}>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.accountName} · {account.accountNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <label className="block">
              <span className={fieldLabel}>Amount (ƒ)</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                max={availableCredit > 0 ? availableCredit : undefined}
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className={`${inputClass} tabular`}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Available credit {formatAltaCardCurrency(availableCredit)}
              </p>
            </label>

            <label className="block">
              <span className={fieldLabel}>Memo (optional)</span>
              <Textarea
                autoResize
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="Optional note for your records…"
                className={`${inputClass} min-h-[80px]`}
              />
            </label>
          </fieldset>

          {composeError ? (
            <p className="text-sm text-destructive" role="alert">
              {composeError}
            </p>
          ) : null}

          <div className={cn("flex flex-wrap items-center gap-2", isModal && "mt-6")}>
            <BankRequestSubmitButton
              kind="cash_advance"
              submitting={false}
              disabled={
                accounts.length === 0 || !advanceAmount || advanceAmount <= 0
              }
              label="Review Cash Advance"
              showContainer={false}
            />
          </div>
        </Card>
      </form>
    );
  }

  if (isModal) {
    return (
      <>
        {variant === "quick" ? (
          <AltaCardActionButton
            label="Cash advance"
            tile
            disabled={disabled}
            onClick={() => void openPanel()}
          />
        ) : (
          <button
            type="button"
            onClick={() => void openPanel()}
            disabled={disabled}
            className="rounded-md border border-border bg-surface-2 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] disabled:opacity-50"
          >
            Cash advance
          </button>
        )}
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogContent
            className={cn(
              "flex max-w-lg flex-col gap-0 overflow-hidden border-border bg-surface-1 p-0",
              "max-md:left-0 max-md:right-0 max-md:top-auto max-md:bottom-[var(--bank-mobile-nav-offset)] max-md:max-h-[var(--bank-mobile-sheet-max-height)] max-md:w-full max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-t-2xl max-md:rounded-b-none",
            )}
            onPointerDownOutside={(event) => event.preventDefault()}
            onInteractOutside={(event) => event.preventDefault()}
          >
            <DialogHeader className="border-b border-border px-4 py-3 pr-14 text-left sm:px-5">
              <DialogTitle className="text-[16px] font-semibold">Cash advance</DialogTitle>
              <DialogDescription>{advanceDescription}</DialogDescription>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
              {renderContent()}
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  if (!open) {
    return null;
  }

  return <div>{renderContent()}</div>;
}
