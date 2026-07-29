"use client";

import { Link } from "@tanstack/react-router";
import {
  INTERNAL_ALTA_PAY_RECORD_SEARCH,
  INTERNAL_COMPANY_WORKSPACE_SEARCH,
  INTERNAL_USER_WORKSPACE_SEARCH,
  withInternalSiteSearch,
} from "@/lib/internal/internal-route-search";
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
import type { MerchantInvoiceDetail } from "@/lib/bank/merchant-invoice-types";
import { MERCHANT_INVOICE_EVENT_LABELS } from "@/lib/bank/merchant-invoice-types";
import { recordSectionId, type CaseRecordSearch } from "@/lib/internal/record-workspace-search";
import { parseReturnPath } from "@/lib/internal/record-return-context";
import { uiLabPartyHasResolvableWorkspace } from "@/lib/bank/ui-lab-party-catalog";
import { isUiLabMode } from "@/lib/auth/ui-lab";

function invoicePaymentState(invoice: MerchantInvoiceDetail): string {
  const status = invoice.status;
  if (status === "PAID") return "Paid";
  if (status === "PARTIALLY_PAID") return "Partially paid";
  if (status === "CANCELLED" || status === "VOIDED") return "Not payable";
  if (status === "DRAFT") return "Not sent";
  if (invoice.amountPaid > 0) return "Partially paid";
  return "Unpaid";
}

function eventLabel(eventType: string): string {
  return MERCHANT_INVOICE_EVENT_LABELS[eventType] ?? eventType.replace(/_/g, " ");
}

