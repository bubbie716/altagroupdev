"use client";

import { Link, useNavigate } from "@tanstack/react-router";
import { INTERNAL_ACCOUNT_WORKSPACE_SEARCH, withInternalSiteSearch } from "@/lib/internal/internal-route-search";
import { InternalAuditTable } from "@/components/internal/internal-audit-table";
import { TransactionWorkspaceActions } from "@/components/internal/transaction-workspace-actions";
import { OpsReviewFlagsBanner } from "@/components/internal/ops-review-flags-banner";
import { OpsReviewFlagsPanel } from "@/components/internal/ops-review-flags-panel";
import { WorkspaceAuditLink } from "@/components/internal/workspace/workspace-audit-link";
import { InternalNotePanel } from "@/components/internal/internal-note-panel";
import { RelatedRecords, type RelatedRecord } from "@/components/internal/workspace/related-records";
import { workspaceBreadcrumbs } from "@/components/internal/workspace/workspace-page";
import { RecordSinglePage } from "@/components/internal/workspace/record-workspace-page";
import {
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
import type { OpsReviewFlagRow } from "@/lib/internal/ops-review-flag.types";
import type { InternalNoteRow } from "@/lib/internal/internal-note.types";
import {
  recordSectionId,
  toTransactionRecordSearchParams,
  type TransactionRecordSearch,
} from "@/lib/internal/record-workspace-search";
import { parseReturnPath } from "@/lib/internal/record-return-context";
import {
  buildTransactionLifecycle,
  plainTransactionTypeTitle,
  transactionDirectionLabel,
} from "@/lib/internal/transaction-record-copy";

type TransactionDetail = Awaited<
  ReturnType<typeof import("@/lib/internal/ops-platform.functions").fetchTransactionDetail>
>;

export function TransactionWorkspaceView({
  tx,
  audit,
  notes,
  search,
  reviewFlags = [],
}: {
  tx: TransactionDetail;
  audit: import("@/lib/internal/audit.types").AuditLogRow[];
  notes: InternalNoteRow[];
  search: TransactionRecordSearch;
  reviewFlags?: OpsReviewFlagRow[];
}) {
  const navigate = useNavigate();
  const activeFlags = reviewFlags.filter((f) => f.status === "ACTIVE");
  const title = plainTransactionTypeTitle(tx.type, tx.description);
  const direction = transactionDirectionLabel(tx.type, tx.description);
  const lifecycle = buildTransactionLifecycle(tx);
  const isPending = tx.status.toUpperCase() === "PENDING";
  const hasActions =
    isPending ||
    (tx.type.toUpperCase() === "ADJUSTMENT" &&
      tx.status.toUpperCase() === "APPROVED" &&
      Boolean(tx.canReverseAdjustment));

  const relatedRecords: RelatedRecord[] = [
    { kind: "bank_account", id: tx.accountId, label: tx.accountNumber, sublabel: tx.holder },
    ...(tx.relatedLoanId ? [{ kind: "loan" as const, id: tx.relatedLoanId, label: "Related loan" }] : []),
    ...(tx.relatedAltaPayRef
      ? [{ kind: "alta_pay" as const, id: tx.relatedAltaPayRef, label: "Alta Pay", sublabel: tx.relatedAltaPayRef }]
      : []),
    ...tx.linkedTransactions.map((l) => ({
      kind: "transaction" as const,
      id: l.id,
      label: l.referenceCode,
      sublabel: plainTransactionTypeTitle(l.type),
    })),
  ];

  const returnCtx = parseReturnPath(search.from);
  const breadcrumbs =
    returnCtx?.pathname === "/internal/inbox"
      ? workspaceBreadcrumbs([
          { label: "Home", to: "/internal" },
          { label: "Inbox", to: "/internal/inbox", search: returnCtx.search },
          { label: tx.referenceCode },
        ])
      : returnCtx?.pathname.startsWith("/internal/bank/accounts")
        ? workspaceBreadcrumbs([
            { label: "Home", to: "/internal" },
            { label: "Accounts", to: "/internal/bank/accounts" },
            { label: tx.accountNumber, to: returnCtx.pathname, search: returnCtx.search },
            { label: tx.referenceCode },
          ])
        : workspaceBreadcrumbs([
            { label: "Home", to: "/internal" },
            { label: "Transactions", to: "/internal/bank/transactions" },
            { label: tx.referenceCode },
          ]);

  const actions =
    hasActions || returnCtx?.pathname === "/internal/inbox" ? (
      <RecordActionsSheet
        title="Transaction actions"
        description={`${title} · ${tx.referenceCode}`}
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
        {/* Decision controls live in the page body — do not duplicate approve/deny here. */}
        {hasActions && !isPending ? (
          <RecordActionGroup title="Resolve">
            <TransactionWorkspaceActions tx={tx} layout="inline" />
          </RecordActionGroup>
        ) : null}
        <RecordActionGroup title="Related">
          <div className="flex flex-col gap-1.5">
            <Link
              to="/internal/bank/accounts/$accountId"
              params={{ accountId: tx.accountId }}
              search={withInternalSiteSearch(INTERNAL_ACCOUNT_WORKSPACE_SEARCH, search.site)}
              className="text-[12px] text-gold hover:underline"
            >
              Open account
            </Link>
            <button
              type="button"
              className="rounded border border-border px-2.5 py-1.5 text-left text-[12px] hover:border-border-strong"
              onClick={() =>
                void navigate({
                  to: ".",
                  search: () =>
                    toTransactionRecordSearchParams({
                      section: "notes",
                      from: search.from,
                    }),
                })
              }
            >
              Add internal note
            </button>
          </div>
        </RecordActionGroup>
      </RecordActionsSheet>
    ) : null;

  return (
    <>
      <OpsReviewFlagsBanner flags={activeFlags} />
      <RecordSinglePage
        title={title}
        breadcrumbs={breadcrumbs}
        recordType="Transaction"
        primaryId={
          <>
            {florin(tx.amount)}
            {direction ? ` · ${direction}` : ""}
          </>
        }
        status={tx.status}
        meta={
          <>
            <span className="font-mono">{tx.referenceCode}</span>
            <span className="font-mono">{formatActivityDateTime(tx.createdAt)}</span>
          </>
        }
        warning={
          isPending ? (
            <span className="text-[12px] text-amber-700 dark:text-amber-300">Needs a decision</span>
          ) : activeFlags.length > 0 ? (
            <span className="text-[12px] text-amber-700 dark:text-amber-300">
              {activeFlags.length} review flag(s)
            </span>
          ) : null
        }
        headerActions={actions}
        search={search}
      >
        <div className="space-y-3">
          {hasActions ? <TransactionWorkspaceActions tx={tx} layout="panel" /> : null}

          {!isPending && tx.reviewedAt ? (
            <RecordSummaryCard title="Resolution">
              <p className="text-[12px] text-muted-foreground">
                Resolved {formatActivityDateTime(tx.reviewedAt)}
                {tx.reviewedByLabel ? ` by ${tx.reviewedByLabel}` : ""}
                {tx.reviewNote ? ` — ${tx.reviewNote}` : ""}
              </p>
            </RecordSummaryCard>
          ) : null}

          <RecordSummaryCard title="Summary" id={recordSectionId("summary")}>
            <WorkspaceFieldGrid columns={3}>
              <WorkspaceField label="Amount">
                <span className="type-finance tabular-nums text-[14px]">{florin(tx.amount)}</span>
              </WorkspaceField>
              <WorkspaceField label="Status">
                <StatusBadge status={tx.status} />
              </WorkspaceField>
              {direction ? <WorkspaceField label="Direction">{direction}</WorkspaceField> : null}
              <WorkspaceField label="Account">
                <Link
                  to="/internal/bank/accounts/$accountId"
                  params={{ accountId: tx.accountId }}
                  search={withInternalSiteSearch(INTERNAL_ACCOUNT_WORKSPACE_SEARCH, search.site)}
                  className="font-mono text-[11px] text-gold hover:underline"
                >
                  {tx.accountNumber}
                </Link>
              </WorkspaceField>
              <WorkspaceField label="Customer">{tx.holder}</WorkspaceField>
              <WorkspaceField label="Created">
                <span className="font-mono text-[11px]">{formatActivityDateTime(tx.createdAt)}</span>
              </WorkspaceField>
              {tx.reviewedAt ? (
                <WorkspaceField label="Completed">
                  <span className="font-mono text-[11px]">{formatActivityDateTime(tx.reviewedAt)}</span>
                </WorkspaceField>
              ) : null}
              <WorkspaceField label="Reference">
                <span className="break-all font-mono text-[11px]">{tx.referenceCode}</span>
              </WorkspaceField>
              {tx.description ? (
                <WorkspaceField label="Description" className="sm:col-span-2 lg:col-span-3">
                  {tx.description}
                </WorkspaceField>
              ) : null}
              {tx.memo ? (
                <WorkspaceField label="Memo" className="sm:col-span-2 lg:col-span-3">
                  {tx.memo}
                </WorkspaceField>
              ) : null}
              {tx.reviewNote && isPending === false ? (
                <WorkspaceField label="Review note" className="sm:col-span-2 lg:col-span-3">
                  {tx.reviewNote}
                </WorkspaceField>
              ) : null}
            </WorkspaceFieldGrid>
            {tx.proofImageUrl ? (
              <div className="mt-3">
                <a
                  href={tx.proofImageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[12px] text-gold hover:underline"
                >
                  View proof →
                </a>
              </div>
            ) : null}
          </RecordSummaryCard>

          <RecordSummaryCard title="Transaction history" id={recordSectionId("history")}>
            <ol className="space-y-2">
              {lifecycle.map((e) => (
                <li key={e.id} className="rounded border border-border/50 px-3 py-2">
                  <div className="text-[13px] font-medium">{e.title}</div>
                  {e.detail ? (
                    <p className="mt-0.5 text-[12px] text-muted-foreground">{e.detail}</p>
                  ) : null}
                  <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                    {formatActivityDateTime(e.at)}
                  </div>
                </li>
              ))}
            </ol>
          </RecordSummaryCard>

          <RecordSummaryCard title="Related records" id={recordSectionId("related")}>
            <RelatedRecords records={relatedRecords} site={search.site} />
          </RecordSummaryCard>

          <div className="space-y-2">
            <RecordMoreSection
              id={recordSectionId("notes")}
              title="Internal notes"
              defaultOpen={search.section === "notes"}
            >
              <InternalNotePanel
                targetType="BANK_TRANSACTION"
                targetId={tx.id}
                initialNotes={notes}
              />
            </RecordMoreSection>
            <RecordMoreSection
              id={recordSectionId("review-flags")}
              title="Review flags"
              defaultOpen={search.section === "review-flags" || activeFlags.length > 0}
            >
              <OpsReviewFlagsPanel
                targetType="BANK_TRANSACTION"
                targetId={tx.id}
                initialFlags={reviewFlags}
              />
            </RecordMoreSection>
            <RecordMoreSection
              id={recordSectionId("audit")}
              title="Audit history"
              defaultOpen={search.section === "audit"}
            >
              <WorkspaceAuditLink entityType="BANK_TRANSACTION" entityId={tx.id} />
              <div className="mt-2">
                <InternalAuditTable rows={audit} />
              </div>
            </RecordMoreSection>
            <RecordMoreSection
              id={recordSectionId("technical")}
              title="Technical details"
              defaultOpen={search.section === "technical"}
            >
              <WorkspaceFieldGrid columns={2}>
                <WorkspaceField label="Transaction ID">
                  <span className="break-all font-mono text-[11px]">{tx.id}</span>
                </WorkspaceField>
                <WorkspaceField label="Raw type">
                  <span className="font-mono text-[11px]">{tx.type}</span>
                </WorkspaceField>
                <WorkspaceField label="Raw status">
                  <span className="font-mono text-[11px]">{tx.status}</span>
                </WorkspaceField>
                <WorkspaceField label="Account ID">
                  <span className="break-all font-mono text-[11px]">{tx.accountId}</span>
                </WorkspaceField>
                {tx.balanceBefore != null ? (
                  <WorkspaceField label="Balance before">
                    <span className="type-finance tabular-nums">{florin(tx.balanceBefore)}</span>
                  </WorkspaceField>
                ) : null}
                {tx.balanceAfter != null ? (
                  <WorkspaceField label="Balance after">
                    <span className="type-finance tabular-nums">{florin(tx.balanceAfter)}</span>
                  </WorkspaceField>
                ) : null}
                {tx.relatedStatementId ? (
                  <WorkspaceField label="Statement ID">
                    <span className="break-all font-mono text-[11px]">{tx.relatedStatementId}</span>
                  </WorkspaceField>
                ) : null}
              </WorkspaceFieldGrid>
              {!tx.balanceBefore && !tx.balanceAfter && !tx.relatedStatementId ? (
                <RecordEmptyCopy>No additional metadata.</RecordEmptyCopy>
              ) : null}
            </RecordMoreSection>
          </div>
        </div>
      </RecordSinglePage>
    </>
  );
}
