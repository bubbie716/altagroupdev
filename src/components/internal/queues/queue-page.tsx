"use client";

import type { ReactNode } from "react";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { buildBreadcrumbs } from "@/components/internal/console";
import { cn } from "@/lib/utils";
import { queueBreadcrumbs } from "./queue-utils";

export function QueuePage({
  title,
  search,
  onSearchChange,
  searchPlaceholder = "Search…",
  statusTabs,
  activeStatus,
  onStatusChange,
  actions,
  children,
}: {
  title: string;
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  statusTabs?: Array<{ id: string; label: string; count?: number }>;
  activeStatus?: string;
  onStatusChange?: (id: string) => void;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <InternalPageShell
      title={title}
      breadcrumbs={buildBreadcrumbs(queueBreadcrumbs(title))}
      actions={actions}
    >
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {onSearchChange != null ? (
          <input
            type="search"
            value={search ?? ""}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-8 min-w-0 flex-1 rounded border border-border bg-surface-1 px-2.5 text-[12px] sm:max-w-xs"
          />
        ) : (
          <span />
        )}
        {statusTabs && statusTabs.length > 0 && onStatusChange ? (
          <div className="flex flex-wrap gap-1">
            {statusTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => onStatusChange(tab.id)}
                className={cn(
                  "rounded border px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em]",
                  activeStatus === tab.id
                    ? "border-gold/40 bg-gold/10 text-gold"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
                {tab.count != null ? ` (${tab.count})` : ""}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {children}
    </InternalPageShell>
  );
}