export function InvoiceWorkspaceView({
  invoice,
  search,
}: {
  invoice: MerchantInvoiceDetail;
  search: CaseRecordSearch;
}) {
  const paymentState = invoicePaymentState(invoice);
  const hasReminderEvents = invoice.events.some((e) => e.eventType === "REMINDER_SENT");

  const recipientLinkable = invoice.recipientCompanyId
    ? !isUiLabMode() || uiLabPartyHasResolvableWorkspace(invoice.recipientCompanyId)
    : invoice.recipientUserId
      ? !isUiLabMode() || uiLabPartyHasResolvableWorkspace(invoice.recipientUserId)
      : false;

  const relatedRecords: RelatedRecord[] = [
    {
      kind: "company",
      id: invoice.merchantCompanyId,
      label: invoice.merchantName,
      sublabel: "Issuer",
      linkable: !isUiLabMode() || uiLabPartyHasResolvableWorkspace(invoice.merchantCompanyId),
    },
    ...(invoice.recipientCompanyId
      ? [
          {
            kind: "company" as const,
            id: invoice.recipientCompanyId,
            label: invoice.recipientName,
            sublabel: "Recipient",
            linkable: recipientLinkable,
          },
        ]
      : invoice.recipientUserId
        ? [
            {
              kind: "user" as const,
              id: invoice.recipientUserId,
              label: invoice.recipientName,
              sublabel: "Recipient",
              linkable: recipientLinkable,
            },
          ]
        : []),
    ...(invoice.paymentReferenceCode
      ? [
          {
            kind: "alta_pay" as const,
            id: invoice.paymentReferenceCode,
            label: "Related payment",
            sublabel: invoice.paymentReferenceCode,
          },
        ]
      : []),
  ];

  const returnCtx = parseReturnPath(search.from);
  const breadcrumbs =
    returnCtx?.pathname === "/internal/inbox"
      ? workspaceBreadcrumbs([
          { label: "Home", to: "/internal" },
          { label: "Inbox", to: "/internal/inbox", search: returnCtx.search },
          { label: invoice.referenceCode },
        ])
      : workspaceBreadcrumbs([
          { label: "Home", to: "/internal" },
          { label: "Alta Pay", to: "/internal/bank/alta-pay" },
          { label: invoice.referenceCode },
        ]);

  const headerActions = (
    <RecordActionsSheet
      title="Invoice actions"
      description={`${florin(invoice.amount)} · ${invoice.referenceCode}`}
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
      <RecordActionGroup title="Open">
        <div className="flex flex-col gap-1.5">
          {!isUiLabMode() || uiLabPartyHasResolvableWorkspace(invoice.merchantCompanyId) ? (
            <Link
              to="/internal/companies/$companyId"
              params={{ companyId: invoice.merchantCompanyId }}
              search={withInternalSiteSearch(INTERNAL_COMPANY_WORKSPACE_SEARCH, search.site)}
              className="text-[12px] text-gold hover:underline"
            >
              Open issuer company
            </Link>
          ) : (
            <span className="text-[12px] text-muted-foreground">{invoice.merchantName}</span>
          )}
          {invoice.recipientCompanyId && recipientLinkable ? (
            <Link
              to="/internal/companies/$companyId"
              params={{ companyId: invoice.recipientCompanyId }}
              search={withInternalSiteSearch(INTERNAL_COMPANY_WORKSPACE_SEARCH, search.site)}
              className="text-[12px] text-gold hover:underline"
            >
              Open recipient company
            </Link>
          ) : null}
          {invoice.recipientUserId && recipientLinkable ? (
            <Link
              to="/internal/users/$userId"
              params={{ userId: invoice.recipientUserId }}
              search={withInternalSiteSearch(INTERNAL_USER_WORKSPACE_SEARCH, search.site)}
              className="text-[12px] text-gold hover:underline"
            >
              Open recipient
            </Link>
          ) : null}
          {(invoice.recipientUserId || invoice.recipientCompanyId) && !recipientLinkable ? (
            <span className="text-[12px] text-muted-foreground">
              {invoice.recipientName} · no internal record
            </span>
          ) : null}
        </div>
      </RecordActionGroup>
    </RecordActionsSheet>
  );

  return (
    <RecordSinglePage
      title={invoice.description || "Invoice"}
      breadcrumbs={breadcrumbs}
      recordType="Invoice"
      primaryId={florin(invoice.amount)}
      status={invoice.status}
      meta={
        <>
          <span className="font-mono">{invoice.referenceCode}</span>
          <span className="font-mono">{formatActivityDateTime(invoice.createdAt)}</span>
        </>
      }
      headerActions={headerActions}
      search={search}
    >
      <div className="space-y-3">
        <RecordSummaryCard title="Summary" id={recordSectionId("summary")}>
          <WorkspaceFieldGrid columns={3}>
            <WorkspaceField label="Amount">
              <span className="type-finance tabular-nums text-[14px]">{florin(invoice.amount)}</span>
            </WorkspaceField>
            <WorkspaceField label="Status">
              <StatusBadge status={invoice.status} />
            </WorkspaceField>
            <WorkspaceField label="Payment state">{paymentState}</WorkspaceField>
            <WorkspaceField label="Amount paid">
              <span className="type-finance tabular-nums">{florin(invoice.amountPaid)}</span>
            </WorkspaceField>
            <WorkspaceField label="Due date">
              <span className="font-mono text-[11px]">
                {invoice.dueDate ? invoice.dueDate.slice(0, 10) : "—"}
              </span>
            </WorkspaceField>
            <WorkspaceField label="Created">
              <span className="font-mono text-[11px]">
                {formatActivityDateTime(invoice.createdAt)}
              </span>
            </WorkspaceField>
            <WorkspaceField label="Reference">
              <span className="break-all font-mono text-[11px]">{invoice.referenceCode}</span>
            </WorkspaceField>
            {invoice.memo ? (
              <WorkspaceField label="Memo" className="sm:col-span-2 lg:col-span-3">
                {invoice.memo}
              </WorkspaceField>
            ) : null}
          </WorkspaceFieldGrid>
        </RecordSummaryCard>

        <RecordSummaryCard title="Issuer / Recipient" id={recordSectionId("parties")}>
          <WorkspaceFieldGrid columns={2}>
            <WorkspaceField label="Issuer">
              {!isUiLabMode() || uiLabPartyHasResolvableWorkspace(invoice.merchantCompanyId) ? (
                <Link
                  to="/internal/companies/$companyId"
                  params={{ companyId: invoice.merchantCompanyId }}
                  search={withInternalSiteSearch(INTERNAL_COMPANY_WORKSPACE_SEARCH, search.site)}
                  className="hover:text-gold"
                >
                  {invoice.merchantName}
                </Link>
              ) : (
                invoice.merchantName
              )}
            </WorkspaceField>
            <WorkspaceField label="Recipient">
              {invoice.recipientCompanyId && recipientLinkable ? (
                <Link
                  to="/internal/companies/$companyId"
                  params={{ companyId: invoice.recipientCompanyId }}
                  search={withInternalSiteSearch(INTERNAL_COMPANY_WORKSPACE_SEARCH, search.site)}
                  className="hover:text-gold"
                >
                  {invoice.recipientName}
                </Link>
              ) : invoice.recipientUserId && recipientLinkable ? (
                <Link
                  to="/internal/users/$userId"
                  params={{ userId: invoice.recipientUserId }}
                  search={withInternalSiteSearch(INTERNAL_USER_WORKSPACE_SEARCH, search.site)}
                  className="hover:text-gold"
                >
                  {invoice.recipientName}
                </Link>
              ) : (
                invoice.recipientName
              )}
            </WorkspaceField>
          </WorkspaceFieldGrid>
        </RecordSummaryCard>

        <RecordSummaryCard title="Reminders & events" id={recordSectionId("events")}>
          {hasReminderEvents ? (
            <p className="mb-2 text-[12px] text-muted-foreground">
              Reminder events are outreach history only — they do not change payment status.
            </p>
          ) : null}
          {invoice.events.length === 0 ? (
            <RecordEmptyCopy>No events recorded.</RecordEmptyCopy>
          ) : (
            <ol className="space-y-2">
              {[...invoice.events]
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                .map((event) => (
                  <li key={event.id} className="rounded border border-border/50 px-3 py-2">
                    <div className="text-[13px] font-medium">{eventLabel(event.eventType)}</div>
                    <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                      {formatActivityDateTime(event.createdAt)}
                      {event.source ? ` · ${event.source}` : ""}
                    </div>
                  </li>
                ))}
            </ol>
          )}
        </RecordSummaryCard>

        <RecordSummaryCard title="Related" id={recordSectionId("related")}>
          {invoice.paymentReferenceCode ? (
            <p className="mb-2 text-[12px] text-muted-foreground">
              Related payment{" "}
              <Link
                to="/internal/bank/alta-pay/$referenceCode"
                params={{ referenceCode: invoice.paymentReferenceCode }}
                search={withInternalSiteSearch(INTERNAL_ALTA_PAY_RECORD_SEARCH, search.site)}
                className="font-mono text-gold hover:underline"
              >
                {invoice.paymentReferenceCode}
              </Link>
            </p>
          ) : (
            <p className="mb-2 text-[12px] text-muted-foreground">No related payment yet.</p>
          )}
          <RelatedRecords records={relatedRecords} site={search.site} />
        </RecordSummaryCard>

        <div className="space-y-2">
          <RecordMoreSection
            id={recordSectionId("technical")}
            title="Technical details"
            defaultOpen={search.section === "technical"}
          >
            <WorkspaceFieldGrid columns={2}>
              <WorkspaceField label="Invoice ID">
                <span className="break-all font-mono text-[11px]">{invoice.id}</span>
              </WorkspaceField>
              <WorkspaceField label="Raw status">
                <span className="font-mono text-[11px]">{invoice.status}</span>
              </WorkspaceField>
              <WorkspaceField label="Merchant company ID">
                <span className="break-all font-mono text-[11px]">{invoice.merchantCompanyId}</span>
              </WorkspaceField>
              {invoice.recipientCompanyId ? (
                <WorkspaceField label="Recipient company ID">
                  <span className="break-all font-mono text-[11px]">
                    {invoice.recipientCompanyId}
                  </span>
                </WorkspaceField>
              ) : null}
              {invoice.recipientUserId ? (
                <WorkspaceField label="Recipient user ID">
                  <span className="break-all font-mono text-[11px]">{invoice.recipientUserId}</span>
                </WorkspaceField>
              ) : null}
              {invoice.lineItems.length > 0 ? (
                <WorkspaceField label="Line items" className="sm:col-span-2">
                  {invoice.lineItems.length} item(s)
                </WorkspaceField>
              ) : null}
            </WorkspaceFieldGrid>
          </RecordMoreSection>
        </div>
      </div>
    </RecordSinglePage>
  );
}
