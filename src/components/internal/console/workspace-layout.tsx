"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
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
  /** When true, use full content width (no sticky right sidebar). Used by record workspaces. */
  fullWidth = false,
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
  fullWidth?: boolean;
  className?: string;
}) {
  const activeTab = tabs?.find((t) => t.id === activeTabId) ?? tabs?.[0];
  const body = tabs ? activeTab?.content : children;
  const tablistId = useId();
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeBtnRef = useRef<HTMLButtonElement>(null);
  const [canScrollX, setCanScrollX] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    function update() {
      if (!el) return;
      setCanScrollX(el.scrollWidth > el.clientWidth + 2);
    }
    update();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(el);
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      ro?.disconnect();
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [tabs?.length, activeTabId]);

  useEffect(() => {
    activeBtnRef.current?.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" });
  }, [activeTabId]);

  useEffect(() => {
    if (!overflowOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOverflowOpen(false);
    }
    function onPointer(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-workspace-tab-overflow]")) return;
      setOverflowOpen(false);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onPointer);
    };
  }, [overflowOpen]);

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
        <div className="mt-2 flex items-end gap-2 border-b border-border/60">
          <div
            className="workspace-tabs-scroll min-w-0 flex-1"
            data-can-scroll-x={canScrollX ? "true" : "false"}
          >
            <div
              ref={scrollRef}
              role="tablist"
              aria-label="Workspace sections"
              id={tablistId}
              className="flex gap-4 overflow-x-auto pb-px"
            >
              {tabs.map((tab) => {
                const active = tab.id === (activeTabId ?? tabs[0]?.id);
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
                      "relative shrink-0 px-0.5 py-2 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors",
                      active
                        ? "text-foreground after:absolute after:inset-x-0 after:-bottom-px after:h-[2px] after:bg-gold"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {canScrollX ? (
            <div className="relative shrink-0 pb-1" data-workspace-tab-overflow>
              <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={overflowOpen}
                aria-label="More workspace tabs"
                onClick={() => setOverflowOpen((o) => !o)}
                className="inline-flex h-8 items-center gap-1 rounded border border-border/80 px-2 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
              >
                Tabs
                <ChevronDown className="size-3.5" aria-hidden />
              </button>
              {overflowOpen ? (
                <ul
                  role="listbox"
                  aria-label="Workspace tabs"
                  className="absolute right-0 z-40 mt-1 max-h-64 min-w-[10rem] overflow-auto rounded border border-border bg-surface-1 py-1 shadow-lg"
                >
                  {tabs.map((tab) => {
                    const active = tab.id === (activeTabId ?? tabs[0]?.id);
                    return (
                      <li key={tab.id} role="option" aria-selected={active}>
                        <button
                          type="button"
                          className={cn(
                            "block w-full px-3 py-2 text-left text-[12px]",
                            active ? "bg-surface-2 font-medium text-foreground" : "text-muted-foreground hover:bg-surface-2/60 hover:text-foreground",
                          )}
                          onClick={() => {
                            onTabChange?.(tab.id);
                            setOverflowOpen(false);
                          }}
                        >
                          {tab.label}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <div
        className={cn(
          "mt-3 grid min-w-0 gap-4",
          !fullWidth && "lg:grid-cols-[minmax(0,1fr)_16rem] xl:grid-cols-[minmax(0,1fr)_18rem]",
        )}
      >
        <div
          className="min-w-0"
          role={tabs ? "tabpanel" : undefined}
          aria-labelledby={tabs && activeTab ? `${tablistId}-${activeTab.id}` : undefined}
        >
          {body}
        </div>
        {!fullWidth ? (
          <aside className="min-w-0 space-y-3 lg:sticky lg:top-2 lg:self-start">
            {sidebar ?? <WorkspaceSidebarPlaceholder />}
          </aside>
        ) : null}
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
