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

  const incomeBars = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of entries.filter((x) => x.type === "income")) {
      map[e.category.name] = (map[e.category.name] ?? 0) + e.amountCents;
    }
    const rows = Object.entries(map).sort((a, b) => b[1] - a[1]);
    const max = Math.max(...rows.map(([, v]) => v), 1);
    return { rows, max };
  }, [entries]);

  const onDelete = (id: string) => {
    if (!confirm("Delete this transaction?")) return;
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <div className="flex flex-wrap items-center gap-3">
          <select
            className="rounded border border-gray-300 px-3 py-1.5 text-sm"
            value={period}
            onChange={(e) => setPeriod(e.target.value as "all" | "month")}
          >
            <option value="all">All time</option>
            <option value="month">By month</option>
          </select>
          {period === "month" ? (
            <input
              type="month"
              className="rounded border border-gray-300 px-3 py-1.5 text-sm"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          ) : null}
          <button
            type="button"
            onClick={onExport}
            disabled={pending}
            className="rounded bg-gray-200 px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-300 disabled:opacity-50"
          >
            Export CSV
          </button>
          <Link
            to="/accounting/entries/new"
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Add Transaction
          </Link>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Total Income</p>
          <p className="text-xl font-semibold text-green-700">{centsToFlorins(totals.income)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Total Expenses</p>
          <p className="text-xl font-semibold text-red-700">{centsToFlorins(totals.expenses)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Net</p>
          <p
            className={`text-xl font-semibold ${
              totals.net >= 0 ? "text-green-700" : "text-red-700"
            }`}
          >
            {centsToFlorins(totals.net)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-medium text-gray-700">Expenses by category</h2>
          {expenseBars.rows.length === 0 ? (
            <p className="text-sm text-gray-500">
              No expenses{period === "month" ? " this month" : ""}.
            </p>
          ) : (
            <div className="space-y-2">
              {expenseBars.rows.map(([name, cents]) => (
                <div key={name} className="flex items-center gap-2">
                  <div
                    className="h-6 rounded bg-red-100"
                    style={{
                      width: `${Math.max(4, (cents / expenseBars.max) * 100)}%`,
                    }}
                  />
                  <span className="min-w-[120px] text-sm">{name}</span>
                  <span className="text-sm font-medium text-gray-700">
                    {centsToFlorins(cents)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-medium text-gray-700">Income by category</h2>
          {incomeBars.rows.length === 0 ? (
            <p className="text-sm text-gray-500">
              No income{period === "month" ? " this month" : ""}.
            </p>
          ) : (
            <div className="space-y-2">
              {incomeBars.rows.map(([name, cents]) => (
                <div key={name} className="flex items-center gap-2">
                  <div
                    className="h-6 rounded bg-green-100"
                    style={{
                      width: `${Math.max(4, (cents / incomeBars.max) * 100)}%`,
                    }}
                  />
                  <span className="min-w-[120px] text-sm">{name}</span>
                  <span className="text-sm font-medium text-gray-700">
                    {centsToFlorins(cents)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <h2 className="border-b border-gray-200 px-4 py-3 text-sm font-medium text-gray-700">
          Transactions{pending ? " · Loading…" : ` · ${entries.length}`}
        </h2>
        {entries.length === 0 && !pending ? (
          <p className="p-4 text-sm text-gray-500">
            No transactions{period === "month" ? " this month" : ""}.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left">
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2 font-medium">Amount</th>
                  <th className="px-4 py-2 font-medium">Category</th>
                  <th className="px-4 py-2 font-medium">Counterparty</th>
                  <th className="px-4 py-2 font-medium">Payment</th>
                  <th className="px-4 py-2 font-medium">Note</th>
                  <th className="w-20 px-4 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2">{e.date}</td>
                    <td className="px-4 py-2 capitalize">{e.type}</td>
                    <td
                      className={`px-4 py-2 font-medium ${
                        e.type === "income" ? "text-green-700" : "text-red-700"
                      }`}
                    >
                      {e.type === "income" ? "+" : "-"}
                      {centsToFlorins(e.amountCents)}
                    </td>
                    <td className="px-4 py-2">{e.category.name}</td>
                    <td className="px-4 py-2">{e.counterparty?.name ?? "—"}</td>
                    <td className="px-4 py-2 capitalize">{e.paymentMethod}</td>
                    <td
                      className="max-w-[200px] truncate px-4 py-2 text-gray-600"
                      title={e.note ?? undefined}
                    >
                      {e.note ?? "—"}
                    </td>
                    <td className="px-4 py-2">
                      <button
                        type="button"
                        onClick={() => onDelete(e.id)}
                        disabled={pending}
                        className="text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
