"use client";

import { Link, useNavigate } from "@tanstack/react-router";
import {
  INTERNAL_USER_WORKSPACE_SEARCH,
  INTERNAL_COMPANY_WORKSPACE_SEARCH,
  INTERNAL_ACCOUNT_WORKSPACE_SEARCH,
  type AltaCardWorkspaceSearch,
  withInternalSiteSearch,
} from "@/lib/internal/internal-route-search";
import { OpsAction } from "@/components/internal/ops-action";
import { InternalAltaCardDetailIntegration } from "@/components/bank/alta-card/internal-alta-card-detail-integration";
import { InternalAuditTable } from "@/components/internal/internal-audit-table";
import { WorkspaceAuditLink } from "@/components/internal/workspace/workspace-audit-link";
import { InternalNotePanel } from "@/components/internal/internal-note-panel";
import { workspaceBreadcrumbs } from "@/components/internal/workspace/workspace-page";
import { RecordWorkspacePage } from "@/components/internal/workspace/record-workspace-page";
import {
  RecordAttentionBanner,
  RecordEmptyCopy,
  RecordMoreSection,
  RecordSummaryCard,
  type RecordWorkspaceTab,
} from "@/components/internal/workspace/record-workspace-layout";
import { RecordActivityTimeline } from "@/components/internal/workspace/record-activity-timeline";
import {
  RecordActionGroup,
  RecordActionsSheet,
} from "@/components/internal/workspace/record-actions-sheet";
import { WorkspaceField, WorkspaceFieldGrid } from "@/components/internal/workspace/workspace-fields";
import { changeAltaCardStatusRecord } from "@/lib/bank/alta-card-admin.functions";
import {
  ALTA_CARD_TIER_LABELS,
  altaCardStatusLabel,
  formatAltaCardCurrency,
  formatAltaCardRate,
  formatAltaCardTransactionSummary,
  type AltaCardStatusCode,
} from "@/lib/bank/alta-card-types";
import { formatAltaCardBillingDate } from "@/lib/bank/alta-card-billing-cycle";
import { formatActivityDateTime, formatDueDate } from "@/lib/format-datetime";
import { isAdmin } from "@/lib/auth/permissions";
import { useCurrentUser } from "@/hooks/use-current-user";
import type { ResolvedRelationshipIntegration } from "@/lib/internal/resolved-relationship-integration.types";
import type { AuditLogRow } from "@/lib/internal/audit.types";
import type { TimelineEvent } from "@/lib/internal/ops-types";
import type { InternalNoteRow } from "@/lib/internal/internal-note.types";
import {
  CARD_ACTIVITY_FILTERS,
  CARD_ACTIVITY_FILTER_LABELS,
} from "@/lib/internal/record-activity-filters";
import {
  recordSectionId,
  toRecordWorkspaceSearchParams,
  type RecordActivityFilter,
} from "@/lib/internal/record-workspace-search";
import { parseReturnPath } from "@/lib/internal/record-return-context";

type AltaCardWorkspaceProps = {
  ops: React.ComponentProps<typeof InternalAltaCardDetailIntegration>["ops"];
  statements: React.ComponentProps<typeof InternalAltaCardDetailIntegration>["statements"];
  fees: React.ComponentProps<typeof InternalAltaCardDetailIntegration>["fees"];
  autopay: React.ComponentProps<typeof InternalAltaCardDetailIntegration>["autopay"];
  integration: ResolvedRelationshipIntegration | null;
  ownerUserId: string | null;
  companyId: string | null;
  searchDefaults?: React.ComponentProps<typeof InternalAltaCardDetailIntegration>["searchDefaults"];
  auditLogs?: AuditLogRow[];
  notes?: InternalNoteRow[];
  timeline?: TimelineEvent[];
  search: AltaCardWorkspaceSearch;
};

