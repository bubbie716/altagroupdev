"use client";

import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, useTransition } from "react";
import {
  createAccountingCategoryFn,
  deleteAccountingCategoryFn,
  listAccountingCategoriesFn,
  seedAccountingCategoriesFn,
  updateAccountingCategoryFn,
} from "@/lib/accounting/accounting.functions";
import { ACCOUNTING_CATEGORY_KINDS } from "@/lib/accounting/defaults";
import type { AccountingCategoryDto } from "@/lib/accounting/types";

export const Route = createFileRoute("/accounting/categories")({
  component: AccountingCategoriesPage,
});

function AccountingCategoriesPage() {
  const listCategories = useServerFn(listAccountingCategoriesFn);
  const createCategory = useServerFn(createAccountingCategoryFn);
  const updateCategory = useServerFn(updateAccountingCategoryFn);
  const deleteCategory = useServerFn(deleteAccountingCategoryFn);
  const seedCategories = useServerFn(seedAccountingCategoriesFn);

  const [rows, setRows] = useState<AccountingCategoryDto[]>([]);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<(typeof ACCOUNTING_CATEGORY_KINDS)[number]>("expense");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const reload = () => {
    startTransition(async () => {
      try {
        setRows(await listCategories());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load categories");
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
        await createCategory({ data: { name, kind } });
        setName("");
        setRows(await listCategories());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Create failed");
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl tracking-tight">Categories</h2>
          <p className="text-[13px] text-muted-foreground">
            Income and expense categories for the selected company.
          </p>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              try {
                await seedCategories();
                setRows(await listCategories());
              } catch (err) {
                setError(err instanceof Error ? err.message : "Seed failed");
              }
            });
          }}
          className="min-h-10 rounded-md border border-border px-3 text-[13px] hover:bg-surface-2"
        >
          Seed defaults
        </button>
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
            {ACCOUNTING_CATEGORY_KINDS.map((k) => (
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
            No categories yet.
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
                    await updateCategory({ data: { id: row.id, name: next, kind: row.kind } });
                    setRows(await listCategories());
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
                    await updateCategory({
                      data: { id: row.id, name: row.name, kind: nextKind },
                    });
                    setRows(await listCategories());
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Update failed");
                  }
                });
              }}
            >
              {ACCOUNTING_CATEGORY_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="text-[12px] text-destructive hover:underline"
              onClick={() => {
                if (!confirm(`Delete category “${row.name}”?`)) return;
                startTransition(async () => {
                  try {
                    await deleteCategory({ data: { id: row.id } });
                    setRows(await listCategories());
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
