"use client";

import { Link } from "@tanstack/react-router";
import {
  INTERNAL_TERMINAL_PORTFOLIO_WORKSPACE_SEARCH,
  withInternalSiteSearch,
} from "@/lib/internal/internal-route-search";
import { RelatedRecords, type RelatedRecord } from "@/components/internal/workspace/related-records";
import { workspaceBreadcrumbs } from "@/components/internal/workspace/workspace-page";
import { RecordSinglePage } from "@/components/internal/workspace/record-workspace-page";
import {
  RecordAttentionBanner,
  RecordMoreSection,
  RecordSummaryCard,
} from "@/components/internal/workspace/record-workspace-layout";
import { WorkspaceField, WorkspaceFieldGrid } from "@/components/internal/workspace/workspace-fields";
import { StatusBadge } from "@/components/internal/status-badge";
import { florin } from "@/lib/bank/api";
import { formatActivityDateTime } from "@/lib/format-datetime";
import type { TerminalFundingTransferRow } from "@/lib/terminal/terminal-funding-types";
import { recordSectionId, type CaseRecordSearch } from "@/lib/internal/record-workspace-search";
import { parseReturnPath } from "@/lib/internal/record-return-context";

function directionLabel(direction: TerminalFundingTransferRow["direction"]): string {
  return direction === "BANK_TO_TERMINAL" ? "Bank → Terminal" : "Terminal → Bank";
}

export function TerminalFundingWorkspaceView({
  transfer,
  search,
}: {
  transfer: TerminalFundingTransferRow;
  search: CaseRecordSearch;
}) {
  const failed = transfer.status === "FAILED";
  const returnCtx = parseReturnPath(search.from);
  const breadcrumbs =
    returnCtx?.pathname === "/internal/inbox"
      ? workspaceBreadcrumbs([
          { label: "Home", to: "/internal" },
          { label: "Inbox", to: "/internal/inbox", search: returnCtx.search },
          { label: transfer.referenceCode },
        ])
      : workspaceBreadcrumbs([
          { label: "Home", to: "/internal" },
          { label: "Transfers", to: "/internal/bank/transfers" },
          { label: transfer.referenceCode },
        ]);

  const relatedRecords: RelatedRecord[] = [
    {
      kind: "bank_account",
      id: transfer.bankAccountId,
      label: transfer.bankAccountLabel,
      sublabel: transfer.bankAccountMasked,
    },
    ...(transfer.ownerCompanyId
      ? [
          {
            kind: "company" as const,
            id: transfer.ownerCompanyId,
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
    ...(transfer.bankTransactionId
      ? [
          {
            kind: "transaction" as const,
            id: transfer.bankTransactionId,
            label: "Bank transaction",
            sublabel: transfer.bankTransactionReference ?? transfer.bankTransactionId,
          },
        ]
      : []),
  ];

  return (
    <RecordSinglePage
      title={transfer.referenceCode}
      breadcrumbs={breadcrumbs}
      recordType="Terminal funding"
      primaryId={transfer.id}
      status={transfer.status}
      search={search}
      meta={
        <span className="text-[12px] text-muted-foreground">
          {directionLabel(transfer.direction)} · {florin(transfer.amount)}
        </span>
      }
    >
      <div className="space-y-3">
        {failed ? (
          <RecordAttentionBanner
            items={[
              {
                id: "funding-failed",
                label: "Funding transfer failed",
                detail:
                  transfer.failureMessage ?? "Review ledger links and retry path with support.",
                tone: "danger",
              },
            ]}
          />
        ) : null}

        <RecordSummaryCard title="Transfer" id={recordSectionId("overview")}>
          <WorkspaceFieldGrid>
            <WorkspaceField label="Status">
              <StatusBadge status={transfer.status} />
            </WorkspaceField>
            <WorkspaceField label="Direction">{directionLabel(transfer.direction)}</WorkspaceField>
            <WorkspaceField label="Amount">{florin(transfer.amount)}</WorkspaceField>
            <WorkspaceField label="Currency">{transfer.currency}</WorkspaceField>
            <WorkspaceField label="Owner">{transfer.ownerLabel}</WorkspaceField>
            <WorkspaceField label="Bank account">{transfer.bankAccountLabel}</WorkspaceField>
            <WorkspaceField label="Portfolio">
              <Link
                to="/internal/terminal/portfolios/$portfolioId"
                params={{ portfolioId: transfer.portfolioId }}
                search={withInternalSiteSearch(
                  INTERNAL_TERMINAL_PORTFOLIO_WORKSPACE_SEARCH,
                  search.site,
                )}
                className="text-gold hover:underline"
              >
                {transfer.portfolioName}
              </Link>
            </WorkspaceField>
            <WorkspaceField label="Created">{formatActivityDateTime(transfer.createdAt)}</WorkspaceField>
            {transfer.completedAt ? (
              <WorkspaceField label="Completed">
                {formatActivityDateTime(transfer.completedAt)}
              </WorkspaceField>
            ) : null}
            {transfer.failedAt ? (
              <WorkspaceField label="Failed">{formatActivityDateTime(transfer.failedAt)}</WorkspaceField>
            ) : null}
          </WorkspaceFieldGrid>
        </RecordSummaryCard>

        <RecordSummaryCard title="Lifecycle" id={recordSectionId("lifecycle")}>
          <ol className="space-y-2 text-[13px]">
            <li className="rounded-md border border-border/50 px-3 py-2">Pending · recorded</li>
            <li
              className={
                transfer.status === "COMPLETED"
                  ? "rounded-md border border-gold/40 bg-gold/5 px-3 py-2"
                  : transfer.status === "FAILED"
                    ? "rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2"
                    : "rounded-md border border-border/40 px-3 py-2 opacity-60"
              }
            >
              {transfer.status === "COMPLETED"
                ? "Completed · dual ledgers written"
                : transfer.status === "FAILED"
                  ? `Failed · ${transfer.failureMessage ?? "see failure detail"}`
                  : "Completed · awaiting"}
            </li>
          </ol>
        </RecordSummaryCard>

        <RecordSummaryCard title="Related records" id={recordSectionId("related")}>
          <RelatedRecords records={relatedRecords} site={search.site} />
        </RecordSummaryCard>

        <RecordMoreSection title="Technical details" id={recordSectionId("technical")}>
          <WorkspaceFieldGrid>
            <WorkspaceField label="Transfer id">
              <span className="font-mono text-[12px]">{transfer.id}</span>
            </WorkspaceField>
            <WorkspaceField label="Reference">
              <span className="font-mono text-[12px]">{transfer.referenceCode}</span>
            </WorkspaceField>
            <WorkspaceField label="Bank account id">
              <span className="font-mono text-[12px]">{transfer.bankAccountId}</span>
            </WorkspaceField>
            <WorkspaceField label="Portfolio id">
              <span className="font-mono text-[12px]">{transfer.portfolioId}</span>
            </WorkspaceField>
            {transfer.bankTransactionId ? (
              <WorkspaceField label="Bank transaction id">
                <span className="font-mono text-[12px]">{transfer.bankTransactionId}</span>
              </WorkspaceField>
            ) : null}
            {transfer.failureMessage ? (
              <WorkspaceField label="Failure message">{transfer.failureMessage}</WorkspaceField>
            ) : null}
          </WorkspaceFieldGrid>
        </RecordMoreSection>
      </div>
    </RecordSinglePage>
  );
}
