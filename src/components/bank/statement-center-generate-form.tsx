"use client";

import { useMemo, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { generateAccountStatementsBatch } from "@/lib/bank/statement.functions";
import type { StatementGeneratableAccount } from "@/lib/bank/statement-types";
import { formatCustomerActionError } from "@/lib/bank/bank-action-errors";

const fieldClass =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold/40";

export function StatementCenterGenerateForm({
  accounts,
  defaultPeriod,
}: {
  accounts: StatementGeneratableAccount[];
  defaultPeriod?: { periodStart: string; periodEnd: string };
}) {
  const router = useRouter();
  const generate = useServerFn(generateAccountStatementsBatch);
  const [periodStart, setPeriodStart] = useState(defaultPeriod?.periodStart ?? "");
  const [periodEnd, setPeriodEnd] = useState(defaultPeriod?.periodEnd ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allAccounts, setAllAccounts] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const selectionLabel = useMemo(() => {
    if (accounts.length === 0) return "No eligible accounts";
    if (allAccounts) return `All accounts (${accounts.length})`;
    if (selected.size === 0) return "Select accounts";
    if (selected.size === 1) {
      const account = accounts.find((a) => a.id === [...selected][0]);
      return account ? `${account.accountName} · ${account.accountNumber}` : "1 account";
    }
    return `${selected.size} accounts selected`;
  }, [accounts, allAccounts, selected]);

  function toggleAccount(id: string) {
    setAllAccounts(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllAccounts(checked: boolean) {
    setAllAccounts(checked);
    if (checked) {
      setSelected(new Set(accounts.map((a) => a.id)));
    } else {
      setSelected(new Set());
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!allAccounts && selected.size === 0) {
      setError("Select at least one account or choose all accounts.");
      return;
    }

    setPending(true);
    try {
      const batch = await generate({
        data: {
          periodStart,
          periodEnd,
          allAccounts,
          accountIds: allAccounts ? undefined : [...selected],
        },
      });

      await router.invalidate();

      if (!allAccounts && selected.size === 1 && batch.statements.length === 1 && batch.errors.length === 0) {
        await router.navigate({
          to: "/bank/statements/$statementId",
          params: { statementId: batch.statements[0]!.id },
          search: { from: "center" },
        });
        return;
      }

      const parts = [
        `Created ${batch.created} statement(s)`,
        batch.skipped > 0 ? `skipped ${batch.skipped} existing` : null,
        batch.errors.length > 0 ? `${batch.errors.length} error(s)` : null,
      ].filter(Boolean);
      setResult(parts.join(", ") + ".");
      if (batch.errors.length > 0) {
        setError(batch.errors.map((e) => `${e.label}: ${e.message}`).join(" · "));
      }
    } catch (err) {
      const message =
        err instanceof Error && err.message === "FORBIDDEN"
          ? "You do not have permission to generate statements."
          : formatCustomerActionError(err, "statement_generate");
      setError(message);
    } finally {
      setPending(false);
    }
  }

  if (accounts.length === 0) {
    return (
      <p className="text-[13px] text-muted-foreground">
        No active accounts are available for statement generation on your profile.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        Generate statements from approved transactions in the selected period. Opening balances are
        estimated from available transaction history.
      </p>

      <label className="block text-sm">
        Accounts
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={`${fieldClass} flex items-center justify-between text-left`}
              aria-haspopup="listbox"
            >
              <span className="truncate">{selectionLabel}</span>
              <ChevronDown className="size-4 shrink-0 opacity-50" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-2" align="start">
            <div className="max-h-64 space-y-1 overflow-y-auto" role="listbox" aria-multiselectable="true">
              <label className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-2 text-sm hover:bg-surface-2/60">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={allAccounts}
                  onChange={(e) => toggleAllAccounts(e.target.checked)}
                />
                <span>
                  <span className="font-medium">All accounts</span>
                  <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">
                    {accounts.length} eligible account{accounts.length === 1 ? "" : "s"}
                  </span>
                </span>
              </label>
              <div className="my-1 border-t border-border/60" />
              {accounts.map((account) => (
                <label
                  key={account.id}
                  className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-2 text-sm hover:bg-surface-2/60"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={allAccounts || selected.has(account.id)}
                    disabled={allAccounts}
                    onChange={() => toggleAccount(account.id)}
                  />
                  <span className="min-w-0">
                    <span className="block truncate">{account.accountName}</span>
                    <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">
                      {account.accountNumber}
                      {account.companyName ? ` · ${account.companyName}` : ""}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          Period start
          <input
            className={fieldClass}
            type="date"
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
            required
          />
        </label>
        <label className="block text-sm">
          Period end
          <input
            className={fieldClass}
            type="date"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
            required
          />
        </label>
      </div>

      {result && <p className="text-sm text-muted-foreground">{result}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <button
        type="submit"
        disabled={pending || (!allAccounts && selected.size === 0)}
        className="rounded-md border border-border-strong bg-surface-2 px-4 py-2 text-sm font-medium transition-colors hover:bg-surface-2/80 disabled:opacity-50"
      >
        {pending ? "Generating…" : "Generate statement(s)"}
      </button>
    </form>
  );
}
