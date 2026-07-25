"use client";

import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowDownLeft, ArrowUpRight, CreditCard, Send } from "lucide-react";
import { MoveMoneyChooser } from "@/components/bank/move-money-chooser";
import { BankActionLauncher } from "@/components/bank/actions/bank-action-launcher";
import { florin } from "@/lib/bank/api";
import {
  buildBankHomeContextOptions,
  companiesFromAccounts,
  contextCanTransact,
  filterAccountsForContext,
  filterTransactionsForContext,
  maskAccountNumber,
  readStoredBankHomeContext,
  resolveInitialBankHomeContext,
  sumAvailableBalance,
  writeStoredBankHomeContext,
  type BankHomeContextId,
} from "@/lib/bank/bank-home-context";
import { presentUserBankTransaction } from "@/lib/bank/transaction-display";
import type {
  BankRequestInProgress,
  UserBankAccount,
  UserBankTransaction,
} from "@/lib/bank/backend-types";
import type { AltaCardRow } from "@/lib/bank/alta-card-types";
import { altaCardTierLabel } from "@/lib/bank/alta-card-types";
import type { AltaUser } from "@/lib/auth/types";
import { formatAltaUserDisplayName } from "@/lib/auth/user-display";
import { useCurrentUser } from "@/hooks/use-current-user";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type BankHomeDashboardData = {
  accounts: UserBankAccount[];
  transactions: UserBankTransaction[];
  pendingRequests: BankRequestInProgress[];
  personalCard: AltaCardRow | null;
  companyCards: AltaCardRow[];
};

function formatShortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatGreetingName(user: AltaUser | null): string {
  return (user ? formatAltaUserDisplayName(user) : "") || "there";
}

function isNonstandardStatus(status: string): boolean {
  return status !== "active";
}

/** Deposit and withdrawal requests share one shape; the reference prefix tells them apart. */
function isWithdrawalRequest(request: BankRequestInProgress): boolean {
  return request.referenceCode?.trim().toUpperCase().startsWith("WDR") ?? false;
}

type BankHomeNoticeTone = "pending" | "warning" | "error";

type BankHomeNotice = {
  id: string;
  title: string;
  detail: string;
  tone: BankHomeNoticeTone;
} & (
  | { target: "deposit" | "withdraw" | "activity" }
  | { target: "account"; accountId: string }
);

const NOTICE_TONE_LABELS: Record<BankHomeNoticeTone, string> = {
  pending: "Pending",
  warning: "Needs attention",
  error: "Action required",
};

function noticeClassName(tone: BankHomeNoticeTone): string {
  return cn(
    "block rounded-xl border bg-surface-1 px-4 py-3 transition-colors hover:border-border-strong hover:bg-[var(--menu-item-hover)]",
    tone === "error" ? "border-destructive/40" : tone === "warning" ? "border-amber-700/30" : "border-border",
  );
}

function NoticeCard({ notice }: { notice: BankHomeNotice }) {
  const body = (
    <>
      <p className="text-[14px] font-medium text-foreground">
        <span className="sr-only">{NOTICE_TONE_LABELS[notice.tone]}. </span>
        {notice.title}
      </p>
      <p className="mt-0.5 text-[13px] text-muted-foreground">{notice.detail}</p>
    </>
  );
  const className = noticeClassName(notice.tone);

  if (notice.target === "account") {
    return (
      <Link to="/bank/account/$accountId" params={{ accountId: notice.accountId }} className={className}>
        {body}
      </Link>
    );
  }
  if (notice.target === "withdraw") {
    return (
      <Link to="/bank/withdraw" className={className}>
        {body}
      </Link>
    );
  }
  if (notice.target === "deposit") {
    return (
      <Link to="/bank/deposit" className={className}>
        {body}
      </Link>
    );
  }
  return (
    <Link to="/bank/activity" className={className}>
      {body}
    </Link>
  );
}

