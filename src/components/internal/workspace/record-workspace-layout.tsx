"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { OpsStatusBadge } from "@/components/internal/console/ops-status-badge";

export type RecordWorkspaceTab = {
  id: string;
  label: string;
  content: ReactNode;
};

/**
 * Full-width record workspace chrome: identity header + up to three primary tabs.
 * Extends the workspace system without a permanent right sidebar.
 */
export function RecordWorkspaceLayout({
  title,
  recordType,
  primaryId,
  status,
  warning,
  meta,
  headerActions,
  tabs,
  activeTabId,
  onTabChange,
  children,
  className,
}: {
  title: string;
  recordType: string;
  primaryId?: ReactNode;
  status?: string;
  warning?: ReactNode;
  meta?: ReactNode;
  headerActions?: ReactNode;
  tabs?: RecordWorkspaceTab[];
  activeTabId?: string;
  onTabChange?: (tabId: string) => void;
  /** Single-page body when tabs are omitted (e.g. transaction record). */
  children?: ReactNode;
  className?: string;
}) {
  const tabList = tabs ?? [];
  const showTabs = tabList.length > 1;
  const activeTab = tabList.find((t) => t.id === activeTabId) ?? tabList[0];
  const body = showTabs || tabList.length === 1 ? activeTab?.content : children;
  const tablistId = useId();
  const activeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!showTabs) return;
    activeBtnRef.current?.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" });
  }, [activeTabId, showTabs]);

  return (
    <div
      className={cn("record-workspace min-w-0", className)}
      data-record-workspace
      aria-label={title}
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 pb-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] text-muted-foreground">{recordType}</p>
            {status ? <OpsStatusBadge status={status} /> : null}
          </div>
          {/* Shell H1 owns the unique record title — do not repeat it here. */}
          {primaryId ? (
            <div className="mt-1 min-w-0 break-all font-mono text-[11px] text-muted-foreground">{primaryId}</div>
          ) : null}
          {meta ? <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-muted-foreground">{meta}</div> : null}
          {warning ? <div className="mt-2">{warning}</div> : null}
        </div>
        {headerActions ? (
          <div className="flex shrink-0 flex-wrap items-start gap-2">{headerActions}</div>
        ) : null}
      </header>

      {showTabs ? (
        <div
          role="tablist"
          aria-label="Record sections"
          id={tablistId}
          className="mt-2 flex gap-1 border-b border-border/60"
          data-record-tabs
        >
          {tabList.map((tab) => {
            const active = tab.id === (activeTabId ?? tabList[0]?.id);
            return (
              <button
                key={tab.id}
                ref={active ? activeBtnRef : undefined}
                type="button"
                role="tab"
                id={`${tablistId}-${tab.id}`}
                aria-selected={active}
                tabIndex={active ? 0 : -1}
                onClick={() => onTabChange?.(tab.id)}
                className={cn(
                  "relative min-w-0 flex-1 px-2 py-2.5 text-center text-[13px] font-medium transition-colors sm:flex-none sm:px-3 sm:text-left",
                  active
                    ? "text-foreground after:absolute after:inset-x-2 after:-bottom-px after:h-[2px] after:bg-gold sm:after:inset-x-0"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      ) : null}

      <div
        className="mt-3 min-w-0"
        role={showTabs ? "tabpanel" : undefined}
        aria-labelledby={showTabs && activeTab ? `${tablistId}-${activeTab.id}` : undefined}
      >
        {body}
      </div>
    </div>
  );
}

export function RecordAttentionBanner({
  items,
}: {
  items: Array<{ id: string; label: string; detail?: string; tone?: "warning" | "danger" | "info" }>;
}) {
  if (items.length === 0) return null;
  return (
    <div
      className="rounded border border-amber-500/30 bg-amber-500/5 px-3 py-2"
      role="status"
      data-record-attention
    >
      <p className="text-[12px] font-medium text-foreground">Needs attention</p>
      <ul className="mt-1.5 space-y-1">
        {items.map((item) => (
          <li key={item.id} className="text-[12px] text-muted-foreground">
            <span className="text-foreground">{item.label}</span>
            {item.detail ? ` — ${item.detail}` : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RecordSummaryCard({
  title,
  children,
  actions,
  id,
  className,
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={cn("scroll-mt-4 rounded border border-border/70 bg-surface-1/30 px-3 py-2.5", className)}
      data-record-section={id}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[13px] font-medium text-foreground">{title}</h3>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function RecordEmptyCopy({ children }: { children: ReactNode }) {
  return <p className="text-[12px] text-muted-foreground">{children}</p>;
}

export function RecordMoreSection({
  id,
  title,
  defaultOpen = false,
  children,
}: {
  id: string;
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details
      id={id}
      className="group scroll-mt-4 rounded border border-border/70 bg-surface-1/30 open:pb-2.5"
      open={defaultOpen || undefined}
      data-record-section={id}
    >
      <summary className="cursor-pointer list-none px-3 py-2.5 text-[13px] font-medium marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="flex items-center justify-between gap-2">
          {title}
          <span className="text-[11px] text-muted-foreground group-open:hidden">Show</span>
          <span className="hidden text-[11px] text-muted-foreground group-open:inline">Hide</span>
        </span>
      </summary>
      <div className="border-t border-border/50 px-3 pt-2.5 group-[:not([open])]:hidden">{children}</div>
    </details>
  );
}
