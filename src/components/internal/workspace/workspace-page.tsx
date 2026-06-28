"use client";

import type { ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { OpsStatusBadge } from "@/components/internal/console";
import { WorkspaceLayout, type WorkspaceTab } from "@/components/internal/console/workspace-layout";
import { buildBreadcrumbs, type InternalBreadcrumbItem } from "@/components/internal/console";

export function WorkspacePage({
  title,
  breadcrumbs,
  status,
  headerActions,
  relatedLinks,
  tabs,
  activeTabId,
  sidebar,
}: {
  title: string;
  breadcrumbs: InternalBreadcrumbItem[];
  status?: string;
  headerActions?: ReactNode;
  relatedLinks?: ReactNode;
  tabs: WorkspaceTab[];
  activeTabId: string;
  sidebar?: ReactNode;
}) {
  const navigate = useNavigate();

  function onTabChange(tabId: string) {
    void navigate({
      to: ".",
      search: (prev: Record<string, unknown>) => ({ ...prev, tab: tabId }),
      replace: true,
    });
  }

  return (
    <InternalPageShell
      title={title}
      breadcrumbs={breadcrumbs}
      actions={
        <>
          {status ? <OpsStatusBadge status={status} /> : null}
          {headerActions}
        </>
      }
    >
      <WorkspaceLayout
        title={title}
        status={status}
        showHeader={false}
        relatedLinks={relatedLinks}
        tabs={tabs}
        activeTabId={activeTabId}
        onTabChange={onTabChange}
        sidebar={sidebar}
      />
    </InternalPageShell>
  );
}

export function workspaceBreadcrumbs(segments: Array<{ label: string; to?: string }>) {
  return buildBreadcrumbs(segments);
}

export function parseWorkspaceTab(
  tab: string | undefined,
  valid: string[],
  fallback = "overview",
): string {
  if (tab && valid.includes(tab)) return tab;
  return fallback;
}
