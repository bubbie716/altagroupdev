"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
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
import { florin } from "@/lib/bank/api";
import { ensureIdempotencyKey } from "@/lib/bank/bank-action-flow";
import { waitBankProcessMin, BANK_PROCESS_MOTION } from "@/lib/bank/bank-process";
import { formatBankActionError } from "@/lib/bank/account-status-copy";
import { getBankActionUiLabScenario } from "@/lib/bank/bank-action-ui-lab";
import { usePostFinancialRefresh } from "@/hooks/use-post-financial-refresh";
import {
  fetchTerminalFundingEligibility,
  submitTerminalFundingTransferFn,
} from "@/lib/terminal/terminal-funding.functions";
import { resolveTerminalFundingPreselection } from "@/lib/terminal/terminal-funding-preselection";
import type {
  TerminalFundingDirection,
  TerminalFundingEligibility,
  TerminalFundingReceipt,
} from "@/lib/terminal/terminal-funding-types";
import { TERMINAL_FUNDING_TSE_DISCLAIMER } from "@/lib/terminal/terminal-funding-types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const inputClass =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-base sm:text-sm shadow-none focus-visible:outline-none focus-visible:border-gold/60 focus-visible:ring-0 disabled:opacity-60 min-h-11";

const EMPTY_ACCOUNTS: TerminalFundingEligibility["accounts"] = [];
const EMPTY_PORTFOLIOS: TerminalFundingEligibility["portfolios"] = [];

type Step = "direction" | "details" | "review" | "submitting" | "success" | "error";

