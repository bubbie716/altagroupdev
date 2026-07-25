"use client";

import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { SlidersHorizontal } from "lucide-react";
import { BankPageMeta } from "@/components/bank/bank-page-layout";
import { fetchUserBankTransactions } from "@/lib/bank/bank.functions";
import {
  formatBankTransactionTypeLabel,
  presentUserBankTransaction,
} from "@/lib/bank/transaction-display";
import { authBeforeLoad } from "@/lib/auth/guards";
import { cn } from "@/lib/utils";
import type { BankTransactionStatusCode, BankTransactionTypeCode } from "@/lib/bank/backend-types";

export const Route = createFileRoute("/bank/activity")({
  beforeLoad: authBeforeLoad,
  loader: async () => fetchUserBankTransactions({ data: 40 }),
  head: () => ({
    meta: [{ title: "Activity — Alta Bank" }],
  }),
  component: BankActivityPage,
});

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

const FILTERS_PANEL_ID = "bank-activity-filters";

const FIELD_CLASS =
  "mt-1 h-11 w-full rounded-md border border-border bg-surface-1 px-3 text-[15px] text-foreground transition-[border-color] focus-visible:border-gold/60 focus-visible:outline-none sm:h-10 sm:text-[13px]";
const LABEL_CLASS = "block text-[12px] font-medium text-muted-foreground";

function formatShortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function BankActivityPage() {
  const transactions = Route.useLoaderData();
  const [query, setQuery] = useState("");
  const [accountId, setAccountId] = useState("all");
  const [type, setType] = useState<"all" | BankTransactionTypeCode>("all");
  const [status, setStatus] = useState<"all" | BankTransactionStatusCode>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const accounts = useMemo(() => {
    const map = new Map<string, string>();
    for (const tx of transactions) map.set(tx.bankAccountId, tx.accountName);
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [transactions]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return transactions.filter((tx) => {
      if (accountId !== "all" && tx.bankAccountId !== accountId) return false;
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
  }, [transactions, query, accountId, type, status]);

  const activeFilterCount =
    (query.trim() ? 1 : 0) +
    (accountId === "all" ? 0 : 1) +
    (type === "all" ? 0 : 1) +
    (status === "all" ? 0 : 1);
  const hasFilters = activeFilterCount > 0;

  function clearFilters() {
    setQuery("");
    setAccountId("all");
    setType("all");
    setStatus("all");
  }

  return (
    <>
      <BankPageMeta
        eyebrow="Alta Bank"
        title="Activity"
        description="Search and filter recent transactions across accounts you can access."
      />

      {transactions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface-1/50 px-4 py-10 text-center">
          <p className="text-[14px] font-medium">No activity yet</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Deposits, withdrawals, and transfers will appear here.
          </p>
          <Link to="/bank" className="mt-4 inline-block text-[13px] font-medium hover:underline">
            Back to home
          </Link>
        </div>
      ) : (
        <>
          <section
            aria-label="Activity filters"
            className="mb-4 rounded-xl border border-border bg-surface-1/60 p-3 sm:p-4"
          >
            <div className="flex gap-2">
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search description, reference, or account"
                aria-label="Search activity"
                className="h-11 min-w-0 flex-1 rounded-md border border-border bg-surface-1 px-3 text-[15px] transition-[border-color] placeholder:text-muted-foreground/70 focus-visible:border-gold/60 focus-visible:outline-none sm:h-10 sm:text-[13px]"
              />
              <button
                type="button"
                onClick={() => setFiltersOpen((open) => !open)}
                aria-expanded={filtersOpen}
                aria-controls={FILTERS_PANEL_ID}
                className="inline-flex h-11 shrink-0 items-center gap-2 rounded-md border border-border bg-surface-1 px-3 text-[13px] font-medium transition-colors hover:bg-surface-2 sm:hidden"
              >
                <SlidersHorizontal className="size-4" aria-hidden />
                Filters
                {activeFilterCount > 0 ? (
                  <span className="rounded-full bg-surface-2 px-1.5 text-[11px] tabular-nums">
                    {activeFilterCount}
                  </span>
                ) : null}
              </button>
            </div>

            <div
              id={FILTERS_PANEL_ID}
              className={cn(
                "mt-3 gap-3 sm:grid sm:grid-cols-3",
                filtersOpen ? "grid" : "hidden",
              )}
            >
              <label className={LABEL_CLASS}>
                Account
                <select
                  className={FIELD_CLASS}
                  value={accountId}
                  onChange={(event) => setAccountId(event.target.value)}
                >
                  <option value="all">All accounts</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={LABEL_CLASS}>
                Type
                <select
                  className={FIELD_CLASS}
                  value={type}
                  onChange={(event) => setType(event.target.value as typeof type)}
                >
                  <option value="all">All types</option>
                  {TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {formatBankTransactionTypeLabel(option)}
                    </option>
                  ))}
                </select>
              </label>
              <label className={LABEL_CLASS}>
                Status
                <select
                  className={FIELD_CLASS}
                  value={status}
                  onChange={(event) => setStatus(event.target.value as typeof status)}
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

            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-[12px] text-muted-foreground" aria-live="polite">
                Showing {filtered.length} of {transactions.length}
              </p>
              {hasFilters ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="rounded-md px-2 py-1 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Clear filters
                </button>
              ) : null}
            </div>
          </section>

          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-surface-1/50 px-4 py-10 text-center">
              <p className="text-[14px] font-medium">No matching activity</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Try a different search or clear the filters.
              </p>
              <button
                type="button"
                onClick={clearFilters}
                className="mt-4 text-[13px] font-medium hover:underline"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface-1">
              {filtered.map((tx) => {
                const presented = presentUserBankTransaction(tx);
                return (
                  <li key={tx.id} className="flex items-start gap-3 px-4 py-3.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-medium">{tx.description}</p>
                      <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                        {formatShortDate(tx.createdAt)} · {tx.accountName} · {presented.typeLabel}
                      </p>
                      <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                        {tx.referenceCode}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p
                        className={cn(
                          "text-[14px] font-medium tabular-nums",
                          presented.amountClassName,
                        )}
                        aria-label={presented.accessibleAmount}
                      >
                        {presented.displayAmount}
                      </p>
                      {presented.showStatus ? (
                        <p
                          className={cn(
                            "mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em]",
                            presented.tone === "denied"
                              ? "text-destructive"
                              : "text-muted-foreground",
                          )}
                        >
                          {presented.statusLabel}
                        </p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </>
  );
}
