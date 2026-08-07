"use client";

import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  deleteAccountingEntryFn,
  exportAccountingCsvFn,
  listAccountingEntriesFn,
} from "@/lib/accounting/accounting.functions";
import { centsToFlorins } from "@/lib/accounting/format";
import type { AccountingLedgerEntryDto } from "@/lib/accounting/types";

function getDefaultMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export const Route = createFileRoute("/accounting/")({
  component: AccountingDashboardPage,
});

function AccountingDashboardPage() {
  const listEntries = useServerFn(listAccountingEntriesFn);
  const deleteEntry = useServerFn(deleteAccountingEntryFn);
  const exportCsv = useServerFn(exportAccountingCsvFn);

  const [period, setPeriod] = useState<"all" | "month">("month");
  const [month, setMonth] = useState(getDefaultMonth());
  const [entries, setEntries] = useState<AccountingLedgerEntryDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const monthParam = period === "all" ? "all" : month;

  const reload = () => {
    setError(null);
    startTransition(async () => {
      try {
        const rows = await listEntries({ data: { month: monthParam } });
        setEntries(rows);
      } catch (err) {
        setEntries([]);
        setError(err instanceof Error ? err.message : "Failed to load entries");
      }
    });
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when month filter changes
  }, [monthParam]);

  const totals = useMemo(() => {
    const income = entries
      .filter((e) => e.type === "income")
      .reduce((s, e) => s + e.amountCents, 0);
    const expenses = entries
      .filter((e) => e.type === "expense")
      .reduce((s, e) => s + e.amountCents, 0);
    return { income, expenses, net: income - expenses };
  }, [entries]);

  const expenseBars = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of entries.filter((x) => x.type === "expense")) {
      map[e.category.name] = (map[e.category.name] ?? 0) + e.amountCents;
    }
    const rows = Object.entries(map).sort((a, b) => b[1] - a[1]);
    const max = Math.max(...rows.map(([, v]) => v), 1);
    return { rows, max };
  }, [entries]);

  const onDelete = (id: string) => {
    if (!confirm("Delete this ledger entry?")) return;
    startTransition(async () => {
      try {
        await deleteEntry({ data: { id } });
        setEntries((prev) => prev.filter((e) => e.id !== id));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Delete failed");
      }
    });
  };

  const onExport = () => {
    startTransition(async () => {
      try {
        const { filename, csv } = await exportCsv({ data: { month: monthParam } });
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Export failed");
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl tracking-tight">Dashboard</h2>
          <p className="text-[13px] text-muted-foreground">Cash-basis totals in Alta florins.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="min-h-10 rounded-md border border-border bg-background px-3 text-[13px]"
            value={period}
            onChange={(e) => setPeriod(e.target.value as "all" | "month")}
          >
            <option value="month">By month</option>
            <option value="all">All time</option>
          </select>
          {period === "month" ? (
            <input
              type="month"
              className="min-h-10 rounded-md border border-border bg-background px-3 text-[13px]"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          ) : null}
          <button
            type="button"
            onClick={onExport}
            disabled={pending}
            className="min-h-10 rounded-md border border-border px-3 text-[13px] hover:bg-surface-2"
          >
            Export CSV
          </button>
          <Link
            to="/accounting/entries/new"
            className="inline-flex min-h-10 items-center rounded-md bg-foreground px-3 text-[13px] font-medium text-background"
          >
            New entry
          </Link>
        </div>
      </div>

      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Income" value={centsToFlorins(totals.income)} />
        <StatCard label="Expenses" value={centsToFlorins(totals.expenses)} />
        <StatCard label="Net" value={centsToFlorins(totals.net)} />
      </div>

      {expenseBars.rows.length > 0 ? (
        <section className="rounded-lg border border-border/70 bg-surface-1 p-4">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Expenses by category
          </h3>
          <ul className="mt-3 space-y-2">
            {expenseBars.rows.map(([name, cents]) => (
              <li key={name}>
                <div className="mb-1 flex justify-between text-[12px]">
                  <span>{name}</span>
                  <span className="font-mono">{centsToFlorins(cents)}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full bg-gold/80"
                    style={{ width: `${Math.round((cents / expenseBars.max) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-lg border border-border/70">
        <div className="border-b border-border/70 bg-surface-1 px-4 py-3">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Ledger · {pending ? "Loading…" : `${entries.length} entries`}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-[13px]">
            <thead className="bg-surface-2/40 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Counterparty</th>
                <th className="px-3 py-2">Method</th>
                <th className="px-3 py-2">Note</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 && !pending ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                    No entries for this period.
                  </td>
                </tr>
              ) : null}
              {entries.map((e) => (
                <tr key={e.id} className="border-t border-border/50">
                  <td className="px-3 py-2 font-mono text-[12px]">{e.date}</td>
                  <td className="px-3 py-2 capitalize">{e.type}</td>
                  <td className="px-3 py-2 font-mono">{centsToFlorins(e.amountCents)}</td>
                  <td className="px-3 py-2">{e.category.name}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {e.counterparty?.name ?? "—"}
                  </td>
                  <td className="px-3 py-2 capitalize">{e.paymentMethod}</td>
                  <td className="max-w-[12rem] truncate px-3 py-2 text-muted-foreground">
                    {e.note ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      className="text-[12px] text-destructive hover:underline"
                      onClick={() => onDelete(e.id)}
                      disabled={pending}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-surface-1 px-4 py-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 font-serif text-2xl tracking-tight">{value}</div>
    </div>
  );
}
