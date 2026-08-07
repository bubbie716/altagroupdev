"use client";

import { Link, Outlet, useRouter, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, useTransition } from "react";
import { useSiteContext } from "@/hooks/use-site-context";
import {
  fetchAccountingWorkspace,
  setAccountingCompanyFn,
} from "@/lib/accounting/accounting.functions";
import type { AccountingWorkspaceDto } from "@/lib/accounting/types";
import { cn } from "@/lib/utils";

const NAV: Array<{ label: string; to: string; exact?: boolean }> = [
  { label: "Dashboard", to: "/accounting", exact: true },
  { label: "New entry", to: "/accounting/entries/new" },
  { label: "Categories", to: "/accounting/categories" },
  { label: "Counterparties", to: "/accounting/counterparties" },
];

export function AccountingShell({
  initialWorkspace,
}: {
  initialWorkspace: AccountingWorkspaceDto;
}) {
  const site = useSiteContext();
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const setCompany = useServerFn(setAccountingCompanyFn);
  const refreshWorkspace = useServerFn(fetchAccountingWorkspace);
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onCompanyChange = (companyId: string) => {
    if (!companyId) return;
    setError(null);
    startTransition(async () => {
      try {
        const next = await setCompany({ data: { companyId } });
        setWorkspace(next);
        await router.invalidate();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not switch company");
      }
    });
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background text-foreground">
      <header className="border-b border-border/70 bg-surface-1">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">
              Alta · {site.wordmarkSuffix}
            </p>
            <h1 className="font-serif text-xl tracking-tight">{site.displayName}</h1>
            <p className="text-[12px] text-muted-foreground">
              Staff only · cash-basis books · not a public product
            </p>
          </div>
          <div className="flex min-w-[14rem] flex-col gap-1">
            <label
              htmlFor="accounting-company"
              className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground"
            >
              Company
            </label>
            <select
              id="accounting-company"
              className="min-h-10 rounded-md border border-border bg-background px-3 text-[13px]"
              disabled={pending || workspace.companies.length === 0}
              value={workspace.companyId ?? ""}
              onChange={(e) => onCompanyChange(e.target.value)}
            >
              <option value="">Select company…</option>
              {workspace.companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 pb-3">
          {NAV.map((item) => {
            const active = item.exact
              ? pathname.replace(/\/$/, "") === item.to || pathname === `${item.to}/`
              : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "inline-flex min-h-9 shrink-0 items-center rounded-md px-3 text-[13px] font-medium",
                  active
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        {error ? (
          <p className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
            {error}
          </p>
        ) : null}
        {!workspace.companyId ? (
          <div className="rounded-lg border border-border/70 bg-surface-1 p-6">
            <h2 className="font-serif text-2xl tracking-tight">Select a company</h2>
            <p className="mt-2 text-[14px] text-muted-foreground">
              Choose a company above to open its cash-basis ledger. Categories and entries are
              scoped to that company.
            </p>
            {workspace.companies.length === 0 ? (
              <p className="mt-4 text-[13px] text-amber-700 dark:text-amber-400">
                No companies found in the database.
              </p>
            ) : (
              <button
                type="button"
                className="mt-4 text-[13px] text-gold underline-offset-2 hover:underline"
                onClick={() => {
                  startTransition(async () => {
                    const next = await refreshWorkspace();
                    setWorkspace(next);
                  });
                }}
              >
                Refresh company list
              </button>
            )}
          </div>
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  );
}
