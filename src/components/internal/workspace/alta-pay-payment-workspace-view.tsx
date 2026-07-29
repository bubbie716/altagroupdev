"use client";

import { useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { INTERNAL_TRANSACTION_WORKSPACE_SEARCH, withInternalSiteSearch } from "@/lib/internal/internal-route-search";
import { OpsConfirmDialog } from "@/components/internal/ops-confirm-dialog";
import { RelatedRecords, type RelatedRecord } from "@/components/internal/workspace/related-records";
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
import { StatusBadge } from "@/components/internal/status-badge";
import { florin } from "@/lib/bank/api";
import { formatActivityDateTime } from "@/lib/format-datetime";
import { reverseAltaPayAdmin } from "@/lib/internal/ops-platform.functions";
import type { AltaPayAdminRow } from "@/lib/internal/ops-types";
import { recordSectionId, type CaseRecordSearch } from "@/lib/internal/record-workspace-search";
import { parseReturnPath } from "@/lib/internal/record-return-context";
import { useUiLabMutationGate } from "@/lib/internal/ui-lab-mutation-gate";

function buildAltaPayLifecycle(payment: AltaPayAdminRow): Array<{
  id: string;
  title: string;
  detail?: string;
  at?: string | null;
  current?: boolean;
}> {
  const status = payment.status.toUpperCase();
  const created = {
    id: "created",
    title: "Created",
    at: payment.createdAt,
  };

  if (status === "PENDING") {
    return [created, { id: "pending", title: "Pending", current: true, at: payment.createdAt }];
  }
  if (status === "APPROVED") {
    return [
      created,
      { id: "approved", title: "Approved", current: true, at: payment.createdAt },
    ];
  }
  if (status === "DENIED") {
    return [created, { id: "denied", title: "Denied", current: true, at: payment.createdAt }];
  }
  if (status === "REVERSED") {
    return [
      created,
      { id: "approved", title: "Approved", at: payment.createdAt },
      { id: "reversed", title: "Reversed", current: true },
    ];
  }
  return [created, { id: "status", title: payment.status, current: true, at: payment.createdAt }];
}

export function AltaPayPaymentWorkspaceView({
  payment,
  search,
}: {
  payment: AltaPayAdminRow;
  search: CaseRecordSearch;
}) {
  const router = useRouter();
  const reverseFn = useServerFn(reverseAltaPayAdmin);
  const [reverseOpen, setReverseOpen] = useState(false);
  const { uiLab, unavailableLabel } = useUiLabMutationGate();
  const isPending = payment.status.toUpperCase() === "PENDING";
  const statusAllowsReverse = payment.status.toUpperCase() === "APPROVED";
  const canReverse = statusAllowsReverse && !uiLab;
  const lifecycle = buildAltaPayLifecycle(payment);

  const relatedRecords: RelatedRecord[] = [
    {
      kind: "transaction",
      id: payment.outTransactionId,
      label: "Outbound transaction",
      sublabel: payment.outTransactionId,
    },
    {
      kind: "transaction",
      id: payment.inTransactionId,
      label: "Inbound transaction",
      sublabel: payment.inTransactionId,
    },
  ];

  const returnCtx = parseReturnPath(search.from);
  const breadcrumbs =
    returnCtx?.pathname === "/internal/inbox"
      ? workspaceBreadcrumbs([
          { label: "Home", to: "/internal" },
          { label: "Inbox", to: "/internal/inbox", search: returnCtx.search },
          { label: payment.referenceCode },
        ])
      : workspaceBreadcrumbs([
          { label: "Home", to: "/internal" },
          { label: "Alta Pay", to: "/internal/bank/alta-pay" },
          { label: payment.referenceCode },
        ]);

  const headerActions = (
    <RecordActionsSheet
      title="Alta Pay actions"
      description={`${florin(payment.amount)} · ${payment.referenceCode}`}
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
      {statusAllowsReverse ? (
        <RecordActionGroup title="Resolve">
          {canReverse ? (
            <button
              type="button"
              className="rounded border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 text-left text-[12px] text-destructive"
              onClick={() => setReverseOpen(true)}
            >
              Reverse payment
            </button>
          ) : (
            <button
              type="button"
              disabled
              className="rounded border border-border px-2.5 py-1.5 text-left text-[12px] text-muted-foreground disabled:opacity-60"
            >
              {unavailableLabel("Reverse")}
            </button>
          )}
        </RecordActionGroup>
      ) : null}
      <RecordActionGroup title="Related">
        <div className="flex flex-col gap-1.5">
          <Link
            to="/internal/bank/transactions/$transactionId"
            params={{ transactionId: payment.outTransactionId }}
            search={withInternalSiteSearch(INTERNAL_TRANSACTION_WORKSPACE_SEARCH, search.site)}
            className="text-[12px] text-gold hover:underline"
          >
            Open outbound transaction
          </Link>
          <Link
            to="/internal/bank/transactions/$transactionId"
            params={{ transactionId: payment.inTransactionId }}
            search={withInternalSiteSearch(INTERNAL_TRANSACTION_WORKSPACE_SEARCH, search.site)}
            className="text-[12px] text-gold hover:underline"
          >
            Open inbound transaction
          </Link>
        </div>
      </RecordActionGroup>
    </RecordActionsSheet>
  );

  return (
    <>
      <RecordSinglePage
        title="Alta Pay payment"
        breadcrumbs={breadcrumbs}
        recordType="Alta Pay"
        primaryId={florin(payment.amount)}
        status={payment.status}
        meta={
          <>
            <span className="font-mono">{payment.referenceCode}</span>
            <span className="font-mono">{formatActivityDateTime(payment.createdAt)}</span>
          </>
        }
        warning={
          isPending ? (
            <span className="text-[12px] text-amber-700 dark:text-amber-300">Needs a decision</span>
          ) : null
        }
        headerActions={headerActions}
        search={search}
      >
        <div className="space-y-3">
          {isPending ? (
            <RecordAttentionBanner
              items={[
                {
                  id: "pending",
                  label: "Pending payment",
                  detail: "This Alta Pay payment is still pending.",
                  tone: "warning",
                },
              ]}
            />
          ) : null}

          {statusAllowsReverse ? (
            <div className="flex flex-wrap gap-1.5">
              {canReverse ? (
                <button
                  type="button"
                  className="rounded border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-destructive"
                  onClick={() => setReverseOpen(true)}
                >
                  Reverse
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  className="rounded border border-border bg-surface-2 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground disabled:opacity-60"
                >
                  {unavailableLabel("Reverse")}
                </button>
              )}
            </div>
          ) : null}

          <RecordSummaryCard title="Summary" id={recordSectionId("summary")}>
            <WorkspaceFieldGrid columns={3}>
              <WorkspaceField label="Amount">
                <span className="type-finance tabular-nums text-[14px]">
                  {florin(payment.amount)}
                </span>
              </WorkspaceField>
              <WorkspaceField label="Status">
                <StatusBadge status={payment.status} />
              </WorkspaceField>
              <WorkspaceField label="Created">
                <span className="font-mono text-[11px]">
                  {formatActivityDateTime(payment.createdAt)}
                </span>
              </WorkspaceField>
              <WorkspaceField label="Reference">
                <span className="break-all font-mono text-[11px]">{payment.referenceCode}</span>
              </WorkspaceField>
              {payment.memo ? (
                <WorkspaceField label="Memo" className="sm:col-span-2 lg:col-span-3">
                  {payment.memo}
                </WorkspaceField>
              ) : null}
            </WorkspaceFieldGrid>
          </RecordSummaryCard>

          <RecordSummaryCard title="Payer / Recipient" id={recordSectionId("parties")}>
            <WorkspaceFieldGrid columns={2}>
              <WorkspaceField label="Payer">{payment.payerLabel}</WorkspaceField>
              <WorkspaceField label="Recipient">{payment.merchantName}</WorkspaceField>
            </WorkspaceFieldGrid>
          </RecordSummaryCard>

          <RecordSummaryCard title="Funding accounts" id={recordSectionId("funding")}>
            <WorkspaceFieldGrid columns={2}>
              <WorkspaceField label="Payer account">
                <span className="font-mono text-[11px]">{payment.payerAccountNumber}</span>
              </WorkspaceField>
              <WorkspaceField label="Merchant account">
                <span className="font-mono text-[11px]">{payment.merchantAccountNumber}</span>
              </WorkspaceField>
            </WorkspaceFieldGrid>
          </RecordSummaryCard>

          <RecordSummaryCard title="Lifecycle" id={recordSectionId("lifecycle")}>
            <ol className="space-y-2">
              {lifecycle.map((e) => (
                <li
                  key={e.id}
                  className={`rounded border px-3 py-2 ${
                    e.current ? "border-gold/40 bg-gold/5" : "border-border/50"
                  }`}
                >
                  <div className="text-[13px] font-medium">{e.title}</div>
                  {e.detail ? (
                    <p className="mt-0.5 text-[12px] text-muted-foreground">{e.detail}</p>
                  ) : null}
                  {e.at ? (
                    <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                      {formatActivityDateTime(e.at)}
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
          </RecordSummaryCard>

          <RecordSummaryCard title="Related transactions" id={recordSectionId("related")}>
            <WorkspaceFieldGrid columns={2}>
              <WorkspaceField label="Outbound">
                <Link
                  to="/internal/bank/transactions/$transactionId"
                  params={{ transactionId: payment.outTransactionId }}
                  search={withInternalSiteSearch(INTERNAL_TRANSACTION_WORKSPACE_SEARCH, search.site)}
                  className="font-mono text-[11px] text-gold hover:underline"
                >
                  {payment.outTransactionId}
                </Link>
              </WorkspaceField>
              <WorkspaceField label="Inbound">
                <Link
                  to="/internal/bank/transactions/$transactionId"
                  params={{ transactionId: payment.inTransactionId }}
                  search={withInternalSiteSearch(INTERNAL_TRANSACTION_WORKSPACE_SEARCH, search.site)}
                  className="font-mono text-[11px] text-gold hover:underline"
                >
                  {payment.inTransactionId}
                </Link>
              </WorkspaceField>
            </WorkspaceFieldGrid>
            <div className="mt-3">
              <RelatedRecords records={relatedRecords} site={search.site} />
            </div>
          </RecordSummaryCard>

          <div className="space-y-2">
            <RecordMoreSection
              id={recordSectionId("technical")}
              title="Technical details"
              defaultOpen={search.section === "technical"}
            >
              <WorkspaceFieldGrid columns={2}>
                <WorkspaceField label="Reference code">
                  <span className="break-all font-mono text-[11px]">{payment.referenceCode}</span>
                </WorkspaceField>
                <WorkspaceField label="Raw status">
                  <span className="font-mono text-[11px]">{payment.status}</span>
                </WorkspaceField>
                <WorkspaceField label="Out transaction ID">
                  <span className="break-all font-mono text-[11px]">{payment.outTransactionId}</span>
                </WorkspaceField>
                <WorkspaceField label="In transaction ID">
                  <span className="break-all font-mono text-[11px]">{payment.inTransactionId}</span>
                </WorkspaceField>
              </WorkspaceFieldGrid>
            </RecordMoreSection>
          </div>
        </div>
      </RecordSinglePage>

      <OpsConfirmDialog
        open={reverseOpen}
        title="Reverse Alta Pay payment"
        description={`Reverse payment ${payment.referenceCode}. This creates offsetting transactions.`}
        confirmLabel="Reverse payment"
        variant="danger"
        showSilentNotificationToggle
        onCancel={() => setReverseOpen(false)}
        onConfirm={async (reason, options) => {
          await reverseFn({
            data: {
              referenceCode: payment.referenceCode,
              reason,
              silentNotification: options?.silentNotification,
            },
          });
          setReverseOpen(false);
          await router.invalidate();
        }}
      />
    </>
  );
}
