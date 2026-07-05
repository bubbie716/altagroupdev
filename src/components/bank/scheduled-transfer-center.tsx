"use client";

import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { Card } from "@/components/page-shell";
import { florin } from "@/lib/bank/api";
import type { TransferContact } from "@/lib/bank/backend-types";
import type {
  CreateUserScheduledTransferInput,
  PaymentFrequencyCode,
  ScheduledPaymentRow,
  ScheduledPaymentTypeCode,
  ScheduledTransferScopeCode,
} from "@/lib/bank/business-banking-types";
import { formatCustomerActionError } from "@/lib/bank/bank-action-errors";
import { formatActivityDateTime } from "@/lib/format-datetime";
import { DEFAULT_SCHEDULED_TIME_ET } from "@/lib/scheduled-datetime";
import { TransferContactPicker } from "@/components/bank/bank-transfer-contacts-manager";
import { BankAccountActivityLink } from "@/components/bank/bank-account-activity-link";
import {
  BankMobileStack,
  BankMobileStackField,
  BankMobileStackRow,
  BankTableScroll,
} from "@/components/bank/bank-scroll-contain";
import { Textarea } from "@/components/ui/textarea";

const fieldClass =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold/40";

export interface ScheduledTransferSourceAccount {
  id: string;
  accountName: string;
  accountNumber: string;
  ownerLabel?: string | null;
}

type Tab = "scheduled" | "recurring" | "history";

export type ScheduledTransferTab = Tab;

function isActiveQueuePayment(payment: ScheduledPaymentRow): boolean {
  return payment.status !== "executed" && payment.status !== "cancelled";
}

function isHistoryPayment(payment: ScheduledPaymentRow): boolean {
  return (
    payment.status === "executed" ||
    payment.status === "cancelled" ||
    payment.status === "failed" ||
    payment.status === "rejected"
  );
}