export function AltaCardWorkspaceView(props: AltaCardWorkspaceProps) {
  const navigate = useNavigate();
  const user = useCurrentUser();
  const admin = user ? isAdmin(user) : false;
  const {
    ops,
    integration,
    ownerUserId,
    companyId,
    search,
    auditLogs = [],
    notes = [],
    timeline = [],
  } = props;
  const card = ops.card;
  const holderLabel = card.ownerUsername ?? card.companyName ?? "Cardholder";
  const title = holderLabel;
  const maskedLastFour = `····${card.cardLastFour}`;
  const statusLabel = altaCardStatusLabel(card.status);
  const paymentAccountId = props.autopay.context?.settings.sourceAccountId ?? null;
  const paymentAccountLabel =
    props.autopay.context?.settings.sourceAccountLabel ?? "Payment account";
  const attention = buildAltaCardAttention({
    card,
    autopay: props.autopay,
    recommendationPending: Boolean(search.recommendationId ?? props.searchDefaults?.recommendationId),
  });
  const recentEvents = timeline.slice(0, 5);
  const hasSpendingSummary =
    card.statementBalance > 0 ||
    card.minimumPaymentDue > 0 ||
    Boolean(card.dueDate || card.paymentDueDate) ||
    Boolean(ops.lastPayment) ||
    Boolean(ops.lastTransaction);

  const returnCtx = parseReturnPath(search.from);
  const breadcrumbs =
    returnCtx?.pathname === "/internal/inbox"
      ? workspaceBreadcrumbs([
          { label: "Home", to: "/internal" },
          { label: "Inbox", to: "/internal/inbox", search: returnCtx.search },
          { label: maskedLastFour },
        ])
      : returnCtx?.pathname.startsWith("/internal/users")
        ? workspaceBreadcrumbs([
            { label: "Home", to: "/internal" },
            { label: "Customers", to: "/internal/users" },
            { label: holderLabel, to: returnCtx.pathname, search: returnCtx.search },
            { label: maskedLastFour },
          ])
        : returnCtx?.pathname.startsWith("/internal/companies")
          ? workspaceBreadcrumbs([
              { label: "Home", to: "/internal" },
              { label: "Companies", to: "/internal/companies" },
              {
                label: card.companyName ?? "Company",
                to: returnCtx.pathname,
                search: returnCtx.search,
              },
              { label: maskedLastFour },
            ])
          : workspaceBreadcrumbs([
              { label: "Home", to: "/internal" },
              { label: "Alta Card", to: "/internal/alta-card" },
              { label: maskedLastFour },
            ]);

  function cardSearchParams(state: {
    tab?: string;
    section?: string | null;
    filter?: RecordActivityFilter | string | null;
  }) {
    return toRecordWorkspaceSearchParams({
      ...state,
      from: search.from,
      site: search.site,
    });
  }

  function setActivityFilter(filter: RecordActivityFilter) {
    void navigate({
      to: ".",
      search: () => cardSearchParams({ tab: "activity", filter }),
    });
  }

  async function runStatusChange(status: AltaCardStatusCode, reason: string, adminOverride?: boolean) {
    await changeAltaCardStatusRecord({
      data: {
        cardId: card.id,
        status,
        reason,
        adminOverride: adminOverride ?? false,
      },
    });
  }

  const overview: RecordWorkspaceTab = {
    id: "overview",
    label: "Overview",
    content: (
      <div className="space-y-3">
        {attention.length > 0 ? <RecordAttentionBanner items={attention} /> : null}

        <RecordSummaryCard title="Card summary" id={recordSectionId("summary")}>
          <WorkspaceFieldGrid columns={4}>
            <WorkspaceField label="Tier">{ALTA_CARD_TIER_LABELS[card.tier]}</WorkspaceField>
            <WorkspaceField label="Type">
              {card.cardType === "business" ? "Business" : "Personal"}
            </WorkspaceField>
            <WorkspaceField label="Limit">
              <span className="type-finance tabular-nums">{formatAltaCardCurrency(card.creditLimit)}</span>
            </WorkspaceField>
            <WorkspaceField label="Available">
              <span className="type-finance tabular-nums">
                {formatAltaCardCurrency(card.availableCredit)}
              </span>
            </WorkspaceField>
            <WorkspaceField label="Balance">
              <span className="type-finance tabular-nums">
                {formatAltaCardCurrency(card.currentBalance)}
              </span>
            </WorkspaceField>
            <WorkspaceField label="Rate">{formatAltaCardRate(card.interestRate)}</WorkspaceField>
            <WorkspaceField label="Utilization">
              <span className="tabular-nums">{ops.utilization.toFixed(1)}%</span>
            </WorkspaceField>
          </WorkspaceFieldGrid>
        </RecordSummaryCard>

        {hasSpendingSummary ? (
          <RecordSummaryCard title="Spending and payments" id={recordSectionId("spending")}>
            <WorkspaceFieldGrid columns={3}>
              <WorkspaceField label="Statement balance">
                <span className="type-finance tabular-nums">
                  {formatAltaCardCurrency(card.statementBalance)}
                </span>
              </WorkspaceField>
              <WorkspaceField label="Minimum payment">
                <span className="type-finance tabular-nums">
                  {formatAltaCardCurrency(card.minimumPaymentDue)}
                </span>
              </WorkspaceField>
              <WorkspaceField label="Due date">
                {card.dueDate || card.paymentDueDate
                  ? formatAltaCardBillingDate(card.dueDate ?? card.paymentDueDate)
                  : "—"}
              </WorkspaceField>
              {ops.lastPayment ? (
                <WorkspaceField label="Last payment">
                  <span className="type-finance tabular-nums">
                    {formatAltaCardCurrency(ops.lastPayment.amount)}
                  </span>
                  <span className="ml-1.5 text-muted-foreground">
                    · {formatDueDate(ops.lastPayment.createdAt)}
                  </span>
                </WorkspaceField>
              ) : null}
              {ops.lastTransaction ? (
                <WorkspaceField label="Last transaction">
                  <span className="type-finance tabular-nums">
                    {formatAltaCardTransactionSummary(
                      ops.lastTransaction.type,
                      ops.lastTransaction.amount,
                    )}
                  </span>
                </WorkspaceField>
              ) : null}
            </WorkspaceFieldGrid>
          </RecordSummaryCard>
        ) : null}

        <RecordSummaryCard
          title="Recent activity"
          id={recordSectionId("recent")}
          actions={
            <button
              type="button"
              className="text-[12px] text-gold hover:underline"
              onClick={() =>
                void navigate({
                  to: ".",
                  search: () => cardSearchParams({ tab: "activity" }),
                })
              }
            >
              Full activity →
            </button>
          }
        >
          {recentEvents.length === 0 ? (
            <RecordEmptyCopy>No recent activity.</RecordEmptyCopy>
          ) : (
            <ul className="space-y-1.5">
              {recentEvents.map((event) => (
                <li
                  key={event.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 text-[12px]"
                >
                  {event.href ? (
                    <Link to={event.href} className="min-w-0 break-words hover:text-gold">
                      {event.title}
                    </Link>
                  ) : (
                    <span className="min-w-0 break-words">{event.title}</span>
                  )}
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                    {formatActivityDateTime(event.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </RecordSummaryCard>

        <RecordSummaryCard title="Related records" id={recordSectionId("related")}>
          <ul className="space-y-1.5 text-[12px]">
            {ownerUserId ? (
              <li>
                <Link
                  to="/internal/users/$userId"
                  params={{ userId: ownerUserId }}
                  search={withInternalSiteSearch(INTERNAL_USER_WORKSPACE_SEARCH, search.site)}
                  className="text-gold hover:underline"
                >
                  Customer · {holderLabel}
                </Link>
              </li>
            ) : null}
            {companyId ? (
              <li>
                <Link
                  to="/internal/companies/$companyId"
                  params={{ companyId }}
                  search={withInternalSiteSearch(INTERNAL_COMPANY_WORKSPACE_SEARCH, search.site)}
                  className="text-gold hover:underline"
                >
                  Company · {card.companyName ?? companyId}
                </Link>
              </li>
            ) : null}
            {paymentAccountId ? (
              <li>
                <Link
                  to="/internal/bank/accounts/$accountId"
                  params={{ accountId: paymentAccountId }}
                  search={withInternalSiteSearch(INTERNAL_ACCOUNT_WORKSPACE_SEARCH, search.site)}
                  className="text-gold hover:underline"
                >
                  Payment account · {paymentAccountLabel}
                </Link>
              </li>
            ) : null}
            {!ownerUserId && !companyId && !paymentAccountId ? (
              <RecordEmptyCopy>No related records.</RecordEmptyCopy>
            ) : null}
          </ul>
        </RecordSummaryCard>
      </div>
    ),
  };

  const activity: RecordWorkspaceTab = {
    id: "activity",
    label: "Activity",
    content: (
      <RecordActivityTimeline
        events={timeline}
        filter={search.filter}
        onFilterChange={setActivityFilter}
        filters={CARD_ACTIVITY_FILTERS}
        filterLabels={CARD_ACTIVITY_FILTER_LABELS}
        scope="card"
      />
    ),
  };

  const controlsOpen =
    search.section === "controls" ||
    search.section === "statements" ||
    search.section === "autopay" ||
    search.section === "employees";

  const more: RecordWorkspaceTab = {
    id: "more",
    label: "More",
    content: (
      <div className="space-y-2">
        <RecordMoreSection
          id={recordSectionId("controls")}
          title="Controls"
          defaultOpen={controlsOpen}
        >
          <InternalAltaCardDetailIntegration
            ops={props.ops}
            statements={props.statements}
            fees={props.fees}
            autopay={props.autopay}
            integration={integration}
            ownerUserId={ownerUserId}
            searchDefaults={props.searchDefaults}
          />
        </RecordMoreSection>
        {ownerUserId ? (
          <RecordMoreSection
            id={recordSectionId("notes")}
            title="Internal notes"
            defaultOpen={search.section === "notes"}
          >
            <p className="mb-2 text-[12px] text-muted-foreground">
              Notes are stored on the cardholder customer record.
            </p>
            <InternalNotePanel targetType="USER" targetId={ownerUserId} initialNotes={notes} />
          </RecordMoreSection>
        ) : null}
        <RecordMoreSection
          id={recordSectionId("audit")}
          title="Complete audit history"
          defaultOpen={search.section === "audit"}
        >
          <WorkspaceAuditLink entityType="ALTA_CARD" entityId={card.id} />
          <div className="mt-2">
            <InternalAuditTable rows={auditLogs} />
          </div>
        </RecordMoreSection>
        <RecordMoreSection
          id={recordSectionId("technical")}
          title="Technical details"
          defaultOpen={search.section === "technical"}
        >
          <WorkspaceFieldGrid columns={2}>
            <WorkspaceField label="Card ID">
              <span className="break-all font-mono text-[11px]">{card.id}</span>
            </WorkspaceField>
            <WorkspaceField label="Last four">
              <span className="font-mono text-[11px]">{maskedLastFour}</span>
            </WorkspaceField>
            <WorkspaceField label="Type">{card.cardType}</WorkspaceField>
            {companyId ? (
              <WorkspaceField label="Company ID">
                <span className="break-all font-mono text-[11px]">{companyId}</span>
              </WorkspaceField>
            ) : null}
            {ownerUserId ? (
              <WorkspaceField label="Owner user ID">
                <span className="break-all font-mono text-[11px]">{ownerUserId}</span>
              </WorkspaceField>
            ) : null}
          </WorkspaceFieldGrid>
        </RecordMoreSection>
      </div>
    ),
  };

  const actions = (
    <RecordActionsSheet title="Alta Card actions" description={`Actions for ${maskedLastFour}`}>
      <RecordActionGroup title="Status">
        <div className="flex flex-wrap gap-2">
          {card.status === "pending" ? (
            <OpsAction
              label="Activate"
              variant="primary"
              title="Activate card"
              description="Sets the card to active for spending."
              impact={maskedLastFour}
              onConfirm={async (reason) => {
                await runStatusChange("active", reason);
              }}
            />
          ) : null}
          {card.status === "active" ? (
            <>
              <OpsAction
                label="Freeze card"
                variant="danger"
                title="Freeze card"
                description="Blocks new charges on this card."
                impact={maskedLastFour}
                onConfirm={async (reason) => {
                  await runStatusChange("frozen", reason);
                }}
              />
              <OpsAction
                label="Mark card lost"
                variant="danger"
                title="Mark card lost"
                description="Marks the card as lost and blocks charges."
                impact={maskedLastFour}
                onConfirm={async (reason) => {
                  await runStatusChange("lost", reason);
                }}
              />
              <OpsAction
                label="Mark card delinquent"
                variant="danger"
                title="Mark card delinquent"
                description="Flags the card for delinquency handling."
                impact={maskedLastFour}
                onConfirm={async (reason) => {
                  await runStatusChange("delinquent", reason);
                }}
              />
              <OpsAction
                label="Close card"
                variant="danger"
                title="Close card"
                description="Permanently closes the card."
                impact={maskedLastFour}
                onConfirm={async (reason) => {
                  await runStatusChange("closed", reason);
                }}
              />
            </>
          ) : null}
          {card.status === "frozen" || card.status === "delinquent" ? (
            <OpsAction
              label="Restore active"
              variant="primary"
              title="Restore card to active"
              description="Restores normal card activity."
              impact={maskedLastFour}
              onConfirm={async (reason) => {
                await runStatusChange("active", reason);
              }}
            />
          ) : null}
          {card.status === "lost" ? (
            <OpsAction
              label="Close card"
              variant="danger"
              title="Close lost card"
              description="Closes the lost card permanently."
              impact={maskedLastFour}
              onConfirm={async (reason) => {
                await runStatusChange("closed", reason);
              }}
            />
          ) : null}
          {card.status === "closed" && admin ? (
            <OpsAction
              label="Reopen (admin)"
              variant="primary"
              title="Reopen closed card"
              description="Admin override to restore a closed card to active."
              impact={maskedLastFour}
              onConfirm={async (reason) => {
                await runStatusChange("active", reason, true);
              }}
            />
          ) : null}
        </div>
      </RecordActionGroup>
      <RecordActionGroup title="Administration">
        <div className="flex flex-wrap gap-2">
          <ActionNav
            label="Card controls"
            onClick={() =>
              void navigate({
                to: ".",
                search: () => cardSearchParams({ tab: "more", section: "controls" }),
              })
            }
          />
          <ActionNav
            label="Statements"
            onClick={() =>
              void navigate({
                to: ".",
                search: () => cardSearchParams({ tab: "more", section: "statements" }),
              })
            }
          />
          <ActionNav
            label="Autopay"
            onClick={() =>
              void navigate({
                to: ".",
                search: () => cardSearchParams({ tab: "more", section: "autopay" }),
              })
            }
          />
          {card.cardType === "business" ? (
            <ActionNav
              label="Employee cards"
              onClick={() =>
                void navigate({
                  to: ".",
                  search: () => cardSearchParams({ tab: "more", section: "employees" }),
                })
              }
            />
          ) : null}
          {ownerUserId ? (
            <ActionNav
              label="Add internal note"
              onClick={() =>
                void navigate({
                  to: ".",
                  search: () => cardSearchParams({ tab: "more", section: "notes" }),
                })
              }
            />
          ) : null}
        </div>
      </RecordActionGroup>
      <RecordActionGroup title="Related">
        <div className="flex flex-col gap-1.5">
          {ownerUserId ? (
            <Link
              to="/internal/users/$userId"
              params={{ userId: ownerUserId }}
              search={withInternalSiteSearch(INTERNAL_USER_WORKSPACE_SEARCH, search.site)}
              className="text-[12px] text-gold hover:underline"
            >
              Open customer
            </Link>
          ) : null}
          {companyId ? (
            <Link
              to="/internal/companies/$companyId"
              params={{ companyId }}
              search={withInternalSiteSearch(INTERNAL_COMPANY_WORKSPACE_SEARCH, search.site)}
              className="text-[12px] text-gold hover:underline"
            >
              Open company
            </Link>
          ) : null}
          {paymentAccountId ? (
            <Link
              to="/internal/bank/accounts/$accountId"
              params={{ accountId: paymentAccountId }}
              search={withInternalSiteSearch(INTERNAL_ACCOUNT_WORKSPACE_SEARCH, search.site)}
              className="text-[12px] text-gold hover:underline"
            >
              Open payment account
            </Link>
          ) : null}
        </div>
      </RecordActionGroup>
    </RecordActionsSheet>
  );

  return (
    <RecordWorkspacePage
      title={title}
      breadcrumbs={breadcrumbs}
      recordType="Alta Card"
      primaryId={<>{maskedLastFour}</>}
      status={statusLabel}
      meta={
        <>
          <span>{holderLabel}</span>
          {card.companyName ? <span>{card.companyName}</span> : null}
          <span className="type-finance tabular-nums">
            {formatAltaCardCurrency(card.currentBalance)}
          </span>
          <span className="type-finance tabular-nums text-muted-foreground">
            {formatAltaCardCurrency(card.availableCredit)} avail.
          </span>
        </>
      }
      warning={
        attention.length > 0 ? (
          <span className="text-[12px] text-amber-700 dark:text-amber-300">
            {attention.map((a) => a.label).slice(0, 2).join(" · ")}
          </span>
        ) : null
      }
      headerActions={actions}
      tabs={[overview, activity, more]}
      search={search}
    />
  );
}

function ActionNav({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded border border-border px-2.5 py-1.5 text-left text-[12px] hover:border-border-strong"
    >
      {label}
    </button>
  );
}

function buildAltaCardAttention({
  card,
  autopay,
  recommendationPending,
}: {
  card: AltaCardWorkspaceProps["ops"]["card"];
  autopay: AltaCardWorkspaceProps["autopay"];
  recommendationPending: boolean;
}) {
  const items: Array<{ id: string; label: string; detail?: string }> = [];
  if (
    card.status === "frozen" ||
    card.status === "lost" ||
    card.status === "delinquent" ||
    card.status === "closed"
  ) {
    items.push({
      id: "status",
      label: "Card status",
      detail: altaCardStatusLabel(card.status),
    });
  }
  const autopaySettings = autopay.context?.settings;
  if (autopaySettings && (autopaySettings.lastStatus === "failed" || autopaySettings.failureReason)) {
    items.push({
      id: "autopay",
      label: "Failed autopay",
      detail: autopaySettings.failureReason ?? undefined,
    });
  }
  if (recommendationPending) {
    items.push({
      id: "recommendation",
      label: "Relationship recommendation pending",
      detail: "Confirm suggested terms in Controls before saving.",
    });
  }
  return items;
}
