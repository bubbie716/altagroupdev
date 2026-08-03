"use client";

import { useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import {
  INTERNAL_COMPANY_WORKSPACE_SEARCH,
  INTERNAL_TERMINAL_PORTFOLIO_WORKSPACE_SEARCH,
  INTERNAL_USER_WORKSPACE_SEARCH,
  withInternalSiteSearch,
} from "@/lib/internal/internal-route-search";
import { StatusBadge } from "@/components/internal/status-badge";
import { workspaceBreadcrumbs } from "@/components/internal/workspace/workspace-page";
import { RecordSinglePage } from "@/components/internal/workspace/record-workspace-page";
import {
  RecordAttentionBanner,
  RecordMoreSection,
  RecordSummaryCard,
} from "@/components/internal/workspace/record-workspace-layout";
import {
  RecordActionGroup,
  RecordActionsSheet,
} from "@/components/internal/workspace/record-actions-sheet";
import { WorkspaceField, WorkspaceFieldGrid } from "@/components/internal/workspace/workspace-fields";
import { isUiLabMode } from "@/lib/auth/ui-lab";
import { formatActivityDateTime } from "@/lib/format-datetime";
import { parseReturnPath } from "@/lib/internal/record-return-context";
import { recordSectionId, type CaseRecordSearch } from "@/lib/internal/record-workspace-search";
import { formatTerminalMoney } from "@/lib/terminal/format";
import { orderFillProgressLabel } from "@/lib/terminal/terminal-desk";
import { cancelTerminalOpsOrder } from "@/lib/terminal/terminal-ops.functions";
import { resolveTerminalOpsEnvironmentStatus } from "@/lib/terminal/terminal-ops-environment";
import {
  availableOrderActions,
  buildOrderLifecycle,
  plainOrderSideLabel,
  plainOrderStatusLabel,
  plainOrderTypeLabel,
  type TerminalOpsOrderRow,
} from "@/lib/terminal/terminal-ops-types";
import { refreshMutationRouteData } from "@/lib/router/post-mutation-refresh";

function lifecycleStateClass(state: "complete" | "current" | "upcoming" | "skipped") {
  if (state === "current") return "border-gold/40 bg-gold/5";
  if (state === "skipped") return "border-border/40 opacity-60";
  if (state === "upcoming") return "border-border/40";
  return "border-border/50";
}

export function TerminalOrderWorkspaceView({
  order,
  search,
}: {
  order: TerminalOpsOrderRow;
  search: CaseRecordSearch;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const uiLab = isUiLabMode();
  const env = resolveTerminalOpsEnvironmentStatus();
  const statusLabel = plainOrderStatusLabel(order.status);
  const lifecycle = buildOrderLifecycle(order);
  const canCancel =
    !uiLab && availableOrderActions(order, env.ordersMutable).includes("cancel");
  const fillLabel = orderFillProgressLabel(order);
  const isRejected = order.status === "rejected" || Boolean(order.rejectReason);

  const returnCtx = parseReturnPath(search.from);
  const breadcrumbs =
    returnCtx?.pathname === "/internal/terminal/inbox" || returnCtx?.pathname === "/internal/inbox"
      ? workspaceBreadcrumbs([
          { label: "Home", to: "/internal" },
          {
            label: returnCtx.pathname.includes("terminal") ? "Terminal Inbox" : "Inbox",
            to: returnCtx.pathname as "/",
            search: returnCtx.search,
          },
          { label: `${order.symbol} order` },
        ])
      : workspaceBreadcrumbs([
          { label: "Home", to: "/internal" },
          { label: "Orders", to: "/internal/terminal/orders" },
          { label: `${order.symbol} order` },
        ]);

  async function runCancel() {
    if (uiLab || !canCancel) return;
    setPending(true);
    setActionError(null);
    try {
      await cancelTerminalOpsOrder({ data: order.id });
      await refreshMutationRouteData(router, "terminal");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Cancel failed");
    } finally {
      setPending(false);
    }
  }

  const headerActions = canCancel ? (
    <RecordActionsSheet
      title="Order actions"
      description={`${plainOrderSideLabel(order.side)} ${order.symbol}`}
      footer={
        returnCtx?.pathname.includes("inbox") ? (
          <Link
            to={returnCtx.pathname as "/"}
            search={returnCtx.search}
            className="inline-flex h-8 w-full items-center justify-center rounded border border-border text-[12px] hover:border-border-strong"
          >
            Return to Inbox
          </Link>
        ) : null
      }
    >
      <RecordActionGroup title="Controls">
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            disabled={pending}
            className="rounded border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 text-left text-[12px] text-destructive disabled:opacity-50"
            onClick={() => void runCancel()}
          >
            Cancel order
          </button>
          {actionError ? (
            <p className="text-[11px] text-destructive">{actionError.replace(/^BAD_REQUEST:/, "")}</p>
          ) : null}
        </div>
      </RecordActionGroup>
    </RecordActionsSheet>
  ) : null;

  return (
    <RecordSinglePage
      title={`${plainOrderSideLabel(order.side)} ${order.symbol}`}
      breadcrumbs={breadcrumbs}
      recordType="Terminal order"
      primaryId={
        <>
          {plainOrderTypeLabel(order.type)} · {fillLabel}
        </>
      }
      status={statusLabel}
      meta={
        <>
          <span className="font-mono">{order.id}</span>
          <span>{order.portfolioName}</span>
          <span className="font-mono">{formatActivityDateTime(order.submittedAt)}</span>
        </>
      }
      warning={
        order.needsAttention || isRejected ? (
          <span className="text-[12px] text-amber-700 dark:text-amber-300">Needs attention</span>
        ) : null
      }
      headerActions={headerActions}
      search={search}
    >
      <div className="space-y-3">
        {isRejected || order.needsAttention ? (
          <RecordAttentionBanner
            items={[
              {
                id: "order-attention",
                label: statusLabel,
                detail: order.rejectReason ?? "This order needs review.",
              },
            ]}
          />
        ) : null}

        {isRejected && order.rejectReason ? (
          <RecordSummaryCard title="Failure reason" id={recordSectionId("failure")}>
            <p className="text-[14px] font-medium text-destructive">{order.rejectReason}</p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              {plainOrderSideLabel(order.side)} {order.symbol} was rejected and cannot be cancelled
              from this console.
            </p>
          </RecordSummaryCard>
        ) : null}

        <RecordSummaryCard title="Order" id={recordSectionId("summary")}>
          <WorkspaceFieldGrid columns={3}>
            <WorkspaceField label="Side / symbol">
              {plainOrderSideLabel(order.side)}{" "}
              <span className="font-mono font-medium">{order.symbol}</span>
            </WorkspaceField>
            <WorkspaceField label="Security">{order.name}</WorkspaceField>
            <WorkspaceField label="Status">
              <StatusBadge status={statusLabel} />
            </WorkspaceField>
            <WorkspaceField label="Type">{plainOrderTypeLabel(order.type)}</WorkspaceField>
            <WorkspaceField label="Quantity / fill">
              <span className="tabular-nums">{fillLabel}</span>
            </WorkspaceField>
            <WorkspaceField label="Investor">{order.investorLabel}</WorkspaceField>
            <WorkspaceField label="Portfolio">
              <Link
                to="/internal/terminal/portfolios/$portfolioId"
                params={{ portfolioId: order.portfolioId }}
                search={withInternalSiteSearch(
                  { ...INTERNAL_TERMINAL_PORTFOLIO_WORKSPACE_SEARCH, from: search.from },
                  search.site,
                )}
                className="hover:text-gold"
              >
                {order.portfolioName}
              </Link>
            </WorkspaceField>
            {order.type === "limit" && order.limitPrice != null ? (
              <WorkspaceField label="Limit price">
                <span className="tabular-nums">{formatTerminalMoney(order.limitPrice)}</span>
              </WorkspaceField>
            ) : null}
            <WorkspaceField label="Avg fill">
              <span className="tabular-nums">
                {order.averageFillPrice != null
                  ? formatTerminalMoney(order.averageFillPrice)
                  : "—"}
              </span>
            </WorkspaceField>
            <WorkspaceField label="Estimated value">
              <span className="tabular-nums">{formatTerminalMoney(order.estimatedValue)}</span>
            </WorkspaceField>
          </WorkspaceFieldGrid>
        </RecordSummaryCard>

        <RecordSummaryCard title="Lifecycle" id={recordSectionId("lifecycle")}>
          <ol className="space-y-2">
            {lifecycle.map((stage) => (
              <li
                key={stage.id}
                className={`rounded border px-3 py-2 ${lifecycleStateClass(stage.state)}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[13px] font-medium">{stage.label}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    {stage.state}
                  </span>
                </div>
                {stage.at ? (
                  <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                    {formatActivityDateTime(stage.at)}
                  </div>
                ) : null}
                {stage.detail ? (
                  <p className="mt-1 text-[12px] text-muted-foreground">{stage.detail}</p>
                ) : null}
              </li>
            ))}
          </ol>
        </RecordSummaryCard>

        <RecordSummaryCard title="Related" id={recordSectionId("related")}>
          <div className="flex flex-col gap-1.5 text-[12px]">
            <Link
              to="/internal/terminal/portfolios/$portfolioId"
              params={{ portfolioId: order.portfolioId }}
              search={withInternalSiteSearch(
                { ...INTERNAL_TERMINAL_PORTFOLIO_WORKSPACE_SEARCH, from: search.from },
                search.site,
              )}
              className="text-gold hover:underline"
            >
              Portfolio · {order.portfolioName}
            </Link>
            {order.ownerUserId ? (
              <Link
                to="/internal/users/$userId"
                params={{ userId: order.ownerUserId }}
                search={withInternalSiteSearch(
                  { ...INTERNAL_USER_WORKSPACE_SEARCH, section: "terminal", from: search.from },
                  search.site,
                )}
                className="text-gold hover:underline"
              >
                Investor · {order.investorLabel}
              </Link>
            ) : null}
            {order.ownerCompanyId ? (
              <Link
                to="/internal/companies/$companyId"
                params={{ companyId: order.ownerCompanyId }}
                search={withInternalSiteSearch(
                  { ...INTERNAL_COMPANY_WORKSPACE_SEARCH, section: "terminal", from: search.from },
                  search.site,
                )}
                className="text-gold hover:underline"
              >
                Company · {order.investorLabel}
              </Link>
            ) : null}
          </div>
        </RecordSummaryCard>

        <RecordMoreSection
          id={recordSectionId("technical")}
          title="Technical"
          defaultOpen={search.section === "technical"}
        >
          <WorkspaceFieldGrid columns={2}>
            <WorkspaceField label="Order ID">
              <span className="break-all font-mono text-[11px]">{order.id}</span>
            </WorkspaceField>
            <WorkspaceField label="Portfolio ID">
              <span className="break-all font-mono text-[11px]">{order.portfolioId}</span>
            </WorkspaceField>
            <WorkspaceField label="Updated">
              <span className="font-mono text-[11px]">
                {formatActivityDateTime(order.updatedAt)}
              </span>
            </WorkspaceField>
            <WorkspaceField label="Environment">
              {env.isDemonstration ? "Demonstration" : env.label}
            </WorkspaceField>
          </WorkspaceFieldGrid>
        </RecordMoreSection>
      </div>
    </RecordSinglePage>
  );
}
