"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { OpsStatusBadge } from "@/components/internal/console/ops-status-badge";

export type WorkspaceTab = {
  id: string;
  label: string;
  content: ReactNode;
};

export function WorkspaceLayout({
  title,
  status,
  headerActions,
  relatedLinks,
  tabs,
  activeTabId,
  onTabChange,
  children,
  sidebar,
  showHeader = true,
  className,
}: {
  title: string;
  status?: string;
  headerActions?: ReactNode;
  relatedLinks?: ReactNode;
  tabs?: WorkspaceTab[];
  activeTabId?: string;
  onTabChange?: (tabId: string) => void;
  /** Main tab body when not using controlled tabs. */
  children?: ReactNode;
  /** Right sidebar — defaults to placeholder panels. */
  sidebar?: ReactNode;
  /** When false, title/status render only in the fixed shell header. */
  showHeader?: boolean;
  className?: string;
}) {
  const activeTab = tabs?.find((t) => t.id === activeTabId) ?? tabs?.[0];
  const body = tabs ? activeTab?.content : children;

  return (
    <div className={cn("workspace-layout min-w-0", className)}>
      {showHeader ? (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 pb-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-[16px] font-semibold tracking-tight">{title}</h2>
              {status ? <OpsStatusBadge status={status} /> : null}
            </div>
            {relatedLinks ? (
              <div className="mt-1.5 flex flex-wrap gap-2 text-[11px]">{relatedLinks}</div>
            ) : null}
          </div>
          {headerActions ? <div className="flex shrink-0 flex-wrap gap-2">{headerActions}</div> : null}
        </div>
      ) : relatedLinks ? (
        <div className="mb-2 flex flex-wrap gap-2 text-[11px]">{relatedLinks}</div>
      ) : null}

      {tabs && tabs.length > 0 ? (
        <div className="mt-2 flex gap-1 overflow-x-auto border-b border-border/50 pb-px">
          {tabs.map((tab) => {
            const active = tab.id === (activeTabId ?? tabs[0]?.id);
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange?.(tab.id)}
                className={cn(
                  "shrink-0 rounded-t px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors",
                  active
                    ? "border border-b-0 border-border/80 bg-surface-1 text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="mt-3 grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_16rem] xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0">{body}</div>
        <aside className="min-w-0 space-y-3 lg:sticky lg:top-2 lg:self-start">
          {sidebar ?? <WorkspaceSidebarPlaceholder />}
        </aside>
      </div>
    </div>
  );
}

function WorkspaceSidebarPlaceholder() {
  return (
    <>
      <WorkspaceSidebarPanel title="Quick actions">
        <p className="text-[11px] text-muted-foreground">Actions will appear here.</p>
      </WorkspaceSidebarPanel>
      <WorkspaceSidebarPanel title="Recent notes">
        <p className="text-[11px] text-muted-foreground">No notes yet.</p>
      </WorkspaceSidebarPanel>
      <WorkspaceSidebarPanel title="Recent audit">
        <p className="text-[11px] text-muted-foreground">Audit events will appear here.</p>
      </WorkspaceSidebarPanel>
      <WorkspaceSidebarPanel title="Related records">
        <p className="text-[11px] text-muted-foreground">Linked accounts, users, and products.</p>
      </WorkspaceSidebarPanel>
      <WorkspaceSidebarPanel title="Deal rooms">
        <p className="text-[11px] text-muted-foreground">Open deal rooms will appear here.</p>
      </WorkspaceSidebarPanel>
    </>
  );
}

export function WorkspaceSidebarPanel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded border border-border/70 bg-surface-1/50 px-3 py-2.5">
      <h3 className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">{title}</h3>
      <div className="mt-2">{children}</div>
    </section>
  );
}

/** Default workspace tabs — products add more later. */
export const WORKSPACE_TAB_IDS = ["overview", "activity", "audit", "notes"] as const;

export function createDefaultWorkspaceTabs(content: Partial<Record<(typeof WORKSPACE_TAB_IDS)[number], ReactNode>>) {
  return [
    { id: "overview", label: "Overview", content: content.overview ?? <WorkspaceTabPlaceholder label="Overview" /> },
    { id: "activity", label: "Activity", content: content.activity ?? <WorkspaceTabPlaceholder label="Activity" /> },
    { id: "audit", label: "Audit", content: content.audit ?? <WorkspaceTabPlaceholder label="Audit" /> },
    { id: "notes", label: "Notes", content: content.notes ?? <WorkspaceTabPlaceholder label="Notes" /> },
  ] satisfies WorkspaceTab[];
}

function WorkspaceTabPlaceholder({ label }: { label: string }) {
  return (
    <p className="rounded border border-dashed border-border/70 px-3 py-6 text-center text-[12px] text-muted-foreground">
      {label} content will render here.
    </p>
  );
}