export function ScheduledTransferCenter({
  transferScope,
  sourceAccounts,
  payments,
  contacts = [],
  destinationAccounts,
  canManage,
  viewOnlyMessage = "You do not have permission to submit transfers.",
  onCreate,
  onCancel,
  showScopeColumn = false,
  defaultSourceAccountId,
  activeTab,
  onTabChange,
}: {
  transferScope: ScheduledTransferScopeCode;
  sourceAccounts: ScheduledTransferSourceAccount[];
  payments: ScheduledPaymentRow[];
  contacts?: TransferContact[];
  /** When set, intrabank scheduling is limited to these owned destination accounts. */
  destinationAccounts?: ScheduledTransferSourceAccount[];
  canManage: boolean;
  viewOnlyMessage?: string;
  onCreate: (input: Omit<CreateUserScheduledTransferInput, "transferScope">) => Promise<void>;
  onCancel: (paymentId: string) => Promise<void>;
  showScopeColumn?: boolean;
  defaultSourceAccountId?: string;
  activeTab?: Tab;
  onTabChange?: (tab: Tab) => void;
}) {
  const [internalTab, setInternalTab] = useState<Tab>("scheduled");
  const tab = activeTab ?? internalTab;

  function selectTab(next: Tab) {
    if (onTabChange) onTabChange(next);
    else setInternalTab(next);
  }

  const scheduled = payments.filter(
    (p) =>
      isActiveQueuePayment(p) && (p.paymentType === "scheduled" || p.paymentType === "one_time"),
  );
  const recurring = payments.filter(
    (p) => isActiveQueuePayment(p) && p.paymentType === "recurring",
  );
  const history = payments.filter(isHistoryPayment);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-1">
        {(
          [
            ["scheduled", "Scheduled"],
            ["recurring", "Recurring"],
            ["history", "History"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => selectTab(id)}
            className={`rounded-md px-3 py-1.5 text-[12px] tracking-wide transition-colors ${
              tab === id
                ? "bg-surface-2 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "history" ? (
        <Card className="!p-6">
          <div className="type-meta">
            Transfer history
          </div>
          <TransferHistoryTable
            payments={history}
            sourceAccounts={sourceAccounts}
            canManage={canManage}
            onCancel={onCancel}
            showScopeColumn={showScopeColumn}
            emptyMessage="history"
          />
        </Card>
      ) : (
        <div className="grid gap-8 lg:grid-cols-2">
          {canManage ? (
            <Card className="!p-6">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">
                New {tab} transfer
              </div>
              <ScheduledTransferForm
                transferScope={transferScope}
                paymentType={tab}
                sourceAccounts={sourceAccounts}
                contacts={contacts}
                destinationAccounts={destinationAccounts}
                defaultSourceAccountId={defaultSourceAccountId}
                onCreate={onCreate}
              />
            </Card>
          ) : (
            <Card className="!p-6">
              <p className="text-[13px] text-muted-foreground">{viewOnlyMessage}</p>
            </Card>
          )}
          <Card className="!p-6">
            <div className="type-meta">
              {tab.charAt(0).toUpperCase() + tab.slice(1)} queue
            </div>
            <TransferHistoryTable
              payments={tab === "scheduled" ? scheduled : recurring}
              sourceAccounts={sourceAccounts}
              canManage={canManage}
              onCancel={onCancel}
              compact
              showScopeColumn={showScopeColumn}
            />
          </Card>
        </div>
      )}
    </div>
  );
}

function ScheduledTransferForm({
  transferScope,
  paymentType,
  sourceAccounts,
  contacts,
  destinationAccounts,
  defaultSourceAccountId,
  onCreate,
}: {
  transferScope: ScheduledTransferScopeCode;
  paymentType: ScheduledPaymentTypeCode;
  sourceAccounts: ScheduledTransferSourceAccount[];
  contacts: TransferContact[];
  destinationAccounts?: ScheduledTransferSourceAccount[];
  defaultSourceAccountId?: string;
  onCreate: (input: Omit<CreateUserScheduledTransferInput, "transferScope">) => Promise<void>;
}) {
  const router = useRouter();
  const ownAccountsOnly = transferScope === "intrabank" && destinationAccounts != null;
  const defaultAccountId =
    defaultSourceAccountId && sourceAccounts.some((account) => account.id === defaultSourceAccountId)
      ? defaultSourceAccountId
      : (sourceAccounts[0]?.id ?? "");
  const [bankAccountId, setBankAccountId] = useState(defaultAccountId);
  const [destinationAccountId, setDestinationAccountId] = useState(
    () => destinationAccounts?.find((account) => account.id !== defaultAccountId)?.id ?? "",
  );
  const [recipientName, setRecipientName] = useState("");
  const [recipientAccountNumber, setRecipientAccountNumber] = useState("");
  const [recipientInstitution, setRecipientInstitution] = useState("");
  const [routingNumber, setRoutingNumber] = useState("");
  const [wireAccountNumber, setWireAccountNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState(DEFAULT_SCHEDULED_TIME_ET);
  const [frequency, setFrequency] = useState<PaymentFrequencyCode>("monthly");
  const [memo, setMemo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const availableDestinations = ownAccountsOnly
    ? (destinationAccounts ?? []).filter((account) => account.id !== bankAccountId)
    : [];

  function selectContact(contact: TransferContact) {
    if (ownAccountsOnly) return;
    if (transferScope === "intrabank") {
      if (contact.accountNumber) setRecipientAccountNumber(contact.accountNumber);
      setRecipientName(contact.recipientName ?? contact.label ?? "");
    } else {
      setRecipientName(contact.recipientName ?? contact.label ?? "");
      setRecipientInstitution(contact.recipientInstitution ?? "");
      setRoutingNumber(contact.routingNumber ?? "");
      setWireAccountNumber(contact.wireAccountNumber ?? "");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const destination = ownAccountsOnly
        ? availableDestinations.find((account) => account.id === destinationAccountId)
        : null;

      await onCreate({
        bankAccountId,
        paymentType,
        recipientName: ownAccountsOnly
          ? (destination?.accountName ?? "")
          : recipientName,
        recipientAccountNumber: ownAccountsOnly
          ? (destination?.accountNumber ?? undefined)
          : recipientAccountNumber || undefined,
        recipientInstitution: recipientInstitution || undefined,
        routingNumber: routingNumber || undefined,
        wireAccountNumber: wireAccountNumber || undefined,
        amount: Number(amount),
        scheduledDate: scheduledDate || undefined,
        scheduledTime: scheduledTime || undefined,
        frequency: paymentType === "recurring" ? frequency : undefined,
        memo: memo || undefined,
      });
      await router.invalidate();
      setRecipientName("");
      setRecipientAccountNumber("");
      setDestinationAccountId(availableDestinations[0]?.id ?? "");
      setRecipientInstitution("");
      setRoutingNumber("");
      setWireAccountNumber("");
      setAmount("");
      setScheduledDate("");
      setScheduledTime(DEFAULT_SCHEDULED_TIME_ET);
      setMemo("");
    } catch (err) {
      setError(formatCustomerActionError(err, "scheduled_transfer"));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      {sourceAccounts.length > 1 && (
        <label className="block text-sm">
          Transfer from
          <select
            className={fieldClass}
            value={bankAccountId}
            onChange={(e) => {
              setBankAccountId(e.target.value);
              if (ownAccountsOnly && e.target.value === destinationAccountId) {
                const next = availableDestinations.find((account) => account.id !== e.target.value);
                setDestinationAccountId(next?.id ?? "");
              }
            }}
            required
          >
            {sourceAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.accountName}
                {account.ownerLabel ? ` · ${account.ownerLabel}` : ""} ({account.accountNumber})
              </option>
            ))}
          </select>
        </label>
      )}

      {!ownAccountsOnly ? (
        <TransferContactPicker contacts={contacts} scope={transferScope} onSelect={selectContact} />
      ) : null}

      {transferScope === "intrabank" ? (
        ownAccountsOnly ? (
          <label className="block text-sm">
            Transfer to
            <select
              className={fieldClass}
              value={destinationAccountId}
              onChange={(e) => setDestinationAccountId(e.target.value)}
              required
            >
              {availableDestinations.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.accountName}
                  {account.ownerLabel ? ` · ${account.ownerLabel}` : ""} ({account.accountNumber})
                </option>
              ))}
            </select>
          </label>
        ) : (
        <>
          <label className="block text-sm">
            Recipient Alta account
            <input
              className={fieldClass}
              value={recipientAccountNumber}
              onChange={(e) => setRecipientAccountNumber(e.target.value)}
              placeholder="AB-5000-000000"
              required
            />
          </label>
          <label className="block text-sm">
            Recipient name
            <input
              className={fieldClass}
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              required
            />
          </label>
        </>
        )
      ) : (
        <>
          <label className="block text-sm">
            Recipient institution
            <input
              className={fieldClass}
              value={recipientInstitution}
              onChange={(e) => setRecipientInstitution(e.target.value)}
              required
            />
          </label>
          <label className="block text-sm">
            Recipient name
            <input
              className={fieldClass}
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              required
            />
          </label>
          <label className="block text-sm">
            Routing number
            <input
              className={fieldClass}
              value={routingNumber}
              onChange={(e) => setRoutingNumber(e.target.value)}
              required
            />
          </label>
          <label className="block text-sm">
            Wire account number
            <input
              className={fieldClass}
              value={wireAccountNumber}
              onChange={(e) => setWireAccountNumber(e.target.value)}
              required
            />
          </label>
        </>
      )}

      <label className="block text-sm">
        Amount (FLR)
        <input
          className={fieldClass}
          type="number"
          min="0.01"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
      </label>

      {paymentType !== "recurring" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            Scheduled date
            <input
              className={fieldClass}
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              required
            />
          </label>
          <label className="block text-sm">
            Time (Eastern)
            <input
              className={fieldClass}
              type="time"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              required
            />
          </label>
        </div>
      )}

      {paymentType === "recurring" && (
        <>
          <label className="block text-sm">
            Frequency
            <select
              className={fieldClass}
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as PaymentFrequencyCode)}
            >
              <option value="weekly">Weekly</option>
              <option value="biweekly">Biweekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
            </select>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              First run date
              <input
                className={fieldClass}
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                required
              />
            </label>
            <label className="block text-sm">
              Time (Eastern)
              <input
                className={fieldClass}
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                required
              />
            </label>
          </div>
          <p className="text-[12px] text-muted-foreground">
            Recurring transfers repeat at the same Eastern Time on each scheduled interval.
          </p>
        </>
      )}

      <label className="block text-sm">
        Memo (optional)
        <Textarea
          className={`${fieldClass} min-h-[4rem]`}
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
        />
      </label>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <button
        type="submit"
        disabled={pending || !bankAccountId || (ownAccountsOnly && !destinationAccountId)}
        className="rounded-md border border-border-strong bg-surface-2 px-4 py-2 text-sm font-medium transition-colors hover:bg-surface-2/80 disabled:opacity-50"
      >
        {pending
          ? "Submitting…"
          : transferScope === "intrabank"
            ? "Schedule transfer"
            : "Submit for review"}
      </button>
    </form>
  );
}

function formatRunAt(value: string | null): string {
  if (!value) return "—";
  return formatActivityDateTime(value);
}

function paymentNextRun(p: ScheduledPaymentRow): string | null {
  if (p.paymentType === "recurring") return p.nextRunDate;
  return p.scheduledDate;
}

function lookupSourceAccount(
  payment: ScheduledPaymentRow,
  sourceAccounts: ScheduledTransferSourceAccount[],
): ScheduledTransferSourceAccount | null {
  if (!payment.bankAccountId) return null;
  return sourceAccounts.find((account) => account.id === payment.bankAccountId) ?? null;
}

function TransferHistoryTable({
  payments,
  sourceAccounts,
  canManage,
  onCancel,
  compact = false,
  showScopeColumn = false,
  emptyMessage = "queue",
}: {
  payments: ScheduledPaymentRow[];
  sourceAccounts: ScheduledTransferSourceAccount[];
  canManage: boolean;
  onCancel: (paymentId: string) => Promise<void>;
  compact?: boolean;
  showScopeColumn?: boolean;
  emptyMessage?: "queue" | "history";
}) {
  const router = useRouter();
  const showSourceAccount = sourceAccounts.length > 1;

  if (payments.length === 0) {
    return (
      <p className={`${compact ? "mt-4" : "mt-6"} text-[13px] text-muted-foreground`}>
        {emptyMessage === "history"
          ? "No completed or cancelled transfers yet."
          : "No transfers in this queue yet."}
      </p>
    );
  }

  return (
    <div className={`${compact ? "mt-4" : "mt-6"} min-w-0 overflow-hidden`}>
      <BankMobileStack>
        {payments.map((p) => {
          const sourceAccount = lookupSourceAccount(p, sourceAccounts);
          return (
            <BankMobileStackRow key={p.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium break-words">{p.recipientName}</p>
                  {!compact && <p className="mt-0.5 text-[12px] text-muted-foreground">{p.paymentTypeLabel}</p>}
                </div>
                <span className="tabular-nums shrink-0 font-medium">{florin(p.amount)}</span>
              </div>
              {showSourceAccount && sourceAccount ? (
                <BankMobileStackField label="From account">
                  <BankAccountActivityLink
                    accountId={sourceAccount.id}
                    accountName={sourceAccount.accountName}
                    accountNumber={sourceAccount.accountNumber}
                  />
                </BankMobileStackField>
              ) : null}
              <BankMobileStackField label="Status">{p.statusLabel}</BankMobileStackField>
              <BankMobileStackField label="Scheduled">{formatRunAt(paymentNextRun(p))}</BankMobileStackField>
              {p.memo?.trim() ? (
                <BankMobileStackField label="Memo">{p.memo.trim()}</BankMobileStackField>
              ) : null}
              {compact && canManage &&
                (p.status === "pending_review" || p.status === "approved" || p.status === "paused") ? (
                <button
                  type="button"
                  onClick={async () => {
                    await onCancel(p.id);
                    await router.invalidate();
                  }}
                  className="mt-1 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-destructive"
                >
                  Cancel
                </button>
              ) : null}
            </BankMobileStackRow>
          );
        })}
      </BankMobileStack>

      <BankTableScroll>
      <table className={`alta-table w-full text-sm ${compact ? "min-w-0" : "min-w-[640px]"}`}>
        <thead>
          <tr>
            {showSourceAccount ? <th>From account</th> : null}
            <th>Recipient</th>
            <th>Amount</th>
            {compact && <th>Scheduled</th>}
            {compact && <th>Memo</th>}
            {!compact && <th>Type</th>}
            {showScopeColumn && !compact && <th>Scope</th>}
            <th>Status</th>
            {!compact && <th>Scheduled</th>}
            {!compact && <th>Last run</th>}
            {!compact && <th>Last result</th>}
            {!compact && <th>Memo</th>}
            {canManage && !compact && <th className="w-[1%] whitespace-nowrap" />}
          </tr>
        </thead>
        <tbody>
          {payments.map((p) => {
            const sourceAccount = lookupSourceAccount(p, sourceAccounts);

            return (
            <tr key={p.id}>
              {showSourceAccount ? (
                <td>
                  {sourceAccount ? (
                    <BankAccountActivityLink
                      accountId={sourceAccount.id}
                      accountName={sourceAccount.accountName}
                      accountNumber={sourceAccount.accountNumber}
                    />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              ) : null}
              <td>{p.recipientName}</td>
              <td className="tabular-nums">{florin(p.amount)}</td>
              {compact && (
                <td className="max-w-[120px] text-[12px] leading-snug">{formatRunAt(paymentNextRun(p))}</td>
              )}
              {compact && (
                <td className="max-w-[160px] truncate text-[12px] text-muted-foreground" title={p.memo ?? undefined}>
                  {p.memo?.trim() || "—"}
                </td>
              )}
              {!compact && <td>{p.paymentTypeLabel}</td>}
              {showScopeColumn && !compact && <td>{p.transferScopeLabel}</td>}
              <td>
                <div>{p.statusLabel}</div>
                {p.lastFailureReason ? (
                  <div className="mt-0.5 text-[11px] text-muted-foreground">{p.lastFailureReason}</div>
                ) : null}
                {compact && canManage &&
                (p.status === "pending_review" || p.status === "approved" || p.status === "paused") ? (
                  <button
                    type="button"
                    className="mt-1 rounded border border-destructive/30 bg-destructive/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-destructive"
                    onClick={async () => {
                      await onCancel(p.id);
                      await router.invalidate();
                    }}
                  >
                    Cancel
                  </button>
                ) : null}
              </td>
              {!compact && <td className="whitespace-nowrap text-[12px]">{formatRunAt(paymentNextRun(p))}</td>}
              {!compact && <td className="text-[12px]">{formatRunAt(p.lastRunAt)}</td>}
              {!compact && (
                <td className="text-[12px]">
                  {p.lastExecutionStatusLabel ?? "—"}
                </td>
              )}
              {!compact && (
                <td className="max-w-[200px] truncate text-[12px] text-muted-foreground" title={p.memo ?? undefined}>
                  {p.memo?.trim() || "—"}
                </td>
              )}
              {canManage && !compact && (
                <td className="w-[1%] whitespace-nowrap">
                  {p.status === "pending_review" || p.status === "approved" || p.status === "paused" ? (
                    <button
                      type="button"
                      className="rounded border border-destructive/30 bg-destructive/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-destructive"
                      onClick={async () => {
                        await onCancel(p.id);
                        await router.invalidate();
                      }}
                    >
                      Cancel
                    </button>
                  ) : null}
                </td>
              )}
            </tr>
            );
          })}
        </tbody>
      </table>
      </BankTableScroll>
    </div>
  );
}
