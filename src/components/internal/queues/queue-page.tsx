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
      <div className="mb-3 flex flex-col gap-3 border-b border-border/50 pb-2 sm:flex-row sm:items-center sm:justify-between">
        {statusTabs && statusTabs.length > 0 && onStatusChange ? (
          <div className="-mb-2 flex flex-wrap gap-0">
            {statusTabs.map((tab) => {
              const active = activeStatus === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onStatusChange(tab.id)}
                  className={cn(
                    "relative -mb-px px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] transition-colors",
                    active
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {tab.label}
                    {tab.count != null ? (
                      <span
                        className={cn(
                          "tabular rounded-sm px-1 py-px text-[9px]",
                          active
                            ? "bg-gold/15 text-gold"
                            : "bg-surface-2/60 text-muted-foreground",
                        )}
                      >
                        {tab.count}
                      </span>
                    ) : null}
                  </span>
                  {active ? (
                    <span
                      className="pointer-events-none absolute inset-x-2 -bottom-px h-px bg-gold"
                      aria-hidden
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : (
          <span />
        )}
        {onSearchChange != null ? (
          <div className="relative sm:w-72">
            <span
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/60"
              aria-hidden
            >
              ⌕
            </span>
            <input
              type="search"
              value={search ?? ""}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-8 w-full rounded-sm border border-border/70 bg-surface-1 pl-7 pr-2.5 text-[12px] outline-none transition-colors focus:border-gold focus:ring-1 focus:ring-gold/30"
            />
          </div>
        ) : null}
      </div>
      {children}
    </InternalPageShell>
  );
}