export function TerminalFundingActionFlow({
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
  defaultPortfolioId,
  defaultAccountId,
}: BankActionFlowController & {
  onExitToChooser?: () => void;
  defaultPortfolioId?: string;
  defaultAccountId?: string;
}) {
  const loadEligibility = useServerFn(fetchTerminalFundingEligibility);
  const submitFunding = useServerFn(submitTerminalFundingTransferFn);
  const {
    status: refreshStatus,
    refreshAfterSuccess,
    retryRefresh,
    reset: resetRefresh,
  } = usePostFinancialRefresh();
  const refreshPromiseRef = useRef<Promise<unknown> | null>(null);

  const [eligibility, setEligibility] = useState<TerminalFundingEligibility | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingEligibility, setLoadingEligibility] = useState(true);
  const [portfolioNotice, setPortfolioNotice] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("direction");
  const [direction, setDirection] = useState<TerminalFundingDirection | null>(null);
  const [bankAccountId, setBankAccountId] = useState("");
  const [portfolioId, setPortfolioId] = useState("");
  const [amount, setAmount] = useState("");
  const [errorReason, setErrorReason] = useState<string | null>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<TerminalFundingReceipt | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);
  const submittingLockRef = useRef(false);
  const defaultsAppliedRef = useRef(false);
  /** Deep-link / requested portfolio until the user explicitly picks another. */
  const requestedPortfolioIdRef = useRef(defaultPortfolioId ?? "");
  const selectionRef = useRef({
    portfolioId: "",
    bankAccountId: "",
    direction: null as TerminalFundingDirection | null,
    defaultPortfolioId,
    defaultAccountId,
  });
  selectionRef.current = {
    portfolioId,
    bankAccountId,
    direction,
    defaultPortfolioId,
    defaultAccountId,
  };

  useEffect(() => {
    requestedPortfolioIdRef.current = defaultPortfolioId ?? "";
    defaultsAppliedRef.current = false;
  }, [defaultPortfolioId]);

  const reloadEligibility = useCallback(async () => {
    setLoadingEligibility(true);
    setLoadError(null);
    try {
      const data = await loadEligibility({
        data: { uiLabScenario: getBankActionUiLabScenario() },
      });
      setEligibility(data);
      const current = selectionRef.current;
      const requestedPortfolio =
        requestedPortfolioIdRef.current ||
        (!defaultsAppliedRef.current ? current.defaultPortfolioId : "") ||
        current.portfolioId;
      const resolved = resolveTerminalFundingPreselection(data, {
        portfolioId: requestedPortfolio,
        bankAccountId: defaultsAppliedRef.current
          ? current.bankAccountId || current.defaultAccountId
          : current.defaultAccountId,
        direction: current.direction,
      });
      setPortfolioId(resolved.portfolioId);
      setBankAccountId(resolved.bankAccountId);
      setPortfolioNotice(
        resolved.portfolioUnavailable ? resolved.portfolioUnavailableReason : null,
      );
      defaultsAppliedRef.current = true;
    } catch (err) {
      setEligibility(null);
      setLoadError(
        err instanceof Error
          ? err.message.replace(/^BAD_REQUEST:/, "").replace(/^FORBIDDEN:/, "")
          : "Unable to load funding accounts and portfolios.",
      );
    } finally {
      setLoadingEligibility(false);
    }
  }, [loadEligibility]);

  useEffect(() => {
    void reloadEligibility();
  }, [reloadEligibility]);

  useEffect(() => {
    if (step === "submitting") setPhase("submitting");
    else if (step === "success") setPhase("success");
    else if (step === "error") setPhase("error");
    else if (step === "review") setPhase("review");
    else setPhase("details");
  }, [step, setPhase]);

  const account = useMemo(
    () => eligibility?.accounts.find((a) => a.id === bankAccountId),
    [eligibility, bankAccountId],
  );
  const portfolio = useMemo(
    () => eligibility?.portfolios.find((p) => p.id === portfolioId),
    [eligibility, portfolioId],
  );

  // Terminal → Bank: portfolio is chosen first; filter Bank accounts to match.
  // Bank → Terminal: account is chosen first; filter portfolios to match.
  const portfolioFirst = direction === "TERMINAL_TO_BANK";

  const compatibleAccounts = useMemo(() => {
    if (!eligibility) return EMPTY_ACCOUNTS;
    if (!portfolio) return eligibility.accounts;
    return eligibility.accounts.filter((a) => {
      if (portfolio.ownerType === "personal") {
        return a.ownershipType === "PERSONAL";
      }
      return a.ownershipType === "COMPANY" && a.companyId === portfolio.ownerCompanyId;
    });
  }, [eligibility, portfolio]);

  const compatiblePortfolios = useMemo(() => {
    if (!eligibility) return EMPTY_PORTFOLIOS;
    // When portfolio is the primary selector, do not narrow options by the Bank account.
    if (portfolioFirst || !account) return eligibility.portfolios;
    return eligibility.portfolios.filter((p) => {
      if (account.ownershipType === "PERSONAL") return p.ownerType === "personal";
      return p.ownerType === "company" && p.ownerCompanyId === account.companyId;
    });
  }, [eligibility, account, portfolioFirst]);

  // Keep selections inside the compatible sets without wiping entered amount/direction.
  // Prefer the primary selector for the active direction (portfolio for Terminal → Bank).
  useEffect(() => {
    if (!eligibility || step === "submitting" || step === "success") return;
    if (portfolioFirst) {
      if (bankAccountId && !compatibleAccounts.some((a) => a.id === bankAccountId)) {
        const next =
          compatibleAccounts.find((a) => a.canCredit || a.canDebit) ?? compatibleAccounts[0];
        if (next) setBankAccountId(next.id);
      }
      return;
    }
    if (portfolioId && !compatiblePortfolios.some((p) => p.id === portfolioId)) {
      const next = compatiblePortfolios.find((p) => p.canFund) ?? compatiblePortfolios[0];
      if (next) setPortfolioId(next.id);
    }
    if (bankAccountId && !compatibleAccounts.some((a) => a.id === bankAccountId)) {
      const next =
        compatibleAccounts.find((a) => a.canDebit || a.canCredit) ?? compatibleAccounts[0];
      if (next) setBankAccountId(next.id);
    }
  }, [
    eligibility,
    step,
    portfolioFirst,
    portfolioId,
    bankAccountId,
    compatiblePortfolios,
    compatibleAccounts,
  ]);

  const amountNumber = Number(amount) || 0;
  const bankAfter =
    direction === "BANK_TO_TERMINAL"
      ? Math.max(0, (account?.availableBalance ?? 0) - amountNumber)
      : (account?.availableBalance ?? 0) + amountNumber;
  const terminalAfter =
    direction === "BANK_TO_TERMINAL"
      ? (portfolio?.availableCash ?? 0) + amountNumber
      : Math.max(0, (portfolio?.availableCash ?? 0) - amountNumber);

  useEffect(() => {
    const dirty =
      Boolean(direction || amount) && step !== "success" && step !== "submitting";
    setDirty(dirty);
  }, [direction, amount, step, setDirty]);

  useEffect(() => {
    if (loadError) {
      setTitle("Transfer money");
      setDescription("Funding options could not be loaded.");
      setShowBack(Boolean(onExitToChooser));
      registerBack(onExitToChooser ? () => onExitToChooser() : null);
      // Error UI owns Retry/Close — avoid host footer churn that can loop setState.
      setFooter(null);
      return;
    }
    if (step === "success") {
      setTitle("Funding completed");
      setDescription(undefined);
      setShowBack(false);
      registerBack(null);
      setFooter(null);
      return;
    }
    if (step === "submitting") {
      setTitle("Transfer money");
      setDescription(undefined);
      setShowBack(false);
      registerBack(null);
      setFooter(null);
      return;
    }
    if (step === "error") {
      setTitle("Funding unsuccessful");
      setDescription("Your entries were preserved.");
      setShowBack(true);
      registerBack(() => setStep("review"));
      setFooter(null);
      return;
    }
    if (step === "review") {
      setTitle("Review funding transfer");
      setDescription("Confirm details before moving florins.");
      setShowBack(true);
      registerBack(() => setStep("details"));
      return;
    }
    if (step === "details") {
      setTitle("Transfer money");
      setDescription("Choose source, destination, and amount.");
      setShowBack(true);
      registerBack(() => setStep("direction"));
      return;
    }
    setTitle("Transfer to or from Alta Terminal");
    setDescription("Move florins between Alta Bank and a Terminal portfolio.");
    setShowBack(Boolean(onExitToChooser));
    registerBack(onExitToChooser ? () => onExitToChooser() : null);
  }, [
    loadError,
    step,
    setTitle,
    setDescription,
    setShowBack,
    registerBack,
    onExitToChooser,
    setFooter,
  ]);

  async function submit() {
    if (submittingLockRef.current || !direction) return;
    submittingLockRef.current = true;
    setStep("submitting");
    const startedAt = Date.now();
    try {
      const key = ensureIdempotencyKey(idempotencyKeyRef);
      const result = await submitFunding({
        data: {
          direction,
          bankAccountId,
          portfolioId,
          amount: amountNumber,
          idempotencyKey: key,
          uiLabScenario: getBankActionUiLabScenario(),
        },
      });
      await waitBankProcessMin(startedAt, BANK_PROCESS_MOTION.minProcessingMs);
      setReceipt(result);
      idempotencyKeyRef.current = null;
      setStep("success");
      // Soft refresh — never flips success into an error state.
      const refreshPromise = refreshAfterSuccess("bank-terminal");
      refreshPromiseRef.current = refreshPromise;
      void refreshPromise.finally(() => {
        if (refreshPromiseRef.current === refreshPromise) {
          refreshPromiseRef.current = null;
        }
      });
    } catch (err) {
      const raw =
        err instanceof Error
          ? err.message.replace(/^BAD_REQUEST:/, "").replace(/^FORBIDDEN:/, "")
          : "Unable to complete funding transfer.";
      const formatted = formatBankActionError(raw, { action: "transfer" });
      setErrorReason(formatted.message);
      setStep("error");
    } finally {
      submittingLockRef.current = false;
    }
  }

  useEffect(() => {
    if (loadError || !eligibility) {
      return;
    }
    if (step === "details") {
      setFooter(
        <BankActionFooter>
          <BankActionPrimaryButton
            disabled={
              !direction ||
              !bankAccountId ||
              !portfolioId ||
              amountNumber <= 0 ||
              !account ||
              !portfolio
            }
            onClick={() => {
              setDetailsError(null);
              if (!direction || !account || !portfolio) return;
              if (direction === "BANK_TO_TERMINAL") {
                if (!account.canDebit) {
                  setDetailsError(account.blockedReason ?? "This Bank account cannot send funds.");
                  return;
                }
                if (amountNumber > account.availableBalance) {
                  setDetailsError("Amount exceeds available Bank balance.");
                  return;
                }
              } else {
                if (!account.canCredit) {
                  setDetailsError(
                    account.blockedReason ?? "This Bank account cannot receive funds.",
                  );
                  return;
                }
                if (!portfolio.canFund) {
                  setDetailsError(portfolio.blockedReason ?? "This portfolio cannot send funds.");
                  return;
                }
                if (amountNumber > portfolio.availableCash) {
                  setDetailsError("Amount exceeds Terminal available cash.");
                  return;
                }
              }
              if (!portfolio.canFund) {
                setDetailsError(portfolio.blockedReason ?? "This portfolio cannot be funded.");
                return;
              }
              setStep("review");
            }}
          >
            Continue
          </BankActionPrimaryButton>
        </BankActionFooter>,
      );
    } else if (step === "review") {
      setFooter(
        <BankActionFooter>
          <BankActionPrimaryButton onClick={() => void submit()}>
            Confirm transfer
          </BankActionPrimaryButton>
        </BankActionFooter>,
      );
    } else if (step !== "error" && step !== "success" && step !== "submitting" && !loadError) {
      setFooter(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, direction, bankAccountId, portfolioId, amountNumber, account, portfolio, loadError, eligibility]);

  if (loadingEligibility && !eligibility && !loadError) {
    return (
      <div className="animate-pulse space-y-3" aria-busy="true" aria-label="Loading">
        <div className="h-10 rounded-md bg-surface-2" />
        <div className="h-10 rounded-md bg-surface-2" />
      </div>
    );
  }

  if (loadError) {
    return (
      <BankProcessError
        title="Unable to load funding options"
        message={loadError}
        onClose={onDone}
        onRetry={() => void reloadEligibility()}
        retryLabel="Retry"
      />
    );
  }

  if (!eligibility) {
    return (
      <div className="animate-pulse space-y-3" aria-busy="true" aria-label="Loading">
        <div className="h-10 rounded-md bg-surface-2" />
        <div className="h-10 rounded-md bg-surface-2" />
      </div>
    );
  }

  if (step === "submitting") {
    return <BankActionProcessing label="Moving florins…" variant="transfer" />;
  }

  if (step === "success" && receipt) {
    return (
      <BankActionSuccess
        title="Funding completed"
        liveMessage={`Moved ${florin(receipt.amount)} ${
          receipt.direction === "BANK_TO_TERMINAL" ? "to" : "from"
        } ${receipt.portfolioName}.`}
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
          { label: "Amount", value: florin(receipt.amount) },
          {
            label: "Direction",
            value:
              receipt.direction === "BANK_TO_TERMINAL"
                ? "Bank to Terminal"
                : "Terminal to Bank",
          },
          { label: "Bank account", value: receipt.bankAccountLabel },
          { label: "Portfolio", value: receipt.portfolioName },
          { label: "Reference", value: receipt.referenceCode, mono: true },
          ...(receipt.resultingBankAvailable != null
            ? [{ label: "Bank available now", value: florin(receipt.resultingBankAvailable) }]
            : []),
          ...(receipt.resultingTerminalCash != null
            ? [{ label: "Terminal cash now", value: florin(receipt.resultingTerminalCash) }]
            : []),
        ]}
      />
    );
  }

  if (step === "error") {
    return (
      <BankProcessError
        message={errorReason ?? "Unable to complete funding transfer."}
        onClose={onDone}
        onEdit={() => setStep("details")}
        editLabel="Edit details"
        onRetry={() => void submit()}
        retryLabel="Try again"
      />
    );
  }

  if (step === "review" && direction) {
    return (
      <div className="space-y-4">
        <BankActionProgress step={3} total={3} label="Review" />
        <BankProcessSummary
          rows={[
            {
              label: "Direction",
              value:
                direction === "BANK_TO_TERMINAL" ? "Bank to Terminal" : "Terminal to Bank",
            },
            {
              label: direction === "BANK_TO_TERMINAL" ? "From" : "To",
              value: account?.label ?? "—",
            },
            {
              label: direction === "BANK_TO_TERMINAL" ? "To" : "From",
              value: portfolio?.name ?? "—",
              secondary: "Alta Terminal portfolio cash",
            },
            { label: "Amount", value: florin(amountNumber) },
            { label: "Bank available after", value: florin(bankAfter) },
            { label: "Terminal cash after", value: florin(terminalAfter) },
          ]}
        />
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          {TERMINAL_FUNDING_TSE_DISCLAIMER}
        </p>
      </div>
    );
  }

  if (step === "details" && direction) {
    const sourceIsBank = direction === "BANK_TO_TERMINAL";
    const accountSelectValue = compatibleAccounts.some((a) => a.id === bankAccountId)
      ? bankAccountId
      : undefined;
    const portfolioSelectValue = compatiblePortfolios.some((p) => p.id === portfolioId)
      ? portfolioId
      : undefined;

    const bankAccountField = (
      <label className="block">
        <span className="type-meta">{sourceIsBank ? "From Bank account" : "To Bank account"}</span>
        <Select value={accountSelectValue} onValueChange={setBankAccountId}>
          <SelectTrigger className={inputClass}>
            <SelectValue placeholder="Select account" />
          </SelectTrigger>
          <SelectContent>
            {compatibleAccounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.label} · {florin(a.availableBalance)} avail.
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
    );

    const portfolioField = (
      <label className="block">
        <span className="type-meta">
          {sourceIsBank ? "To Terminal portfolio" : "From Terminal portfolio"}
        </span>
        <Select
          value={portfolioSelectValue}
          onValueChange={(next) => {
            requestedPortfolioIdRef.current = next;
            setPortfolioId(next);
            setPortfolioNotice(null);
            // Terminal → Bank: portfolio drives ownership — pick a matching Bank account.
            if (!eligibility) return;
            const nextPortfolio = eligibility.portfolios.find((p) => p.id === next);
            if (!nextPortfolio) return;
            const matching = eligibility.accounts.filter((a) => {
              if (nextPortfolio.ownerType === "personal") {
                return a.ownershipType === "PERSONAL";
              }
              return (
                a.ownershipType === "COMPANY" && a.companyId === nextPortfolio.ownerCompanyId
              );
            });
            if (matching.some((a) => a.id === bankAccountId)) return;
            const preferred =
              matching.find((a) => (sourceIsBank ? a.canDebit : a.canCredit)) ?? matching[0];
            if (preferred) setBankAccountId(preferred.id);
          }}
        >
          <SelectTrigger className={inputClass}>
            <SelectValue placeholder="Select portfolio" />
          </SelectTrigger>
          <SelectContent>
            {compatiblePortfolios.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name} · {florin(p.availableCash)} cash
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
    );

    return (
      <div className="space-y-5">
        <BankActionProgress step={2} total={3} label="Details" />
        {portfolioNotice ? (
          <p className="rounded-md border border-amber-400/30 bg-amber-400/[0.06] px-3 py-2 text-[13px] text-foreground" role="status">
            {portfolioNotice}
          </p>
        ) : null}
        {portfolioFirst ? (
          <>
            {portfolioField}
            {bankAccountField}
          </>
        ) : (
          <>
            {bankAccountField}
            {portfolioField}
          </>
        )}
        <label className="block">
          <span className="type-meta">Amount</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={inputClass}
            placeholder="0.00"
          />
        </label>
        {detailsError ? (
          <p className="text-[13px] text-destructive" role="alert">
            {detailsError}
          </p>
        ) : null}
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          {TERMINAL_FUNDING_TSE_DISCLAIMER}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <BankActionProgress step={1} total={3} label="Direction" />
      <button
        type="button"
        className="flex min-h-11 w-full flex-col items-start rounded-md border border-border bg-surface-1 px-4 py-3 text-left hover:border-border-strong"
        onClick={() => {
          setDirection("BANK_TO_TERMINAL");
          setStep("details");
        }}
      >
        <span className="text-[14px] font-medium">Bank → Terminal</span>
        <span className="mt-1 text-[12px] text-muted-foreground">
          Move florins from an Alta Bank account into a Terminal portfolio’s cash.
        </span>
      </button>
      <button
        type="button"
        className="flex min-h-11 w-full flex-col items-start rounded-md border border-border bg-surface-1 px-4 py-3 text-left hover:border-border-strong"
        onClick={() => {
          setDirection("TERMINAL_TO_BANK");
          setStep("details");
        }}
      >
        <span className="text-[14px] font-medium">Terminal → Bank</span>
        <span className="mt-1 text-[12px] text-muted-foreground">
          Move available portfolio cash back to an Alta Bank account.
        </span>
      </button>
      <p className="text-[12px] leading-relaxed text-muted-foreground">
        {TERMINAL_FUNDING_TSE_DISCLAIMER}
      </p>
    </div>
  );
}
