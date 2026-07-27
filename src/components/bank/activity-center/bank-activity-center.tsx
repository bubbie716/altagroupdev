"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { SlidersHorizontal } from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/internal/status-badge";
import { BankActionLauncher } from "@/components/bank/actions/bank-action-launcher";
import { BankAccountActivityLink } from "@/components/bank/bank-account-activity-link";
import {
  BankMobileStack,
  BankMobileStackField,
  BankMobileStackRow,
} from "@/components/bank/bank-scroll-contain";
import { florin } from "@/lib/bank/api";
import type { BankActivityCenterBundle, ActivityScheduledInstruction } from "@/lib/bank/bank-activity-center-types";
import {
  findAuthorizedAutopay,
  findAuthorizedRequest,
  findAuthorizedSchedule,
  findAuthorizedTransaction,
  isPendingMoneyRequestTransaction,
} from "@/lib/bank/bank-activity-center-types";
import type { BankActivityView } from "@/lib/bank/bank-activity-center-url";
import {
  mergeBankActivityCenterSearch,
  stripBankActivityDetailSearch,
} from "@/lib/bank/bank-activity-center-url";
import { focusDialogCloseButton } from "@/lib/ui/focus-dialog-close";
import type {
  BankRequestInProgress,
  BankTransactionStatusCode,
  BankTransactionTypeCode,
  UserBankTransaction,
} from "@/lib/bank/backend-types";
import type { MerchantAutopayApprovalRow } from "@/lib/bank/payments-engine-types";
import {
  formatBankTransactionTypeLabel,
  presentUserBankTransaction,
} from "@/lib/bank/transaction-display";
import { formatActivityDateTime } from "@/lib/format-datetime";
import {
  cancelAltaPayScheduleFn,
  cancelMerchantAutopayApprovalFn,
  pauseAltaPayScheduleFn,
  pauseMerchantAutopayApprovalFn,
  resumeAltaPayScheduleFn,
} from "@/lib/bank/payments-engine.functions";
import { cancelUserScheduledTransferRecord } from "@/lib/bank/scheduled-transfer.functions";
import { invalidateRouteData } from "@/lib/router/invalidate-route-data";
import { cn } from "@/lib/utils";
import { overlayZClass } from "@/lib/ui/overlay-layers";

const TYPE_OPTIONS: BankTransactionTypeCode[] = [
  "deposit",
  "withdrawal",
  "adjustment",
  "loan_payment",
  "interest_charge",
  "interest_credit",
];

const STATUS_OPTIONS: { value: BankTransactionStatusCode; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "denied", label: "Denied" },
  { value: "cancelled", label: "Cancelled" },
];

const FIELD_CLASS =
  "mt-1 h-11 w-full min-w-0 rounded-md border border-border bg-surface-1 px-3 text-[15px] text-foreground transition-[border-color] focus-visible:border-gold/60 focus-visible:outline-none sm:h-10 sm:text-[13px]";
const LABEL_CLASS = "block text-[12px] font-medium text-muted-foreground";

const VIEWS: { id: BankActivityView; label: string }[] = [
  { id: "activity", label: "Activity" },
  { id: "requests", label: "Requests" },
  { id: "scheduled", label: "Scheduled" },
  { id: "autopay", label: "AutoPay" },
];

function formatShortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function DetailSheet({
  open,
  title,
  description,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        className={cn(
          overlayZClass("bankAction"),
          "flex max-w-lg flex-col gap-0 overflow-hidden border-border bg-surface-1 p-0",
          "max-h-[var(--bank-mobile-sheet-max-height)] md:max-h-[min(90dvh,calc(100dvh-4rem))]",
          "max-md:inset-x-0 max-md:top-auto max-md:bottom-[var(--bank-mobile-nav-offset)]",
          "max-md:left-0 max-md:right-0 max-md:h-auto max-md:w-full max-md:max-w-none",
          "max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-t-2xl max-md:rounded-b-none",
        )}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          focusDialogCloseButton(event.currentTarget);
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
        }}
      >
        <DialogHeader className="shrink-0 border-b border-border px-4 py-3 pr-14 text-left sm:px-5">
          <DialogTitle className="text-[16px] font-semibold tracking-tight">{title}</DialogTitle>
          {description ? (
            <DialogDescription className="mt-1 text-[13px] text-muted-foreground">
              {description}
            </DialogDescription>
          ) : (
            <DialogDescription className="sr-only">Record details</DialogDescription>
          )}
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          {children}
        </div>
        {footer ? (
          <div className="shrink-0 border-t border-border px-4 py-3 sm:px-5">{footer}</div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function DetailField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 border-b border-border/60 py-3 last:border-0">
      <p className="text-[12px] text-muted-foreground">{label}</p>
      <div className="mt-1 break-words text-[14px] text-foreground">{children}</div>
    </div>
  );
}

