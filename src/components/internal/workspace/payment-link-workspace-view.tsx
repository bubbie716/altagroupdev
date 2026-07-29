"use client";

import { Link } from "@tanstack/react-router";
import {
  INTERNAL_ALTA_PAY_RECORD_SEARCH,
  INTERNAL_COMPANY_WORKSPACE_SEARCH,
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
import type { PaymentLinkDetail } from "@/lib/bank/payment-link-types";
import {
  PAYMENT_LINK_EVENT_LABELS,
  PAYMENT_LINK_STATUS_LABELS,
} from "@/lib/bank/payment-link-types";
import { recordSectionId, type CaseRecordSearch } from "@/lib/internal/record-workspace-search";
import { parseReturnPath } from "@/lib/internal/record-return-context";

function amountBehaviorLabel(link: PaymentLinkDetail): string {
  if (link.amountType === "FIXED" && link.amount != null) {
    return `Fixed · ${florin(link.amount)}`;
  }
  const parts = ["Customer chooses"];
  if (link.minAmount != null) parts.push(`min ${florin(link.minAmount)}`);
  if (link.maxAmount != null) parts.push(`max ${florin(link.maxAmount)}`);
  return parts.join(" · ");
}

function eventLabel(eventType: string): string {
  return PAYMENT_LINK_EVENT_LABELS[eventType] ?? eventType.replace(/_/g, " ");
}

export function PaymentLinkWorkspaceView({
  link,
  search,
}: {
  link: PaymentLinkDetail;
  search: CaseRecordSearch;
}) {
  const statusLabel = PAYMENT_LINK_STATUS_LABELS[link.status] ?? link.status;
  const title = link.title?.trim() || link.description;

  const relatedRecords: RelatedRecord[] = [
    {
      kind: "company",
      id: link.merchantCompanyId,
      label: link.merchantName,
      sublabel: "Owner",
    },
    ...link.recentPayments
      .filter((p) => p.paymentReferenceCode)
      .map((p) => ({
        kind: "alta_pay" as const,
        id: p.paymentReferenceCode!,
        label: florin(p.amount),
        sublabel: p.paymentReferenceCode ?? undefined,
      })),
  ];

  const returnCtx = parseReturnPath(search.from);
  const breadcrumbs =
    returnCtx?.pathname === "/internal/inbox"
      ? workspaceBreadcrumbs([
          { label: "Home", to: "/internal" },
          { label: "Inbox", to: "/internal/inbox", search: returnCtx.search },
          { label: link.referenceCode },
        ])
      : workspaceBreadcrumbs([
          { label: "Home", to: "/internal" },
          { label: "Alta Pay", to: "/internal/bank/alta-pay" },
          { label: link.referenceCode },
        ]);

  const headerActions = (
    <RecordActionsSheet
      title="Payment link"
      description={`${link.referenceCode} · ${link.merchantName}`}
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
        <Link
          to="/internal/companies/$companyId"
          params={{ companyId: link.merchantCompanyId }}
          search={withInternalSiteSearch(INTERNAL_COMPANY_WORKSPACE_SEARCH, search.site)}
          className="text-[12px] text-gold hover:underline"
        >
          Open owner company
        </Link>
      </RecordActionGroup>
    </RecordActionsSheet>
  );

  return (
    <RecordSinglePage
      title={title}
      breadcrumbs={breadcrumbs}
      recordType="Payment link"
      primaryId={
        <>
          {amountBehaviorLabel(link)}
          {` · ${link.paymentCount} use${link.paymentCount === 1 ? "" : "s"}`}
        </>
      }
      status={statusLabel}
      meta={
        <>
          <span className="font-mono">{link.referenceCode}</span>
          <span className="font-mono">{formatActivityDateTime(link.createdAt)}</span>
        </>
      }
      headerActions={headerActions}
      search={search}
    >
      <div className="space-y-3">
        <RecordSummaryCard title="Summary" id={recordSectionId("summary")}>
          <WorkspaceFieldGrid columns={3}>
            <WorkspaceField label="Reference">
              <span className="break-all font-mono text-[11px]">{link.referenceCode}</span>
            </WorkspaceField>
            <WorkspaceField label="Status">
              <StatusBadge status={statusLabel} />
            </WorkspaceField>
            <WorkspaceField label="Amount">{amountBehaviorLabel(link)}</WorkspaceField>
            <WorkspaceField label="Usage type">
              {link.usageType === "ONE_TIME" ? "One-time" : "Reusable"}
            </WorkspaceField>
            <WorkspaceField label="Usage count">{link.paymentCount}</WorkspaceField>
            <WorkspaceField label="Collected">
              <span className="type-finance tabular-nums">{florin(link.totalCollected)}</span>
            </WorkspaceField>
            <WorkspaceField label="Created">
              <span className="font-mono text-[11px]">
                {formatActivityDateTime(link.createdAt)}
              </span>
            </WorkspaceField>
            <WorkspaceField label="Expires">
              <span className="font-mono text-[11px]">
                {link.expiresAt ? formatActivityDateTime(link.expiresAt) : "—"}
              </span>
            </WorkspaceField>
            {link.description ? (
              <WorkspaceField label="Description" className="sm:col-span-2 lg:col-span-3">
                {link.description}
              </WorkspaceField>
            ) : null}
          </WorkspaceFieldGrid>
        </RecordSummaryCard>

        <RecordSummaryCard title="Owner" id={recordSectionId("owner")}>
          <WorkspaceFieldGrid columns={2}>
            <WorkspaceField label="Company">
              <Link
                to="/internal/companies/$companyId"
                params={{ companyId: link.merchantCompanyId }}
                search={withInternalSiteSearch(INTERNAL_COMPANY_WORKSPACE_SEARCH, search.site)}
                className="hover:text-gold"
              >
                {link.merchantName}
              </Link>
            </WorkspaceField>
            {link.internalMemo ? (
              <WorkspaceField label="Internal memo">{link.internalMemo}</WorkspaceField>
            ) : null}
          </WorkspaceFieldGrid>
        </RecordSummaryCard>

        <RecordSummaryCard title="Related payments" id={recordSectionId("related")}>
          {link.recentPayments.length === 0 ? (
            <RecordEmptyCopy>No payments collected yet.</RecordEmptyCopy>
          ) : (
            <ul className="mb-3 space-y-2">
              {link.recentPayments.map((payment) => (
                <li key={payment.id} className="rounded border border-border/50 px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="type-finance tabular-nums text-[13px]">
                      {florin(payment.amount)}
                    </span>
                    <StatusBadge status={payment.status} />
                  </div>
                  <div className="mt-1 text-[12px] text-muted-foreground">
                    {payment.payerLabel ?? "Payer"}
                    {payment.paymentReferenceCode ? (
                      <>
                        {" · "}
                        <Link
                          to="/internal/bank/alta-pay/$referenceCode"
                          params={{ referenceCode: payment.paymentReferenceCode }}
                          search={withInternalSiteSearch(INTERNAL_ALTA_PAY_RECORD_SEARCH, search.site)}
                          className="font-mono text-gold hover:underline"
                        >
                          {payment.paymentReferenceCode}
                        </Link>
                      </>
                    ) : null}
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                    {formatActivityDateTime(payment.completedAt ?? payment.createdAt)}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <RelatedRecords records={relatedRecords} site={search.site} />
        </RecordSummaryCard>

        {link.events.length > 0 ? (
          <RecordSummaryCard title="Events" id={recordSectionId("events")}>
            <ol className="space-y-2">
              {[...link.events]
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                .map((event) => (
                  <li key={event.id} className="rounded border border-border/50 px-3 py-2">
                    <div className="text-[13px] font-medium">{eventLabel(event.eventType)}</div>
                    <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                      {formatActivityDateTime(event.createdAt)}
                    </div>
                  </li>
                ))}
            </ol>
          </RecordSummaryCard>
        ) : null}

        <div className="space-y-2">
          <RecordMoreSection
            id={recordSectionId("technical")}
            title="Technical details"
            defaultOpen={search.section === "technical"}
          >
            <WorkspaceFieldGrid columns={2}>
              <WorkspaceField label="Link ID">
                <span className="break-all font-mono text-[11px]">{link.id}</span>
              </WorkspaceField>
              <WorkspaceField label="Raw status">
                <span className="font-mono text-[11px]">{link.status}</span>
              </WorkspaceField>
              <WorkspaceField label="Amount type">
                <span className="font-mono text-[11px]">{link.amountType}</span>
              </WorkspaceField>
              <WorkspaceField label="Usage type">
                <span className="font-mono text-[11px]">{link.usageType}</span>
              </WorkspaceField>
              <WorkspaceField label="Merchant company ID">
                <span className="break-all font-mono text-[11px]">{link.merchantCompanyId}</span>
              </WorkspaceField>
              <WorkspaceField label="Checkout URL" className="sm:col-span-2">
                <span className="break-all font-mono text-[11px] text-muted-foreground">
                  {link.checkoutUrl}
                </span>
              </WorkspaceField>
            </WorkspaceFieldGrid>
          </RecordMoreSection>
        </div>
      </div>
    </RecordSinglePage>
  );
}
