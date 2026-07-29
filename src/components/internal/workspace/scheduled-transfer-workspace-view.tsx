"use client";

import { useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import {
  INTERNAL_ACCOUNT_WORKSPACE_SEARCH,
  INTERNAL_COMPANY_WORKSPACE_SEARCH,
  INTERNAL_TRANSACTION_WORKSPACE_SEARCH,
  INTERNAL_USER_WORKSPACE_SEARCH,
  withInternalSiteSearch,
} from "@/lib/internal/internal-route-search";
import { RelatedRecords, type RelatedRecord } from "@/components/internal/workspace/related-records";
import { workspaceBreadcrumbs } from "@/components/internal/workspace/workspace-page";
import { RecordSinglePage } from "@/components/internal/workspace/record-workspace-page";
import {
  RecordAttentionBanner,
  RecordEmptyCopy,
  RecordMoreSection,
  RecordSummaryCard,
} from "@/components/internal/workspace/record-workspace-layout";
import {
  RecordActionGroup,
  RecordActionsSheet,
} from "@/components/internal/workspace/record-actions-sheet";
import { WorkspaceField, WorkspaceFieldGrid } from "@/components/internal/workspace/workspace-fields";
import { StatusBadge } from "@/components/internal/status-badge";
import { florin } from "@/lib/bank/api";
import { formatActivityDateTime } from "@/lib/format-datetime";
import type { InternalScheduledTransferDetail } from "@/lib/bank/ui-lab-money-ops-fixtures";
import {
  cancelInternalScheduledTransferRecord,
  pauseInternalScheduledTransferRecord,
  resumeInternalScheduledTransferRecord,
  runInternalScheduledTransferNowRecord,
} from "@/lib/bank/scheduled-transfer-admin.functions";
import {
  TRANSFER_ACTION_LABELS,
  availableTransferActions,
  buildTransferLifecycle,
  plainTransferStatusLabel,
  plainTransferTypeTitle,
  primaryTransferAttentionActions,
  transferAttentionCopy,
  transferAttentionLabel,
  transferNeedsAttention,
  type TransferActionKind,
} from "@/lib/internal/transfer-record-copy";
import { recordSectionId, type CaseRecordSearch } from "@/lib/internal/record-workspace-search";
import { parseReturnPath } from "@/lib/internal/record-return-context";
import { useUiLabMutationGate } from "@/lib/internal/ui-lab-mutation-gate";

const RESOLVED_STATUSES = new Set(["executed", "cancelled", "rejected"]);

function lifecycleStateClass(state: "complete" | "current" | "upcoming" | "skipped") {
  if (state === "current") return "border-gold/40 bg-gold/5";
  if (state === "skipped") return "border-border/40 opacity-60";
  if (state === "upcoming") return "border-border/40";
  return "border-border/50";
}

export function ScheduledTransferWorkspaceView({
  transfer,
  search,
}: {
  transfer: InternalScheduledTransferDetail;
  search: CaseRecordSearch;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const { uiLab, unavailableLabel } = useUiLabMutationGate();
  const title = plainTransferTypeTitle(transfer);
  const statusLabel = plainTransferStatusLabel(transfer.status, transfer.statusLabel);
  const lifecycle = buildTransferLifecycle(transfer);
  const needsAttention = transferNeedsAttention(transfer);
  const attentionCopy = transferAttentionCopy(transfer);
  const isResolved = RESOLVED_STATUSES.has(transfer.status);
  const allActions = isResolved ? [] : availableTransferActions(transfer);
  const attentionActions = needsAttention ? primaryTransferAttentionActions(transfer) : [];
  const sheetActions = needsAttention
    ? allActions.filter((a) => !attentionActions.includes(a))
    : allActions;

  const resultingTxIds = [
    ...new Set(
      transfer.executions
        .map((e) => e.bankTransactionId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const relatedRecords: RelatedRecord[] = [
    {
      kind: "bank_account",
      id: transfer.sourceAccountId,
      label: transfer.sourceAccountNumber,
      sublabel: transfer.sourceAccountName,
    },
    ...(transfer.companyId
      ? [
          {
            kind: "company" as const,
            id: transfer.companyId,
            label: transfer.ownerLabel,
          },
        ]
      : transfer.ownerUserId
        ? [
            {
              kind: "user" as const,
              id: transfer.ownerUserId,
              label: transfer.ownerLabel,
            },
          ]
        : []),
    ...resultingTxIds.map((id) => ({
      kind: "transaction" as const,
      id,
      label: "Resulting transaction",
      sublabel: id,
    })),
  ];

  const returnCtx = parseReturnPath(search.from);
  const breadcrumbs =
    returnCtx?.pathname === "/internal/inbox"
      ? workspaceBreadcrumbs([
          { label: "Home", to: "/internal" },
          { label: "Inbox", to: "/internal/inbox", search: returnCtx.search },
          { label: transfer.label },
        ])
      : workspaceBreadcrumbs([
          { label: "Home", to: "/internal" },
          { label: "Transfers", to: "/internal/bank/transfers" },
          { label: transfer.label },
        ]);

  async function runAction(kind: TransferActionKind) {
    if (uiLab) return;
    setPending(true);
    try {
      if (kind === "pause") await pauseInternalScheduledTransferRecord({ data: transfer.id });
      else if (kind === "resume") await resumeInternalScheduledTransferRecord({ data: transfer.id });
      else if (kind === "cancel") await cancelInternalScheduledTransferRecord({ data: transfer.id });
      else await runInternalScheduledTransferNowRecord({ data: transfer.id });
      await router.invalidate();
    } finally {
      setPending(false);
    }
  }

  function renderActionButton(kind: TransferActionKind, compact = false) {
    const label = TRANSFER_ACTION_LABELS[kind];
    if (uiLab) {
      return (
        <button
          key={kind}
          type="button"
          disabled
          className={
            compact
              ? "rounded border border-border px-2.5 py-1.5 text-left text-[12px] text-muted-foreground disabled:opacity-60"
              : "rounded border border-border bg-surface-2 px-2.5 py-1.5 text-[12px] text-muted-foreground disabled:opacity-60"
          }
        >
          {unavailableLabel(label)}
        </button>
      );
    }
    return (
      <button
        key={kind}
        type="button"
        disabled={pending}
        className={
          kind === "cancel"
            ? compact
              ? "rounded border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 text-left text-[12px] text-destructive disabled:opacity-50"
              : "rounded border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 text-[12px] text-destructive disabled:opacity-50"
            : kind === "run_now"
              ? compact
                ? "rounded border border-gold/30 bg-gold/5 px-2.5 py-1.5 text-left text-[12px] text-gold disabled:opacity-50"
                : "rounded border border-gold/30 bg-gold/5 px-2.5 py-1.5 text-[12px] text-gold disabled:opacity-50"
              : compact
                ? "rounded border border-border px-2.5 py-1.5 text-left text-[12px] hover:border-border-strong disabled:opacity-50"
                : "rounded border border-border bg-surface-2 px-2.5 py-1.5 text-[12px] disabled:opacity-50"
        }
        onClick={() => void runAction(kind)}
      >
        {label}
      </button>
    );
  }

  const headerActions =
    sheetActions.length > 0 || returnCtx?.pathname === "/internal/inbox" || allActions.length > 0 ? (
      <RecordActionsSheet
        title="Transfer actions"
        description={`${title} · ${transfer.label}`}
        footer={
          returnCtx?.pathname === "/internal/inbox" ? (
            <Link
              to="/internal/inbox"
              search={returnCtx.search}
              className="inline-flex h-8 w-full items-center justify-center rounded border border-border text-[12px] hover:border-border-strong"
            >
              Return to Inbox
            </Link>
          ) : null
        }
      >
        {sheetActions.length > 0 ? (
          <RecordActionGroup title="Administration">
            <div className="flex flex-col gap-1.5">
              {sheetActions.map((kind) => renderActionButton(kind, true))}
            </div>
          </RecordActionGroup>
        ) : needsAttention && attentionActions.length > 0 ? (
          <RecordActionGroup title="Note">
            <p className="text-[12px] text-muted-foreground">
              Primary controls are in the attention panel on this page.
              {uiLab ? ` ${unavailableLabel("Mutations")}.` : ""}
            </p>
          </RecordActionGroup>
        ) : null}
        <RecordActionGroup title="Related">
          <div className="flex flex-col gap-1.5">
            <Link
              to="/internal/bank/accounts/$accountId"
              params={{ accountId: transfer.sourceAccountId }}
              search={withInternalSiteSearch(INTERNAL_ACCOUNT_WORKSPACE_SEARCH, search.site)}
              className="text-[12px] text-gold hover:underline"
            >
              Open source account
            </Link>
            {transfer.companyId ? (
              <Link
                to="/internal/companies/$companyId"
                params={{ companyId: transfer.companyId }}
                search={withInternalSiteSearch(INTERNAL_COMPANY_WORKSPACE_SEARCH, search.site)}
                className="text-[12px] text-gold hover:underline"
              >
                Open company
              </Link>
            ) : null}
            {transfer.ownerUserId ? (
              <Link
                to="/internal/users/$userId"
                params={{ userId: transfer.ownerUserId }}
                search={withInternalSiteSearch(INTERNAL_USER_WORKSPACE_SEARCH, search.site)}
                className="text-[12px] text-gold hover:underline"
              >
                Open customer
              </Link>
            ) : null}
          </div>
        </RecordActionGroup>
      </RecordActionsSheet>
    ) : null;

  return (
    <RecordSinglePage
      title={title}
      breadcrumbs={breadcrumbs}
      recordType="Scheduled transfer"
      primaryId={
        <>
          {florin(transfer.amount)} · {transfer.label}
        </>
      }
      status={statusLabel}
      meta={
        <>
          <span className="font-mono">{transfer.id}</span>
          <span className="font-mono">{formatActivityDateTime(transfer.createdAt)}</span>
        </>
      }
      warning={
        needsAttention ? (
          <span className="text-[12px] text-amber-700 dark:text-amber-300">Needs attention</span>
        ) : null
      }
      headerActions={headerActions}
      search={search}
    >
      <div className="space-y-3">
        {needsAttention && attentionCopy ? (
          <RecordAttentionBanner
            items={[
              {
                id: "transfer-attention",
                label: transferAttentionLabel(transfer) ?? "Action needed",
                detail: attentionCopy,
                tone: transfer.status === "failed" ? "danger" : "warning",
              },
            ]}
          />
        ) : null}

        {attentionActions.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 rounded border border-border/80 bg-surface-1/40 px-3 py-3">
            <p className="w-full text-[12px] text-muted-foreground">
              Resolve this transfer from here.
              {uiLab ? ` ${unavailableLabel("Mutations")} — UI Lab does not submit live changes.` : ""}
            </p>
            {attentionActions.map((kind) => renderActionButton(kind))}
          </div>
        ) : null}

        <RecordSummaryCard title="Summary" id={recordSectionId("summary")}>
          <WorkspaceFieldGrid columns={3}>
            <WorkspaceField label="Amount">
              <span className="type-finance tabular-nums text-[14px]">{florin(transfer.amount)}</span>
            </WorkspaceField>
            <WorkspaceField label="Status">
              <StatusBadge status={statusLabel} />
            </WorkspaceField>
            <WorkspaceField label="Frequency">{transfer.frequencyLabel}</WorkspaceField>
            <WorkspaceField label="Label">{transfer.label}</WorkspaceField>
            <WorkspaceField label="Owner">
              {transfer.companyId ? (
                <Link
                  to="/internal/companies/$companyId"
                  params={{ companyId: transfer.companyId }}
                  search={withInternalSiteSearch(INTERNAL_COMPANY_WORKSPACE_SEARCH, search.site)}
                  className="hover:text-gold"
                >
                  {transfer.ownerLabel}
                </Link>
              ) : transfer.ownerUserId ? (
                <Link
                  to="/internal/users/$userId"
                  params={{ userId: transfer.ownerUserId }}
                  search={withInternalSiteSearch(INTERNAL_USER_WORKSPACE_SEARCH, search.site)}
                  className="hover:text-gold"
                >
                  {transfer.ownerLabel}
                </Link>
              ) : (
                transfer.ownerLabel
              )}
            </WorkspaceField>
            <WorkspaceField label="Next run">
              <span className="font-mono text-[11px]">
                {transfer.nextRunAt ? formatActivityDateTime(transfer.nextRunAt) : "—"}
              </span>
            </WorkspaceField>
            {transfer.memo ? (
              <WorkspaceField label="Memo" className="sm:col-span-2 lg:col-span-3">
                {transfer.memo}
              </WorkspaceField>
            ) : null}
          </WorkspaceFieldGrid>
        </RecordSummaryCard>

        <RecordSummaryCard title="From / To" id={recordSectionId("from-to")}>
          <WorkspaceFieldGrid columns={2}>
            <WorkspaceField label="From">
              <Link
                to="/internal/bank/accounts/$accountId"
                params={{ accountId: transfer.sourceAccountId }}
                search={withInternalSiteSearch(INTERNAL_ACCOUNT_WORKSPACE_SEARCH, search.site)}
                className="font-mono text-[11px] text-gold hover:underline"
              >
                {transfer.sourceAccountNumber}
              </Link>
              <div className="text-[12px] text-muted-foreground">{transfer.sourceAccountName}</div>
            </WorkspaceField>
            <WorkspaceField label="To">
              <span className="font-mono text-[11px]">
                {transfer.destinationAccountNumber ?? "—"}
              </span>
              <div className="text-[12px] text-muted-foreground">{transfer.destinationName}</div>
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
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-medium">{stage.label}</span>
                  {stage.state === "current" ? (
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-gold">
                      Current
                    </span>
                  ) : null}
                </div>
                {stage.detail ? (
                  <p className="mt-0.5 text-[12px] text-muted-foreground">{stage.detail}</p>
                ) : null}
                {stage.at ? (
                  <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                    {formatActivityDateTime(stage.at)}
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
        </RecordSummaryCard>

        <RecordSummaryCard title="Executions" id={recordSectionId("executions")}>
          <p className="mb-2 text-[12px] text-muted-foreground">
            Schedule is the recurring plan; each row is an execution attempt. Linked bank transactions are
            the resulting ledger entries.
          </p>
          {transfer.executions.length === 0 ? (
            <RecordEmptyCopy>No executions yet.</RecordEmptyCopy>
          ) : (
            <ul className="space-y-2">
              {transfer.executions.map((exec) => (
                <li key={exec.id} className="rounded border border-border/50 px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[13px] font-medium">{exec.statusLabel}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      Scheduled {formatActivityDateTime(exec.scheduledRunAt)}
                    </span>
                  </div>
                  {exec.executedAt ? (
                    <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                      Executed {formatActivityDateTime(exec.executedAt)}
                    </p>
                  ) : null}
                  {exec.transferReferenceCode ? (
                    <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                      Ref {exec.transferReferenceCode}
                    </p>
                  ) : null}
                  {exec.failureReason ? (
                    <p className="mt-1 text-[12px] text-amber-700 dark:text-amber-300">
                      {exec.failureReason}
                    </p>
                  ) : null}
                  {exec.bankTransactionId ? (
                    <Link
                      to="/internal/bank/transactions/$transactionId"
                      params={{ transactionId: exec.bankTransactionId }}
                      search={withInternalSiteSearch(INTERNAL_TRANSACTION_WORKSPACE_SEARCH, search.site)}
                      className="mt-1 inline-block text-[12px] text-gold hover:underline"
                    >
                      Resulting transaction →
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </RecordSummaryCard>

        <RecordSummaryCard title="Related records" id={recordSectionId("related")}>
          <RelatedRecords records={relatedRecords} site={search.site} />
        </RecordSummaryCard>

        <div className="space-y-2">
          <RecordMoreSection
            id={recordSectionId("technical")}
            title="Technical details"
            defaultOpen={search.section === "technical"}
          >
            <WorkspaceFieldGrid columns={2}>
              <WorkspaceField label="Transfer ID">
                <span className="break-all font-mono text-[11px]">{transfer.id}</span>
              </WorkspaceField>
              <WorkspaceField label="Payment type">
                <span className="font-mono text-[11px]">{transfer.paymentType}</span>
              </WorkspaceField>
              <WorkspaceField label="Scope">
                <span className="font-mono text-[11px]">{transfer.transferScope}</span>
              </WorkspaceField>
              <WorkspaceField label="Raw status">
                <span className="font-mono text-[11px]">{transfer.status}</span>
              </WorkspaceField>
              <WorkspaceField label="Frequency code">
                <span className="font-mono text-[11px]">{transfer.frequency}</span>
              </WorkspaceField>
              <WorkspaceField label="Source account ID">
                <span className="break-all font-mono text-[11px]">{transfer.sourceAccountId}</span>
              </WorkspaceField>
              {transfer.destinationAccountId ? (
                <WorkspaceField label="Destination account ID">
                  <span className="break-all font-mono text-[11px]">
                    {transfer.destinationAccountId}
                  </span>
                </WorkspaceField>
              ) : null}
              {transfer.consecutiveFailures > 0 ? (
                <WorkspaceField label="Consecutive failures">
                  {transfer.consecutiveFailures}
                </WorkspaceField>
              ) : null}
            </WorkspaceFieldGrid>
          </RecordMoreSection>
        </div>
      </div>
    </RecordSinglePage>
  );
}
