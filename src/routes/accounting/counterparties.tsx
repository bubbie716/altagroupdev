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
      <div>
        <h2 className="font-serif text-2xl tracking-tight">Counterparties</h2>
        <p className="text-[13px] text-muted-foreground">
          Customers and vendors for the selected company.
        </p>
      </div>

      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
          {error}
        </p>
      ) : null}

      <form
        onSubmit={onCreate}
        className="flex flex-wrap items-end gap-2 rounded-lg border border-border/70 bg-surface-1 p-4"
      >
        <label className="space-y-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Name
          </span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="min-h-10 rounded-md border border-border bg-background px-3 text-[13px]"
          />
        </label>
        <label className="space-y-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Kind
          </span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as typeof kind)}
            className="min-h-10 rounded-md border border-border bg-background px-3 text-[13px]"
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
          className="min-h-10 rounded-md bg-foreground px-3 text-[13px] font-medium text-background"
        >
          Add
        </button>
      </form>

      <ul className="divide-y divide-border/60 overflow-hidden rounded-lg border border-border/70">
        {rows.length === 0 ? (
          <li className="px-4 py-8 text-center text-[13px] text-muted-foreground">
            No counterparties yet.
          </li>
        ) : null}
        {rows.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center gap-2 bg-surface-1 px-4 py-3">
            <input
              className="min-h-9 flex-1 rounded-md border border-border bg-background px-2 text-[13px]"
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
              className="min-h-9 rounded-md border border-border bg-background px-2 text-[13px]"
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
              className="text-[12px] text-destructive hover:underline"
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