export function BankHomeDashboard({ data }: { data: BankHomeDashboardData }) {
  const user = useCurrentUser();
  const companies = useMemo(() => companiesFromAccounts(data.accounts), [data.accounts]);
  const options = useMemo(() => buildBankHomeContextOptions(companies), [companies]);

  const [contextId, setContextId] = useState<BankHomeContextId>("personal");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setHydrated(true);
      return;
    }
    const stored = readStoredBankHomeContext(user.id);
    setContextId(resolveInitialBankHomeContext(stored, options));
    setHydrated(true);
  }, [user?.id, options]);

  function onContextChange(next: BankHomeContextId) {
    setContextId(next);
    if (user?.id) writeStoredBankHomeContext(user.id, next);
  }

  const scopedAccounts = useMemo(
    () => filterAccountsForContext(data.accounts, contextId),
    [data.accounts, contextId],
  );
  const scopedTransactions = useMemo(
    () => filterTransactionsForContext(data.transactions, scopedAccounts).slice(0, 5),
    [data.transactions, scopedAccounts],
  );
  const available = sumAvailableBalance(scopedAccounts);
  const canTransact = contextCanTransact(scopedAccounts);
  const preferredAccountId =
    scopedAccounts.find((account) => account.status === "active")?.id ?? scopedAccounts[0]?.id;
  const actionCompanyId =
    contextId.startsWith("company:") ? contextId.slice("company:".length) : undefined;
  const actionScope =
    contextId === "personal" ? ("personal" as const) : contextId === "all" ? ("all" as const) : undefined;

  const scopedPending = useMemo(() => {
    const ids = new Set(scopedAccounts.map((a) => a.id));
    return data.pendingRequests.filter((r) => ids.has(r.bankAccountId));
  }, [data.pendingRequests, scopedAccounts]);

  const card = useMemo(() => {
    if (contextId === "personal" || contextId === "all") return data.personalCard;
    const companyId = contextId.slice("company:".length);
    return data.companyCards.find((c) => c.companyId === companyId) ?? null;
  }, [contextId, data.personalCard, data.companyCards]);

  const notices = useMemo(() => {
    const items: BankHomeNotice[] = [];
    for (const req of scopedPending.slice(0, 3)) {
      const kind = isWithdrawalRequest(req) ? "withdrawal" : "deposit";
      items.push({
        id: req.id,
        title: req.status === "pending" ? `Pending ${kind}` : `${req.statusLabel} ${kind}`,
        detail: `${req.accountName} · ${florin(req.amount)}`,
        target: kind === "withdrawal" ? "withdraw" : "deposit",
        tone: req.status === "denied" ? "error" : "pending",
      });
    }
    for (const account of scopedAccounts) {
      if (account.status === "frozen" || account.status === "pending") {
        items.push({
          id: `status-${account.id}`,
          title: `${account.accountName} is ${account.statusLabel.toLowerCase()}`,
          detail: "Some actions may be unavailable.",
          target: "account",
          accountId: account.id,
          tone: account.status === "frozen" ? "error" : "warning",
        });
      }
    }
    for (const tx of scopedTransactions) {
      if (tx.status === "denied") {
        items.push({
          id: `tx-${tx.id}`,
          title: "Transaction needs attention",
          detail: tx.description,
          target: "activity",
          tone: "error",
        });
      }
    }
    return items.slice(0, 4);
  }, [scopedPending, scopedAccounts, scopedTransactions]);

  const greeting = `Hi, ${formatGreetingName(user)}`;

  if (!hydrated) {
    return <BankHomeDashboardSkeleton />;
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-muted-foreground">{greeting}</p>
            <p className="mt-1 text-[12px] text-muted-foreground">Available balance</p>
            <p className="mt-1 font-serif text-[2.15rem] font-medium tracking-tight tabular-nums sm:text-[2.5rem]">
              {florin(available)}
            </p>
            {scopedPending.length > 0 ? (
              <p className="mt-2 text-[13px] text-muted-foreground">
                {scopedPending.length} pending action{scopedPending.length === 1 ? "" : "s"}
              </p>
            ) : null}
          </div>
          <div className="w-full sm:w-56">
            <label className="sr-only" htmlFor="bank-home-context">
              Account context
            </label>
            <Select
              value={contextId}
              onValueChange={(value) => onContextChange(value as BankHomeContextId)}
            >
              <SelectTrigger id="bank-home-context" className="h-11 w-full bg-surface-1">
                <SelectValue placeholder="Personal" />
              </SelectTrigger>
              <SelectContent className="bg-[var(--menu-surface)]">
                {options.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MoveMoneyChooser
            disabled={!canTransact}
            accountId={preferredAccountId}
            companyId={actionCompanyId}
            scope={actionScope}
            triggerClassName="h-12 w-full justify-center"
          >
            <ArrowUpRight className="size-4" aria-hidden />
            Move money
          </MoveMoneyChooser>
          <BankActionLauncher
            action="deposit"
            accountId={preferredAccountId}
            companyId={actionCompanyId}
            scope={actionScope}
            disabled={!canTransact}
            variant="outline"
            className="h-12 w-full justify-center gap-2"
          >
            <ArrowDownLeft className="size-4" aria-hidden />
            Deposit
          </BankActionLauncher>
          <BankActionLauncher
            action="withdraw"
            accountId={preferredAccountId}
            companyId={actionCompanyId}
            scope={actionScope}
            disabled={!canTransact}
            variant="outline"
            className="h-12 w-full justify-center gap-2"
          >
            <ArrowUpRight className="size-4" aria-hidden />
            Withdraw
          </BankActionLauncher>
          <BankActionLauncher
            action="pay"
            accountId={preferredAccountId}
            companyId={actionCompanyId}
            scope={actionScope}
            disabled={!canTransact}
            variant="outline"
            className="h-12 w-full justify-center gap-2"
          >
            <Send className="size-4" aria-hidden />
            Pay
          </BankActionLauncher>
        </div>
        {!canTransact && scopedAccounts.length > 0 ? (
          <p className="text-[13px] text-muted-foreground">
            This context can be viewed, but transfers are currently restricted.
          </p>
        ) : null}
      </section>

      {notices.length > 0 ? (
        <section className="space-y-2" aria-label="Notices">
          {notices.map((notice) => (
            <NoticeCard key={notice.id} notice={notice} />
          ))}
        </section>
      ) : null}

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <h2 className="text-[15px] font-semibold tracking-tight">Accounts</h2>
          <div className="flex items-center gap-3 text-[13px]">
            <Link to="/bank/accounts" className="text-muted-foreground hover:text-foreground">
              View all
            </Link>
            <BankActionLauncher
              action="open-account"
              variant="ghost"
              className="h-auto px-0 font-medium text-foreground hover:underline"
            >
              Open an account
            </BankActionLauncher>
          </div>
        </div>
        {scopedAccounts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface-1/50 px-4 py-8 text-center">
            <p className="text-[14px] font-medium">No accounts in this context</p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Open an account or switch context to continue.
            </p>
            <BankActionLauncher action="open-account" className="mt-4">
              Open an account
            </BankActionLauncher>
          </div>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface-1">
            {scopedAccounts.slice(0, 6).map((account) => (
              <li key={account.id}>
                <Link
                  to="/bank/account/$accountId"
                  params={{ accountId: account.id }}
                  className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-[var(--menu-item-hover)]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium">{account.accountName}</p>
                    <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                      {account.accountTypeLabel} · {maskAccountNumber(account.accountNumber)}
                      {isNonstandardStatus(account.status) ? ` · ${account.statusLabel}` : null}
                    </p>
                  </div>
                  <p className="shrink-0 text-[14px] font-medium tabular-nums">
                    {florin(account.availableBalance)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {card ? (
        <section>
          <div className="mb-3 flex items-end justify-between">
            <h2 className="text-[15px] font-semibold tracking-tight">Alta Card</h2>
          </div>
          <div className="rounded-xl border border-border bg-surface-1 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-surface-2">
                <CreditCard className="size-4 text-muted-foreground" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium">
                  {altaCardTierLabel(card.tier)} · •••• {card.cardLastFour}
                </p>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  Balance {florin(card.currentBalance)} · Available {florin(card.availableCredit)}
                </p>
                {card.paymentDueDate ? (
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    Payment due {formatShortDate(card.paymentDueDate)}
                    {card.minimumPaymentDue > 0 ? ` · Min ${florin(card.minimumPaymentDue)}` : null}
                  </p>
                ) : null}
              </div>
              <Button asChild variant="outline" size="sm" className="h-10 shrink-0">
                {card.cardType === "business" && card.companyId ? (
                  <Link
                    to="/bank/alta-card/business/$companyId"
                    params={{ companyId: card.companyId }}
                  >
                    View card
                  </Link>
                ) : (
                  <Link to="/bank/alta-card">View card</Link>
                )}
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <h2 className="text-[15px] font-semibold tracking-tight">Recent activity</h2>
          <Link to="/bank/activity" className="text-[13px] text-muted-foreground hover:text-foreground">
            View all activity
          </Link>
        </div>
        {scopedTransactions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface-1/50 px-4 py-8 text-center text-[13px] text-muted-foreground">
            No recent activity in this context.
          </div>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface-1">
            {scopedTransactions.map((tx) => {
              const presented = presentUserBankTransaction(tx);
              return (
                <li key={tx.id} className="flex items-start gap-3 px-4 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium">{tx.description}</p>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">
                      {formatShortDate(tx.createdAt)} · {tx.accountName}
                      {presented.showStatus ? ` · ${presented.statusLabel}` : null}
                    </p>
                  </div>
                  <p
                    className={cn(
                      "shrink-0 text-[14px] font-medium tabular-nums",
                      presented.amountClassName,
                    )}
                    aria-label={presented.accessibleAmount}
                  >
                    {presented.displayAmount}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

export function BankHomeDashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-8" aria-hidden>
      <div className="space-y-3">
        <div className="h-4 w-28 rounded bg-surface-2" />
        <div className="h-10 w-48 rounded bg-surface-2" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 rounded-md bg-surface-2" />
          ))}
        </div>
      </div>
      <div className="h-40 rounded-xl bg-surface-2" />
      <div className="h-48 rounded-xl bg-surface-2" />
    </div>
  );
}

export function BankHomeDashboardError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-border bg-surface-1 px-5 py-10 text-center">
      <p className="text-[15px] font-semibold">Couldn’t load your dashboard</p>
      <p className="mt-2 text-[13px] text-muted-foreground">
        Check your connection and try again.
      </p>
      <Button type="button" className="mt-5" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
