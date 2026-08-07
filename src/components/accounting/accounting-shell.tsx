"use client";

import { Link, Outlet, useRouter, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, useTransition } from "react";
import {
  createAccountingOrgFn,
  fetchAccountingWorkspace,
  setAccountingOrgFn,
} from "@/lib/accounting/accounting.functions";
import type { AccountingWorkspaceDto } from "@/lib/accounting/types";
import { accountingSelectClassName } from "@/lib/accounting/ui";
import { cn } from "@/lib/utils";

const NAV: Array<{ label: string; to: string; exact?: boolean }> = [
  { label: "Dashboard", to: "/accounting", exact: true },
  { label: "Categories", to: "/accounting/categories" },
  { label: "Counterparties", to: "/accounting/counterparties" },
];

export function AccountingShell({
  initialWorkspace,
}: {
  initialWorkspace: AccountingWorkspaceDto;
}) {
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const setOrg = useServerFn(setAccountingOrgFn);
  const createOrg = useServerFn(createAccountingOrgFn);
  const refreshWorkspace = useServerFn(fetchAccountingWorkspace);
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const [newOrgName, setNewOrgName] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onOrgChange = (orgId: string) => {
    if (!orgId) return;
    setError(null);
    startTransition(async () => {
      try {
        const next = await setOrg({ data: { orgId } });
        setWorkspace(next);
        await router.invalidate();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not switch organization");
      }
    });
  };

  const onCreateOrg = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const next = await createOrg({ data: { name: newOrgName } });
        setWorkspace(next);
        setNewOrgName("");
        await router.invalidate();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create organization");
      }
    });
  };

  return (
    <div className="min-h-[100dvh] bg-gray-50 text-gray-900">
      <nav className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link to="/accounting" className="text-lg font-semibold text-gray-800">
            Accounting Tracker
          </Link>
          <div className="flex flex-wrap items-center gap-4">
            {workspace.orgs.length > 0 ? (
              <select
                className={cn(accountingSelectClassName, "max-w-[14rem]")}
                disabled={pending}
                value={workspace.orgId ?? ""}
                onChange={(e) => onOrgChange(e.target.value)}
              >
                <option value="">Select org…</option>
                {workspace.orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            ) : null}
            {NAV.map((item) => {
              const active = item.exact
                ? pathname.replace(/\/$/, "") === item.to || pathname === `${item.to}/`
                : pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={
                    active
                      ? "font-medium text-gray-900"
                      : "text-gray-600 hover:text-gray-900"
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {error ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {!workspace.orgId ? (
          <div className="mx-auto max-w-md rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
            <h1 className="mb-2 text-xl font-semibold text-gray-800">
              Organization required
            </h1>
            <p className="mb-6 text-sm text-gray-600">
              Create an organization to use Accounting Tracker, or select an existing one
              above.
            </p>
            <form onSubmit={onCreateOrg} className="flex flex-col gap-3 text-left">
              <input
                required
                minLength={2}
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                placeholder="Organization name"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={pending}
                className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {pending ? "Creating…" : "Create organization"}
              </button>
            </form>
            {workspace.orgs.length > 0 ? (
              <button
                type="button"
                className="mt-4 text-sm text-blue-600 hover:underline"
                onClick={() => {
                  startTransition(async () => {
                    const next = await refreshWorkspace();
                    setWorkspace(next);
                  });
                }}
              >
                Refresh organization list
              </button>
            ) : null}
          </div>
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  );
}
