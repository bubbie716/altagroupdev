"use client";

import { useEffect, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { buildBreadcrumbs, type InternalBreadcrumbItem } from "@/components/internal/console";
import {
  RecordWorkspaceLayout,
  type RecordWorkspaceTab,
} from "@/components/internal/workspace/record-workspace-layout";
import {
  recordSectionId,
  toRecordWorkspaceSearchParams,
  type RecordActivityFilter,
  type RecordPrimaryTab,
  type RecordWorkspaceSearch,
  type TransactionRecordSearch,
} from "@/lib/internal/record-workspace-search";
import { parseReturnPath } from "@/lib/internal/record-return-context";

function useReturnChrome(from: string | undefined, breadcrumbs: InternalBreadcrumbItem[]) {
  const returnCtx = parseReturnPath(from);

  const crumbs = returnCtx
    ? buildBreadcrumbs([
        { label: "Home", to: "/internal" },
        { label: returnCtx.label, to: returnCtx.pathname as "/" },
        ...breadcrumbs.filter((b) => b.label !== "Dashboard" && b.label !== "Home"),
      ])
    : breadcrumbs;

  const resolvedCrumbs =
    returnCtx && returnCtx.pathname === "/internal/inbox"
      ? [
          { label: "Home", to: "/internal" },
          {
            label: "Inbox",
            to: "/internal/inbox",
            search: returnCtx.search,
          } as InternalBreadcrumbItem & { search?: Record<string, string> },
          ...breadcrumbs.slice(-1),
        ]
      : crumbs;

  return { returnCtx, resolvedCrumbs };
}

export function RecordWorkspacePage({
  title,
  breadcrumbs,
  recordType,
  primaryId,
  status,
  warning,
  meta,
  headerActions,
  tabs,
  search,
}: {
  title: string;
  breadcrumbs: InternalBreadcrumbItem[];
  recordType: string;
  primaryId?: ReactNode;
  status?: string;
  warning?: ReactNode;
  meta?: ReactNode;
  headerActions?: ReactNode;
  tabs: RecordWorkspaceTab[];
  search: RecordWorkspaceSearch;
}) {
  const navigate = useNavigate();
  const { returnCtx, resolvedCrumbs } = useReturnChrome(search.from, breadcrumbs);

  useEffect(() => {
    if (!search.section) return;
    const el = document.getElementById(recordSectionId(search.section));
    if (!el) return;
    const t = window.setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      if (el instanceof HTMLDetailsElement && !el.open) {
        el.open = true;
      }
    }, 80);
    return () => window.clearTimeout(t);
  }, [search.section, search.tab]);

  function onTabChange(tabId: string) {
    const nextTab = tabId as RecordPrimaryTab;
    void navigate({
      to: ".",
      search: (prev: Record<string, unknown>) =>
        toRecordWorkspaceSearchParams({
          tab: nextTab,
          section: nextTab === search.tab ? search.section : undefined,
          filter: nextTab === "activity" ? search.filter : undefined,
          from: search.from,
          site:
            search.site ??
            (typeof prev.site === "string" && prev.site.trim() ? prev.site.trim() : undefined),
        }),
    });
  }

  return (
    <InternalPageShell title={title} breadcrumbs={resolvedCrumbs as InternalBreadcrumbItem[]}>
      {returnCtx ? (
        <div className="mb-2">
          <Link
            to={returnCtx.pathname as "/"}
            search={returnCtx.search}
            className="text-[12px] text-muted-foreground hover:text-foreground hover:underline"
          >
            ← Back to {returnCtx.label}
          </Link>
        </div>
      ) : null}
      <RecordWorkspaceLayout
        title={title}
        recordType={recordType}
        primaryId={primaryId}
        status={status}
        warning={warning}
        meta={meta}
        headerActions={headerActions}
        tabs={tabs}
        activeTabId={search.tab}
        onTabChange={onTabChange}
      />
    </InternalPageShell>
  );
}

/** Single-page record (transaction) — shared Phase 3 chrome without a tab strip. */
export function RecordSinglePage({
  title,
  breadcrumbs,
  recordType,
  primaryId,
  status,
  warning,
  meta,
  headerActions,
  search,
  children,
}: {
  title: string;
  breadcrumbs: InternalBreadcrumbItem[];
  recordType: string;
  primaryId?: ReactNode;
  status?: string;
  warning?: ReactNode;
  meta?: ReactNode;
  headerActions?: ReactNode;
  search: TransactionRecordSearch;
  children: ReactNode;
}) {
  const { returnCtx, resolvedCrumbs } = useReturnChrome(search.from, breadcrumbs);

  useEffect(() => {
    if (!search.section) return;
    const el = document.getElementById(recordSectionId(search.section));
    if (!el) return;
    const t = window.setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      if (el instanceof HTMLDetailsElement && !el.open) {
        el.open = true;
      }
    }, 80);
    return () => window.clearTimeout(t);
  }, [search.section]);

  return (
    <InternalPageShell title={title} breadcrumbs={resolvedCrumbs as InternalBreadcrumbItem[]}>
      {returnCtx ? (
        <div className="mb-2">
          <Link
            to={returnCtx.pathname as "/"}
            search={returnCtx.search}
            className="text-[12px] text-muted-foreground hover:text-foreground hover:underline"
          >
            ← Back to {returnCtx.label}
          </Link>
        </div>
      ) : null}
      <RecordWorkspaceLayout
        title={title}
        recordType={recordType}
        primaryId={primaryId}
        status={status}
        warning={warning}
        meta={meta}
        headerActions={headerActions}
      >
        {children}
      </RecordWorkspaceLayout>
    </InternalPageShell>
  );
}

export function useRecordWorkspaceNavigate(search: RecordWorkspaceSearch) {
  const navigate = useNavigate();

  return {
    setFilter(filter: RecordActivityFilter) {
      void navigate({
        to: ".",
        search: (prev: Record<string, unknown>) =>
          toRecordWorkspaceSearchParams({
            tab: "activity",
            filter,
            from: search.from,
            site:
              search.site ??
              (typeof prev.site === "string" && prev.site.trim() ? prev.site.trim() : undefined),
          }),
      });
    },
    setSection(section: string, tab: RecordPrimaryTab = "overview") {
      void navigate({
        to: ".",
        search: (prev: Record<string, unknown>) =>
          toRecordWorkspaceSearchParams({
            tab,
            section,
            from: search.from,
            site:
              search.site ??
              (typeof prev.site === "string" && prev.site.trim() ? prev.site.trim() : undefined),
          }),
      });
    },
  };
}
