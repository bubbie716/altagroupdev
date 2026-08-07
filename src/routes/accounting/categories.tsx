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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Categories</h1>
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
          className="rounded bg-gray-200 px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-300 disabled:opacity-50"
        >
          Seed defaults
        </button>
      </div>

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
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Add
        </button>
      </form>

      <ul className="divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        {rows.length === 0 ? (
          <li className="px-4 py-8 text-center text-sm text-gray-500">No categories yet.</li>
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
                    await updateCategory({ data: { id: row.id, name: next, kind: row.kind } });
                    setRows(await listCategories());
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
              className="text-sm text-red-600 hover:underline"
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