export function BankActivityCenter({
  data,
  view,
  accountId,
  transactionId,
  requestId,
  scheduleId,
  approvalId,
  lockAccountId,
  basePath = "/bank/activity",
}: {
  data: BankActivityCenterBundle;
  view: BankActivityView;
  accountId?: string;
  transactionId?: string;
  requestId?: string;
  scheduleId?: string;
  approvalId?: string;
  /** When set, account filter is locked (account-scoped activity). */
  lockAccountId?: string;
  basePath?: "/bank/activity" | "/bank/account/$accountId/activity";
}) {
  const router = useRouter();
  const effectiveAccountId = lockAccountId ?? accountId;

  const [query, setQuery] = useState("");
  const [filterAccountId, setFilterAccountId] = useState(effectiveAccountId ?? "all");
  const [type, setType] = useState<"all" | BankTransactionTypeCode>("all");
  const [status, setStatus] = useState<"all" | BankTransactionStatusCode>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const pauseSchedule = useServerFn(pauseAltaPayScheduleFn);
  const resumeSchedule = useServerFn(resumeAltaPayScheduleFn);
  const cancelSchedule = useServerFn(cancelAltaPayScheduleFn);
  const cancelTransfer = useServerFn(cancelUserScheduledTransferRecord);
  const pauseAutopay = useServerFn(pauseMerchantAutopayApprovalFn);
  const cancelAutopay = useServerFn(cancelMerchantAutopayApprovalFn);

  useEffect(() => {
    if (lockAccountId) setFilterAccountId(lockAccountId);
  }, [lockAccountId]);

  function navigateSearch(patch: Record<string, unknown>) {
    const current = router.state.location.search as Record<string, unknown>;
    void router.navigate({
      to: basePath,
      params: lockAccountId ? { accountId: lockAccountId } : undefined,
      search: mergeBankActivityCenterSearch(current, patch) as never,
      replace: false,
    });
  }

  function closeDetail() {
    const current = router.state.location.search as Record<string, unknown>;
    void router.navigate({
      to: basePath,
      params: lockAccountId ? { accountId: lockAccountId } : undefined,
      search: stripBankActivityDetailSearch(current) as never,
      replace: true,
    });
    setDetailError(null);
  }

  const selectedTransaction = findAuthorizedTransaction(data.transactions, transactionId);
  const selectedRequest = findAuthorizedRequest(data.requests, requestId);
  const selectedSchedule = findAuthorizedSchedule(data.scheduled, scheduleId);
  const selectedAutopay = findAuthorizedAutopay(data.autopay, approvalId);

  useEffect(() => {
    if (transactionId && !selectedTransaction) {
      setDetailError("That transaction is not available.");
    } else if (requestId && !selectedRequest) {
      setDetailError("That request is not available.");
    } else if (scheduleId && !selectedSchedule) {
      setDetailError("That scheduled payment is not available.");
    } else if (approvalId && !selectedAutopay) {
      setDetailError("That AutoPay authorization is not available.");
    } else {
      setDetailError(null);
    }
  }, [
    transactionId,
    requestId,
    scheduleId,
    approvalId,
    selectedTransaction,
    selectedRequest,
    selectedSchedule,
    selectedAutopay,
  ]);

  const accounts = useMemo(() => {
    if (data.accounts.length > 0) {
      return data.accounts.map((account) => ({
        id: account.id,
        name: account.accountName,
      }));
    }
    const map = new Map<string, string>();
    for (const tx of data.transactions) map.set(tx.bankAccountId, tx.accountName);
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [data.accounts, data.transactions]);

  const filteredTransactions = useMemo(() => {
    const q = query.trim().toLowerCase();
    const accountFilter = lockAccountId ?? (filterAccountId === "all" ? null : filterAccountId);
    return data.transactions.filter((tx) => {
      if (isPendingMoneyRequestTransaction(tx)) return false;
      if (accountFilter && tx.bankAccountId !== accountFilter) return false;
      if (type !== "all" && tx.type !== type) return false;
      if (status !== "all" && tx.status !== status) return false;
      if (!q) return true;
      return (
        tx.description.toLowerCase().includes(q) ||
        tx.referenceCode.toLowerCase().includes(q) ||
        tx.accountName.toLowerCase().includes(q) ||
        tx.accountNumber.toLowerCase().includes(q) ||
        tx.typeLabel.toLowerCase().includes(q)
      );
    });
  }, [data.transactions, query, filterAccountId, lockAccountId, type, status]);

  async function runScheduleAction(
    row: ActivityScheduledInstruction,
    action: "pause" | "resume" | "cancel",
  ) {
    setBusyId(row.id);
    setActionError(null);
    try {
      if (row.kind === "transfer") {
        if (action !== "cancel") return;
        await cancelTransfer({
          data: { paymentId: row.id, transferScope: "intrabank" },
        });
      } else if (action === "pause") {
        await pauseSchedule({ data: row.id });
      } else if (action === "resume") {
        await resumeSchedule({ data: row.id });
      } else {
        await cancelSchedule({ data: row.id });
      }
      await invalidateRouteData(router);
      closeDetail();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Something went wrong. Try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function runAutopayAction(row: MerchantAutopayApprovalRow, action: "pause" | "cancel") {
    setBusyId(row.id);
    setActionError(null);
    try {
      if (action === "pause") {
        await pauseAutopay({ data: row.id });
      } else {
        await cancelAutopay({ data: row.id });
      }
      await invalidateRouteData(router);
      closeDetail();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Something went wrong. Try again.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="min-w-0 space-y-4">
      <div
        role="tablist"
        aria-label="Activity views"
        className="flex min-w-0 gap-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {VIEWS.map((item) => {
          const selected = view === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => navigateSearch({ view: item.id, transactionId: undefined, requestId: undefined, scheduleId: undefined, approvalId: undefined })}
              className={cn(
                "h-10 shrink-0 rounded-md px-3 text-[13px] font-medium transition-colors",
                selected
                  ? "bg-foreground text-background"
                  : "border border-border bg-surface-1 text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {detailError ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-[13px] text-destructive" role="alert">
          {detailError}
        </p>
      ) : null}
      {actionError ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-[13px] text-destructive" role="alert">
          {actionError}
        </p>
      ) : null}

      {view === "activity" ? (
        <ActivityTransactionsPanel
          transactions={filteredTransactions}
          accounts={accounts}
          query={query}
          setQuery={setQuery}
          filterAccountId={filterAccountId}
          setFilterAccountId={setFilterAccountId}
          lockAccountId={lockAccountId}
          type={type}
          setType={setType}
          status={status}
          setStatus={setStatus}
          filtersOpen={filtersOpen}
          setFiltersOpen={setFiltersOpen}
          onOpen={(id) => navigateSearch({ view: "activity", transactionId: id })}
        />
      ) : null}

      {view === "requests" ? (
        <RequestsPanel
          requests={
            effectiveAccountId
              ? data.requests.filter((row) => row.bankAccountId === effectiveAccountId)
              : data.requests
          }
          onOpen={(id) => navigateSearch({ view: "requests", requestId: id })}
          lockedAccountId={lockAccountId}
        />
      ) : null}

      {view === "scheduled" ? (
        <ScheduledPanel
          rows={
            effectiveAccountId
              ? data.scheduled.filter((row) => row.bankAccountId === effectiveAccountId)
              : data.scheduled
          }
          onOpen={(id) => navigateSearch({ view: "scheduled", scheduleId: id })}
          lockedAccountId={lockAccountId}
        />
      ) : null}

      {view === "autopay" ? (
        <AutopayPanel
          rows={
            effectiveAccountId
              ? data.autopay.filter(
                  (row) =>
                    row.fundingSource.kind === "bank_account" &&
                    row.fundingSource.accountId === effectiveAccountId,
                )
              : data.autopay
          }
          onOpen={(id) => navigateSearch({ view: "autopay", approvalId: id })}
        />
      ) : null}

      <DetailSheet
        open={Boolean(selectedTransaction)}
        title="Transaction"
        onClose={closeDetail}
      >
        {selectedTransaction ? <TransactionDetail tx={selectedTransaction} /> : null}
      </DetailSheet>

      <DetailSheet
        open={Boolean(selectedRequest)}
        title="Request"
        onClose={closeDetail}
      >
        {selectedRequest ? <RequestDetail request={selectedRequest} /> : null}
      </DetailSheet>

      <DetailSheet
        open={Boolean(selectedSchedule)}
        title="Scheduled"
        onClose={closeDetail}
        footer={
          selectedSchedule ? (
            <div className="flex flex-wrap gap-2">
              {selectedSchedule.canPause ? (
                <button
                  type="button"
                  disabled={busyId === selectedSchedule.id}
                  className="inline-flex h-11 items-center rounded-md border border-border px-4 text-[13px] font-medium"
                  onClick={() => void runScheduleAction(selectedSchedule, "pause")}
                >
                  Pause
                </button>
              ) : null}
              {selectedSchedule.canResume ? (
                <button
                  type="button"
                  disabled={busyId === selectedSchedule.id}
                  className="inline-flex h-11 items-center rounded-md border border-border px-4 text-[13px] font-medium"
                  onClick={() => void runScheduleAction(selectedSchedule, "resume")}
                >
                  Resume
                </button>
              ) : null}
              {selectedSchedule.canCancel ? (
                <button
                  type="button"
                  disabled={busyId === selectedSchedule.id}
                  className="inline-flex h-11 items-center rounded-md bg-foreground px-4 text-[13px] font-medium text-background"
                  onClick={() => void runScheduleAction(selectedSchedule, "cancel")}
                >
                  Cancel
                </button>
              ) : null}
            </div>
          ) : null
        }
      >
        {selectedSchedule ? <ScheduleDetail row={selectedSchedule} /> : null}
      </DetailSheet>

      <DetailSheet
        open={Boolean(selectedAutopay)}
        title="AutoPay"
        onClose={closeDetail}
        footer={
          selectedAutopay ? (
            <div className="flex flex-wrap gap-2">
              {selectedAutopay.status === "active" ? (
                <button
                  type="button"
                  disabled={busyId === selectedAutopay.id}
                  className="inline-flex h-11 items-center rounded-md border border-border px-4 text-[13px] font-medium"
                  onClick={() => void runAutopayAction(selectedAutopay, "pause")}
                >
                  Pause
                </button>
              ) : null}
              {selectedAutopay.status === "active" || selectedAutopay.status === "paused" ? (
                <button
                  type="button"
                  disabled={busyId === selectedAutopay.id}
                  className="inline-flex h-11 items-center rounded-md bg-foreground px-4 text-[13px] font-medium text-background"
                  onClick={() => void runAutopayAction(selectedAutopay, "cancel")}
                >
                  Revoke
                </button>
              ) : null}
            </div>
          ) : null
        }
      >
        {selectedAutopay ? <AutopayDetail row={selectedAutopay} /> : null}
      </DetailSheet>
    </div>
  );
}

function TransactionDetail({ tx }: { tx: UserBankTransaction }) {
  const presented = presentUserBankTransaction(tx);
  return (
    <div>
      <DetailField label="Status">
        <StatusBadge status={tx.statusLabel} />
      </DetailField>
      <DetailField label="Amount">{presented.displayAmount}</DetailField>
      <DetailField label="Type">{tx.typeLabel}</DetailField>
      <DetailField label="Account">
        <BankAccountActivityLink
          accountId={tx.bankAccountId}
          accountName={tx.accountName}
          accountNumber={tx.accountNumber}
        />
      </DetailField>
      <DetailField label="Description">{tx.description}</DetailField>
      <DetailField label="Reference">
        <span className="break-all">{tx.referenceCode}</span>
      </DetailField>
      <DetailField label="Date">{formatActivityDateTime(tx.createdAt)}</DetailField>
      {tx.reviewNote ? <DetailField label="Note">{tx.reviewNote}</DetailField> : null}
      {tx.hasProof && tx.proofImageUrl ? (
        <DetailField label="Proof">
          <button
            type="button"
            className="text-[13px] font-medium text-gold underline-offset-2 hover:underline"
            onClick={() => window.open(tx.proofImageUrl!, "_blank", "noopener,noreferrer")}
          >
            View proof
          </button>
        </DetailField>
      ) : null}
    </div>
  );
}

function RequestDetail({ request }: { request: BankRequestInProgress }) {
  return (
    <div>
      <DetailField label="Status">
        <StatusBadge status={request.statusLabel} />
      </DetailField>
      <DetailField label="Amount">{florin(request.amount)}</DetailField>
      <DetailField label="Account">
        <BankAccountActivityLink
          accountId={request.bankAccountId}
          accountName={request.accountName}
          accountNumber={request.accountNumber}
        />
      </DetailField>
      <DetailField label="Submitted">{formatActivityDateTime(request.submittedAt)}</DetailField>
      <DetailField label="Last update">{formatActivityDateTime(request.lastUpdatedAt)}</DetailField>
      <DetailField label="Reference">
        <span className="break-all">{request.referenceCode}</span>
      </DetailField>
      {request.denialMessage ? (
        <DetailField label="Explanation">{request.denialMessage}</DetailField>
      ) : null}
      {request.hasProof && request.proofImageUrl ? (
        <DetailField label="Proof">
          <button
            type="button"
            className="text-[13px] font-medium text-gold underline-offset-2 hover:underline"
            onClick={() => window.open(request.proofImageUrl!, "_blank", "noopener,noreferrer")}
          >
            View proof
          </button>
        </DetailField>
      ) : null}
    </div>
  );
}

function ScheduleDetail({ row }: { row: ActivityScheduledInstruction }) {
  return (
    <div>
      <DetailField label="Status">
        <StatusBadge status={row.statusLabel} />
      </DetailField>
      <DetailField label="Type">{row.paymentTypeLabel}</DetailField>
      <DetailField label="Amount">{florin(row.amount)}</DetailField>
      <DetailField label="Destination">{row.destination}</DetailField>
      <DetailField label="Funding account">{row.fundingLabel}</DetailField>
      {row.frequencyLabel ? <DetailField label="Frequency">{row.frequencyLabel}</DetailField> : null}
      {row.nextRunDate ? (
        <DetailField label="Next payment">{formatActivityDateTime(row.nextRunDate)}</DetailField>
      ) : null}
      {row.lastFailureReason ? (
        <DetailField label="Last failure">{row.lastFailureReason}</DetailField>
      ) : null}
    </div>
  );
}

function AutopayDetail({ row }: { row: MerchantAutopayApprovalRow }) {
  return (
    <div>
      <DetailField label="Status">
        <StatusBadge status={row.statusLabel} />
      </DetailField>
      <DetailField label="Merchant">{row.merchantName}</DetailField>
      <DetailField label="Funding source">{row.fundingAccountLabel}</DetailField>
      <DetailField label="Max invoice">{florin(row.maxInvoiceAmount)}</DetailField>
      <DetailField label="Frequency">{row.allowedFrequencyLabel}</DetailField>
      <DetailField label="Max payments / month">{row.maxPaymentsPerMonth}</DetailField>
      {row.confirmationRequiredAboveAmount != null ? (
        <DetailField label="Confirm above">
          {florin(row.confirmationRequiredAboveAmount)}
        </DetailField>
      ) : null}
    </div>
  );
}

function ActivityTransactionsPanel({
  transactions,
  accounts,
  query,
  setQuery,
  filterAccountId,
  setFilterAccountId,
  lockAccountId,
  type,
  setType,
  status,
  setStatus,
  filtersOpen,
  setFiltersOpen,
  onOpen,
}: {
  transactions: UserBankTransaction[];
  accounts: { id: string; name: string }[];
  query: string;
  setQuery: (value: string) => void;
  filterAccountId: string;
  setFilterAccountId: (value: string) => void;
  lockAccountId?: string;
  type: "all" | BankTransactionTypeCode;
  setType: (value: "all" | BankTransactionTypeCode) => void;
  status: "all" | BankTransactionStatusCode;
  setStatus: (value: "all" | BankTransactionStatusCode) => void;
  filtersOpen: boolean;
  setFiltersOpen: (value: boolean) => void;
  onOpen: (id: string) => void;
}) {
  const activeFilterCount =
    (query.trim() ? 1 : 0) +
    (lockAccountId || filterAccountId === "all" ? 0 : 1) +
    (type === "all" ? 0 : 1) +
    (status === "all" ? 0 : 1);

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Search activity</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search description or reference"
            className={FIELD_CLASS}
          />
        </label>
        <button
          type="button"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-border px-3 text-[13px] font-medium sm:w-auto"
          onClick={() => setFiltersOpen(!filtersOpen)}
          aria-expanded={filtersOpen}
        >
          <SlidersHorizontal className="size-3.5" aria-hidden />
          Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
        </button>
      </div>

      {filtersOpen ? (
        <div className="grid min-w-0 gap-3 rounded-xl border border-border bg-surface-1 p-3 sm:grid-cols-3">
          {!lockAccountId ? (
            <label className="min-w-0">
              <span className={LABEL_CLASS}>Account</span>
              <select
                className={FIELD_CLASS}
                value={filterAccountId}
                onChange={(e) => setFilterAccountId(e.target.value)}
              >
                <option value="all">All accounts</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="min-w-0">
            <span className={LABEL_CLASS}>Type</span>
            <select
              className={FIELD_CLASS}
              value={type}
              onChange={(e) => setType(e.target.value as "all" | BankTransactionTypeCode)}
            >
              <option value="all">All types</option>
              {TYPE_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {formatBankTransactionTypeLabel(value)}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-0">
            <span className={LABEL_CLASS}>Status</span>
            <select
              className={FIELD_CLASS}
              value={status}
              onChange={(e) => setStatus(e.target.value as "all" | BankTransactionStatusCode)}
            >
              <option value="all">All statuses</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {transactions.length === 0 ? (
        <EmptyState
          title="No activity yet"
          description="Completed deposits, withdrawals, and transfers will appear here."
          action={
            <BankActionLauncher action="deposit" variant="outline" className="h-11">
              Deposit
            </BankActionLauncher>
          }
        />
      ) : (
        <>
          <BankMobileStack>
            {transactions.map((tx) => {
              const presented = presentUserBankTransaction(tx);
              return (
                <button
                  key={tx.id}
                  type="button"
                  className="w-full text-left"
                  onClick={() => onOpen(tx.id)}
                >
                  <BankMobileStackRow>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-medium">{tx.description}</p>
                        <p className="mt-0.5 text-[12px] text-muted-foreground">
                          {formatShortDate(tx.createdAt)} · {tx.accountName}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="type-finance-md font-medium tabular">{presented.displayAmount}</p>
                        <StatusBadge status={tx.statusLabel} />
                      </div>
                    </div>
                  </BankMobileStackRow>
                </button>
              );
            })}
          </BankMobileStack>

          <div className="hidden overflow-hidden rounded-xl border border-border md:block">
            <table className="alta-table w-full text-sm">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Account</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => {
                  const presented = presentUserBankTransaction(tx);
                  return (
                    <tr
                      key={tx.id}
                      className="cursor-pointer hover:bg-surface-2/40"
                      onClick={() => onOpen(tx.id)}
                    >
                      <td className="whitespace-nowrap text-muted-foreground">
                        {formatShortDate(tx.createdAt)}
                      </td>
                      <td className="min-w-0">
                        <p className="truncate font-medium">{tx.description}</p>
                        <p className="truncate text-[12px] text-muted-foreground">{tx.referenceCode}</p>
                      </td>
                      <td className="min-w-0 truncate">{tx.accountName}</td>
                      <td className="type-finance-md font-medium tabular">{presented.displayAmount}</td>
                      <td>
                        <StatusBadge status={tx.statusLabel} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function RequestsPanel({
  requests,
  onOpen,
  lockedAccountId,
}: {
  requests: BankRequestInProgress[];
  onOpen: (id: string) => void;
  lockedAccountId?: string;
}) {
  if (requests.length === 0) {
    return (
      <EmptyState
        title="No requests"
        description="Deposit and withdrawal requests will appear here."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <BankActionLauncher
              action="deposit"
              accountId={lockedAccountId}
              variant="outline"
              className="h-11"
            >
              Deposit
            </BankActionLauncher>
            <BankActionLauncher
              action="withdraw"
              accountId={lockedAccountId}
              variant="outline"
              className="h-11"
            >
              Withdraw
            </BankActionLauncher>
          </div>
        }
      />
    );
  }

  return (
    <div className="min-w-0 space-y-3">
      <p className="text-[13px] text-muted-foreground">Deposit and withdrawal requests</p>
      <BankMobileStack>
        {requests.map((request) => (
          <button key={request.id} type="button" className="w-full text-left" onClick={() => onOpen(request.id)}>
            <BankMobileStackRow>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <StatusBadge status={request.statusLabel} />
                  <p className="mt-1 truncate text-[14px] font-medium">{request.accountName}</p>
                  <p className="mt-0.5 break-all text-[12px] text-muted-foreground">
                    {request.referenceCode}
                  </p>
                </div>
                <p className="type-finance-md shrink-0 font-medium tabular">{florin(request.amount)}</p>
              </div>
              <BankMobileStackField label="Submitted">
                {formatActivityDateTime(request.submittedAt)}
              </BankMobileStackField>
            </BankMobileStackRow>
          </button>
        ))}
      </BankMobileStack>

      <div className="hidden overflow-hidden rounded-xl border border-border md:block">
        <table className="alta-table w-full text-sm">
          <thead>
            <tr>
              <th>Status</th>
              <th>Account</th>
              <th>Amount</th>
              <th>Submitted</th>
              <th>Reference</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => (
              <tr
                key={request.id}
                className="cursor-pointer hover:bg-surface-2/40"
                onClick={() => onOpen(request.id)}
              >
                <td>
                  <StatusBadge status={request.statusLabel} />
                </td>
                <td className="min-w-0 truncate">{request.accountName}</td>
                <td className="type-finance-md font-medium tabular">{florin(request.amount)}</td>
                <td className="text-muted-foreground">{formatShortDate(request.submittedAt)}</td>
                <td className="break-all text-muted-foreground">{request.referenceCode}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ScheduledPanel({
  rows,
  onOpen,
  lockedAccountId,
}: {
  rows: ActivityScheduledInstruction[];
  onOpen: (id: string) => void;
  lockedAccountId?: string;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No scheduled payments"
        description="Scheduled and recurring transfers or Alta Pay payments will appear here."
        action={
          <BankActionLauncher
            action="transfer"
            accountId={lockedAccountId}
            variant="outline"
            className="h-11"
          >
            Transfer
          </BankActionLauncher>
        }
      />
    );
  }

  return (
    <div className="min-w-0 space-y-3">
      <BankMobileStack>
        {rows.map((row) => (
          <button key={row.id} type="button" className="w-full text-left" onClick={() => onOpen(row.id)}>
            <BankMobileStackRow>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-medium">{row.title}</p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">
                    {row.paymentTypeLabel} · {row.statusLabel}
                  </p>
                </div>
                <p className="type-finance-md shrink-0 font-medium tabular">{florin(row.amount)}</p>
              </div>
              {row.nextRunDate ? (
                <BankMobileStackField label="Next payment">
                  {formatActivityDateTime(row.nextRunDate)}
                </BankMobileStackField>
              ) : null}
            </BankMobileStackRow>
          </button>
        ))}
      </BankMobileStack>

      <div className="hidden overflow-hidden rounded-xl border border-border md:block">
        <table className="alta-table w-full text-sm">
          <thead>
            <tr>
              <th>Payment</th>
              <th>Funding</th>
              <th>Amount</th>
              <th>Next</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="cursor-pointer hover:bg-surface-2/40"
                onClick={() => onOpen(row.id)}
              >
                <td className="min-w-0">
                  <p className="truncate font-medium">{row.title}</p>
                  <p className="text-[12px] text-muted-foreground">{row.paymentTypeLabel}</p>
                </td>
                <td className="min-w-0 truncate">{row.fundingLabel}</td>
                <td className="type-finance-md font-medium tabular">{florin(row.amount)}</td>
                <td className="text-muted-foreground">
                  {row.nextRunDate ? formatShortDate(row.nextRunDate) : "—"}
                </td>
                <td>
                  <StatusBadge status={row.statusLabel} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AutopayPanel({
  rows,
  onOpen,
}: {
  rows: MerchantAutopayApprovalRow[];
  onOpen: (id: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No AutoPay authorizations"
        description="Merchant AutoPay approvals will appear here when you authorize them."
        action={
          <Link to="/bank/pay/invoices" className="text-[13px] font-medium hover:underline">
            View invoices
          </Link>
        }
      />
    );
  }

  return (
    <div className="min-w-0 space-y-3">
      <BankMobileStack>
        {rows.map((row) => (
          <button key={row.id} type="button" className="w-full text-left" onClick={() => onOpen(row.id)}>
            <BankMobileStackRow>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-medium">{row.merchantName}</p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">
                    {row.fundingAccountLabel} · {row.allowedFrequencyLabel}
                  </p>
                </div>
                <StatusBadge status={row.statusLabel} />
              </div>
              <BankMobileStackField label="Max invoice">
                {florin(row.maxInvoiceAmount)}
              </BankMobileStackField>
            </BankMobileStackRow>
          </button>
        ))}
      </BankMobileStack>

      <div className="hidden overflow-hidden rounded-xl border border-border md:block">
        <table className="alta-table w-full text-sm">
          <thead>
            <tr>
              <th>Merchant</th>
              <th>Funding</th>
              <th>Limit</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="cursor-pointer hover:bg-surface-2/40"
                onClick={() => onOpen(row.id)}
              >
                <td className="min-w-0 truncate font-medium">{row.merchantName}</td>
                <td className="min-w-0 truncate">{row.fundingAccountLabel}</td>
                <td className="type-finance-md tabular">{florin(row.maxInvoiceAmount)}</td>
                <td>
                  <StatusBadge status={row.statusLabel} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface-1/50 px-4 py-10 text-center">
      <p className="text-[14px] font-medium">{title}</p>
      <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
