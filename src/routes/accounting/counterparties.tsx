"use client";

import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, useTransition } from "react";
import {
  createAccountingCounterpartyFn,
  deleteAccountingCounterpartyFn,
  listAccountingCounterpartiesFn,
  updateAccountingCounterpartyFn,
} from "@/lib/accounting/accounting.functions";
import { ACCOUNTING_COUNTERPARTY_KINDS } from "@/lib/accounting/defaults";
import type { AccountingCounterpartyDto } from "@/lib/accounting/types";

export const Route = createFileRoute("/accounting/counterparties")({
  component: AccountingCounterpartiesPage,
});

function AccountingCounterpartiesPage() {
  const listCounterparties = useServerFn(listAccountingCounterpartiesFn);
  const createCounterparty = useServerFn(createAccountingCounterpartyFn);
  const updateCounterparty = useServerFn(updateAccountingCounterpartyFn);
  const deleteCounterparty = useServerFn(deleteAccountingCounterpartyFn);

  const [rows, setRows] = useState<AccountingCounterpartyDto[]>([]);
  const [name, setName] = useState("");
  const [kind, setKind] =
    useState<(typeof ACCOUNTING_COUNTERPARTY_KINDS)[number]>("vendor");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const reload = () => {
    startTransition(async () => {
      try {
        setRows(await listCounterparties());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load counterparties");
      }
    });
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await createCounterparty({ data: { name, kind } });
        setName("");
        setRows(await listCounterparties());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Create failed");
      }
    });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Counterparties</h1>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <form
        onSubmit={onCreate}
        className="flex flex-wrap items-end gap-2 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
      >
        <label className="space-y-1">
          <span className="text-sm font-medium text-gray-700">Name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium text-gray-700">Kind</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as typeof kind)}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          >
            {ACCOUNTING_COUNTERPARTY_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Add
        </button>
      </form>

      <ul className="divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        {rows.length === 0 ? (
          <li className="px-4 py-8 text-center text-sm text-gray-500">
            No counterparties yet.
          </li>
        ) : null}
        {rows.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center gap-2 px-4 py-3">
            <input
              className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm"
              defaultValue={row.name}
              onBlur={(e) => {
                const next = e.target.value.trim();
                if (!next || next === row.name) return;
                startTransition(async () => {
                  try {
                    await updateCounterparty({
                      data: { id: row.id, name: next, kind: row.kind },
                    });
                    setRows(await listCounterparties());
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Update failed");
                  }
                });
              }}
            />
            <select
              className="rounded border border-gray-300 px-2 py-1.5 text-sm"
              value={row.kind}
              onChange={(e) => {
                const nextKind = e.target.value;
                startTransition(async () => {
                  try {
                    await updateCounterparty({
                      data: { id: row.id, name: row.name, kind: nextKind },
                    });
                    setRows(await listCounterparties());
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Update failed");
                  }
                });
              }}
            >
              {ACCOUNTING_COUNTERPARTY_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="text-sm text-red-600 hover:underline"
              onClick={() => {
                if (!confirm(`Delete counterparty “${row.name}”?`)) return;
                startTransition(async () => {
                  try {
                    await deleteCounterparty({ data: { id: row.id } });
                    setRows(await listCounterparties());
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Delete failed");
                  }
                });
              }}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
