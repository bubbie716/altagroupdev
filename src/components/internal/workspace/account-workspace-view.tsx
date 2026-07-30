"use client";

import { Link, useNavigate } from "@tanstack/react-router";
import {
  INTERNAL_TRANSACTION_WORKSPACE_SEARCH,
  INTERNAL_USER_WORKSPACE_SEARCH,
  INTERNAL_COMPANY_WORKSPACE_SEARCH,
  withInternalSiteSearch,
} from "@/lib/internal/internal-route-search";
import { StatusBadge } from "@/components/internal/status-badge";
import { OpsAction } from "@/components/internal/ops-action";
import { InternalAccountAdjustmentForm } from "@/components/internal/internal-account-adjustment-form";
import { InternalAccountOpsPanel } from "@/components/internal/internal-account-ops-panel";
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
import {
  approveBankAccountOpening,
  closeBankAccountRecord,
  freezeBankAccountRecord,
  unfreezeBankAccountRecord,
} from "@/lib/bank/bank.functions";
import { florin } from "@/lib/bank/api";
import { formatActivityDateTime } from "@/lib/format-datetime";
import type { InternalBankTransactionRow } from "@/lib/bank/backend-types";
import type { AuditLogRow } from "@/lib/internal/audit.types";
import type { TimelineEvent } from "@/lib/internal/ops-types";
import type { InternalNoteRow } from "@/lib/internal/internal-note.types";
import {
  ACCOUNT_ACTIVITY_FILTERS,
  ACCOUNT_ACTIVITY_FILTER_LABELS,
} from "@/lib/internal/record-activity-filters";
import {
  recordSectionId,
  toRecordWorkspaceSearchParams,
  type RecordActivityFilter,
  type RecordWorkspaceSearch,
} from "@/lib/internal/record-workspace-search";
import { parseReturnPath } from "@/lib/internal/record-return-context";
import { plainTransactionTypeTitle } from "@/lib/internal/transaction-record-copy";

type AccountWorkspaceData = {
  account: Awaited<ReturnType<typeof import("@/lib/bank/bank.functions").fetchInternalBankAccountDetail>>;
  auditLogs: AuditLogRow[];
  notes: InternalNoteRow[];
  ops: Awaited<ReturnType<typeof import("@/lib/internal/ops-platform.functions").fetchAccountOpsSummary>>;
  timeline: TimelineEvent[];
};

export function AccountWorkspaceView({
  data,
  search,
}: {
  data: AccountWorkspaceData;
  search: RecordWorkspaceSearch;
}) {
  const navigate = useNavigate();
  const { account, auditLogs, notes, ops, timeline } = data;
  const available =
    ops.activeHoldTotal > 0 ? Math.max(0, account.balance - ops.activeHoldTotal) : account.balance;
  const pendingIn = account.pendingTransactions.filter((t) =>
    /deposit/i.test(t.type),
  );
  const pendingOut = account.pendingTransactions.filter((t) =>
    /withdraw/i.test(t.type),
  );
  const attention = buildAccountAttention({ account, ops, pendingIn, pendingOut });
  const recentEvents = [...account.pendingTransactions, ...account.recentTransactions]
    .sort((a, b) => b.submitted.localeCompare(a.submitted))
    .slice(0, 5);

  const returnCtx = parseReturnPath(search.from);
  const breadcrumbs =
    returnCtx?.pathname === "/internal/inbox"
      ? workspaceBreadcrumbs([
          { label: "Home", to: "/internal" },
          { label: "Inbox", to: "/internal/inbox", search: returnCtx.search },
          { label: account.accountNumber },
        ])
      : returnCtx?.pathname.startsWith("/internal/users")
        ? workspaceBreadcrumbs([
            { label: "Home", to: "/internal" },
            { label: "Customers", to: "/internal/users" },
            { label: account.holder, to: returnCtx.pathname, search: returnCtx.search },
            { label: account.accountNumber },
          ])
        : returnCtx?.pathname.startsWith("/internal/companies")
          ? workspaceBreadcrumbs([
              { label: "Home", to: "/internal" },
              { label: "Companies", to: "/internal/companies" },
              {
                label: account.companyName ?? "Company",
                to: returnCtx.pathname,
                search: returnCtx.search,
              },
              { label: account.accountNumber },
            ])
          : workspaceBreadcrumbs([
              { label: "Home", to: "/internal" },
              { label: "Accounts", to: "/internal/bank/accounts" },
              { label: account.accountNumber },
            ]);

  function setActivityFilter(filter: RecordActivityFilter) {
    void navigate({
      to: ".",
      search: () =>
        toRecordWorkspaceSearchParams({
          tab: "activity",
          filter,
          from: search.from,
          site: search.site,
        }),
    });
  }

  const overview: RecordWorkspaceTab = {
    id: "overview",
    label: "Overview",
    content: (
      <div className="space-y-3">
        {attention.length > 0 ? <RecordAttentionBanner items={attention} /> : null}

        <RecordSummaryCard title="Balance" id={recordSectionId("balance")}>
          <WorkspaceFieldGrid columns={4}>
            <WorkspaceField label="Current">
              <span className="type-finance tabular-nums text-[14px]">{florin(account.balance)}</span>
            </WorkspaceField>
            {ops.activeHoldTotal > 0 ? (
              <WorkspaceField label="Available">
                <span className="type-finance tabular-nums">{florin(available)}</span>
              </WorkspaceField>
            ) : null}
            {ops.activeHoldTotal > 0 ? (
              <WorkspaceField label="Held">
                <span className="type-finance tabular-nums">{florin(ops.activeHoldTotal)}</span>
              </WorkspaceField>
            ) : null}
            {pendingIn.length > 0 ? (
              <WorkspaceField label="Pending in">{pendingIn.length}</WorkspaceField>
            ) : null}
            {pendingOut.length > 0 ? (
              <WorkspaceField label="Pending out">{pendingOut.length}</WorkspaceField>
            ) : null}
          </WorkspaceFieldGrid>
        </RecordSummaryCard>

        <RecordSummaryCard title="Account details" id={recordSectionId("details")}>
          <WorkspaceFieldGrid columns={3}>
            <WorkspaceField label="Product">{account.product}</WorkspaceField>
            <WorkspaceField label="Ownership">
              {account.companyId ? "Company" : "Personal"}
            </WorkspaceField>
            <WorkspaceField label="Opened">
              <span className="font-mono text-[11px]">{account.createdAt.slice(0, 10)}</span>
            </WorkspaceField>
            <WorkspaceField label="Owner">
              {account.ownerUserId ? (
                <Link
                  to="/internal/users/$userId"
                  params={{ userId: account.ownerUserId }}
                  search={withInternalSiteSearch(INTERNAL_USER_WORKSPACE_SEARCH, search.site)}
                  className="break-words hover:text-gold"
                >
                  {account.holder}
                </Link>
              ) : (
                account.holder
              )}
            </WorkspaceField>
            {account.companyId ? (
              <WorkspaceField label="Company">
                <Link
                  to="/internal/companies/$companyId"
                  params={{ companyId: account.companyId }}
                  search={withInternalSiteSearch(INTERNAL_COMPANY_WORKSPACE_SEARCH, search.site)}
                  className="break-words hover:text-gold"
                >
                  {account.companyName ?? account.companyId}
                </Link>
              </WorkspaceField>
            ) : null}
            <WorkspaceField label="Routing">
              <span className="font-mono text-[11px]">{account.routingNumber}</span>
            </WorkspaceField>
          </WorkspaceFieldGrid>
        </RecordSummaryCard>

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
                  search: () =>
                    toRecordWorkspaceSearchParams({
                      tab: "activity",
                      from: search.from,
                      site: search.site,
                    }),
                })
              }
            >
              Full activity →
            </button>
          }
        >
          {recentEvents.length === 0 ? (
            <RecordEmptyCopy>No recent transactions.</RecordEmptyCopy>
          ) : (
            <ul className="space-y-1.5">
              {recentEvents.map((tx) => (
                <li key={tx.id} className="flex flex-wrap items-baseline justify-between gap-2 text-[12px]">
                  <Link
                    to="/internal/bank/transactions/$transactionId"
                    params={{ transactionId: tx.id }}
                    search={{
                      ...withInternalSiteSearch(INTERNAL_TRANSACTION_WORKSPACE_SEARCH, search.site),
                      ...(search.from
                        ? {
                            from: `/internal/bank/accounts/${account.id}?tab=overview`,
                          }
                        : {}),
                    }}
                    className="min-w-0 break-words hover:text-gold"
                  >
                    {plainTransactionTypeTitle(tx.type, tx.description)}
                    <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">
                      {tx.referenceCode}
                    </span>
                  </Link>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="type-finance tabular-nums">{tx.amount}</span>
                    <StatusBadge status={tx.status} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </RecordSummaryCard>

        <RecordSummaryCard title="Related records" id={recordSectionId("related")}>
          <ul className="space-y-1.5 text-[12px]">
            {account.ownerUserId ? (
              <li>
                <Link
                  to="/internal/users/$userId"
                  params={{ userId: account.ownerUserId }}
                  search={withInternalSiteSearch(INTERNAL_USER_WORKSPACE_SEARCH, search.site)}
                  className="text-gold hover:underline"
                >
                  Customer · {account.holder}
                </Link>
              </li>
            ) : null}
            {account.companyId ? (
              <li>
                <Link
                  to="/internal/companies/$companyId"
                  params={{ companyId: account.companyId }}
                  search={withInternalSiteSearch(INTERNAL_COMPANY_WORKSPACE_SEARCH, search.site)}
                  className="text-gold hover:underline"
                >
                  Company · {account.companyName ?? account.companyId}
                </Link>
              </li>
            ) : null}
            {account.pendingTransactions.slice(0, 3).map((tx) => (
              <li key={tx.id}>
                <Link
                  to="/internal/bank/transactions/$transactionId"
                  params={{ transactionId: tx.id }}
                  search={withInternalSiteSearch(INTERNAL_TRANSACTION_WORKSPACE_SEARCH, search.site)}
                  className="text-gold hover:underline"
                >
                  Pending {plainTransactionTypeTitle(tx.type, tx.description).toLowerCase()} ·{" "}
                  {tx.referenceCode}
                </Link>
              </li>
            ))}
            {ops.scheduled.length > 0 ? (
              <li>
                <Link
                  to="/internal/bank/transfers"
                  search={withInternalSiteSearch(
                    { status: "scheduled" as const },
                    search.site,
                  )}
                  className="text-gold hover:underline"
                >
                  Scheduled transfers ({ops.scheduled.length})
                </Link>
              </li>
            ) : null}
            {!account.ownerUserId && !account.companyId && account.pendingTransactions.length === 0 && ops.scheduled.length === 0 ? (
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
        filters={ACCOUNT_ACTIVITY_FILTERS}
        filterLabels={ACCOUNT_ACTIVITY_FILTER_LABELS}
        scope="account"
      />
    ),
  };

  const more: RecordWorkspaceTab = {
    id: "more",
    label: "More",
    content: (
      <div className="space-y-2">
        <RecordMoreSection
          id={recordSectionId("statements")}
          title="Statements"
          defaultOpen={search.section === "statements"}
        >
          {ops.statements.length === 0 ? (
            <RecordEmptyCopy>No statements generated.</RecordEmptyCopy>
          ) : (
            <ul className="space-y-1.5 text-[12px]">
              {ops.statements.map((s) => (
                <li key={s.id} className="flex flex-wrap justify-between gap-2">
                  <span className="font-mono text-[11px]">{s.statementNumber}</span>
                  <span className="text-muted-foreground">
                    {s.periodEnd.slice(0, 10)} · {s.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link
            to="/internal/bank/statements"
            search={withInternalSiteSearch({}, search.site)}
            className="mt-2 inline-block text-[12px] text-gold hover:underline"
          >
            Statement ops →
          </Link>
        </RecordMoreSection>
        <RecordMoreSection
          id={recordSectionId("holds")}
          title="Holds and restrictions"
          defaultOpen={search.section === "holds"}
        >
          <InternalAccountOpsPanel
            accountId={account.id}
            accountNumber={account.accountNumber}
            status={account.status}
            restrictions={ops.restrictions}
            holds={ops.holds}
            activeHoldTotal={ops.activeHoldTotal}
          />
          <div className="mt-3">
            <p className="mb-2 text-[12px] font-medium">Manual adjustment</p>
            <InternalAccountAdjustmentForm accountId={account.id} />
          </div>
        </RecordMoreSection>
        <RecordMoreSection
          id={recordSectionId("notes")}
          title="Internal notes"
          defaultOpen={search.section === "notes"}
        >
          <InternalNotePanel targetType="BANK_ACCOUNT" targetId={account.id} initialNotes={notes} />
        </RecordMoreSection>
        <RecordMoreSection
          id={recordSectionId("audit")}
          title="Complete audit history"
          defaultOpen={search.section === "audit"}
        >
          <WorkspaceAuditLink entityType="BANK_ACCOUNT" entityId={account.id} site={search.site} />
          <div className="mt-2">
            <InternalAuditTable rows={auditLogs} showAccount={false} />
          </div>
        </RecordMoreSection>
        <RecordMoreSection
          id={recordSectionId("technical")}
          title="Technical details"
          defaultOpen={search.section === "technical"}
        >
          <WorkspaceFieldGrid columns={2}>
            <WorkspaceField label="Account ID">
              <span className="break-all font-mono text-[11px]">{account.id}</span>
            </WorkspaceField>
            <WorkspaceField label="Account number">
              <span className="font-mono text-[11px]">{account.accountNumber}</span>
            </WorkspaceField>
            <WorkspaceField label="Routing">
              <span className="font-mono text-[11px]">{account.routingNumber}</span>
            </WorkspaceField>
            {account.ownerUserId ? (
              <WorkspaceField label="Owner ID">
                <span className="break-all font-mono text-[11px]">{account.ownerUserId}</span>
              </WorkspaceField>
            ) : null}
            {account.companyId ? (
              <WorkspaceField label="Company ID">
                <span className="break-all font-mono text-[11px]">{account.companyId}</span>
              </WorkspaceField>
            ) : null}
            <WorkspaceField label="Created">
              <span className="font-mono text-[11px]">{formatActivityDateTime(account.createdAt)}</span>
            </WorkspaceField>
            <WorkspaceField label="Updated">
              <span className="font-mono text-[11px]">{formatActivityDateTime(account.updatedAt)}</span>
            </WorkspaceField>
            <WorkspaceField label="Product">{account.product}</WorkspaceField>
          </WorkspaceFieldGrid>
        </RecordMoreSection>
      </div>
    ),
  };

  const actions = (
    <RecordActionsSheet title="Account actions" description={`Actions for ${account.accountName}`}>
      <RecordActionGroup title="Status">
        <div className="flex flex-wrap gap-2">
          {account.status === "Under Review" ? (
            <OpsAction
              label="Approve opening"
              variant="primary"
              title="Approve account opening"
              description="Activates the account for banking activity."
              impact={account.accountNumber}
              onConfirm={async (reason) => {
                await approveBankAccountOpening({
                  data: { accountId: account.id, reviewNote: reason },
                });
              }}
            />
          ) : null}
          {account.status !== "Frozen" && account.status !== "Closed" ? (
            <OpsAction
              label="Freeze account"
              variant="danger"
              title="Freeze account"
              description="Blocks debits and most activity."
              impact={florin(account.balance)}
              customerNotifies
              onConfirm={async (reason, options) => {
                await freezeBankAccountRecord({
                  data: {
                    accountId: account.id,
                    reviewNote: reason,
                    silentNotification: options?.silentNotification,
                  },
                });
              }}
            />
          ) : null}
          {account.status === "Frozen" ? (
            <OpsAction
              label="Unfreeze account"
              variant="primary"
              title="Unfreeze account"
              description="Restores normal activity."
              customerNotifies
              onConfirm={async (reason, options) => {
                await unfreezeBankAccountRecord({
                  data: {
                    accountId: account.id,
                    reviewNote: reason,
                    silentNotification: options?.silentNotification,
                  },
                });
              }}
            />
          ) : null}
          {account.status !== "Closed" && account.balance === 0 ? (
            <OpsAction
              label="Close account"
              variant="danger"
              title="Close account"
              description="Permanently closes the account."
              customerNotifies
              onConfirm={async (reason, options) => {
                await closeBankAccountRecord({
                  data: {
                    accountId: account.id,
                    reviewNote: reason,
                    silentNotification: options?.silentNotification,
                  },
                });
              }}
            />
          ) : null}
        </div>
      </RecordActionGroup>
      <RecordActionGroup title="Administration">
        <div className="flex flex-wrap gap-2">
          <ActionNav
            label="Holds and restrictions"
            onClick={() =>
              void navigate({
                to: ".",
                search: () =>
                  toRecordWorkspaceSearchParams({
                    tab: "more",
                    section: "holds",
                    from: search.from,
                    site: search.site,
                  }),
              })
            }
          />
          <ActionNav
            label="View statements"
            onClick={() =>
              void navigate({
                to: ".",
                search: () =>
                  toRecordWorkspaceSearchParams({
                    tab: "more",
                    section: "statements",
                    from: search.from,
                    site: search.site,
                  }),
              })
            }
          />
          <ActionNav
            label="Add internal note"
            onClick={() =>
              void navigate({
                to: ".",
                search: () =>
                  toRecordWorkspaceSearchParams({
                    tab: "more",
                    section: "notes",
                    from: search.from,
                    site: search.site,
                  }),
              })
            }
          />
        </div>
      </RecordActionGroup>
      <RecordActionGroup title="Related">
        <div className="flex flex-col gap-1.5">
          {account.ownerUserId ? (
            <Link
              to="/internal/users/$userId"
              params={{ userId: account.ownerUserId }}
              search={withInternalSiteSearch(INTERNAL_USER_WORKSPACE_SEARCH, search.site)}
              className="text-[12px] text-gold hover:underline"
            >
              Open customer
            </Link>
          ) : null}
          {account.companyId ? (
            <Link
              to="/internal/companies/$companyId"
              params={{ companyId: account.companyId }}
              search={withInternalSiteSearch(INTERNAL_COMPANY_WORKSPACE_SEARCH, search.site)}
              className="text-[12px] text-gold hover:underline"
            >
              Open company
            </Link>
          ) : null}
          {pendingIn.length + pendingOut.length > 0 ? (
            <Link
              to="/internal/inbox"
              search={withInternalSiteSearch({ category: "money" }, search.site)}
              className="text-[12px] text-gold hover:underline"
            >
              Open pending Inbox cases
            </Link>
          ) : null}
          {ops.scheduled.length > 0 ? (
            <Link
              to="/internal/bank/transfers"
              search={withInternalSiteSearch(
                { status: "scheduled" as const },
                search.site,
              )}
              className="text-[12px] text-gold hover:underline"
            >
              Open scheduled transfers
            </Link>
          ) : null}
        </div>
      </RecordActionGroup>
    </RecordActionsSheet>
  );

  return (
    <RecordWorkspacePage
      title={account.accountName}
      breadcrumbs={breadcrumbs}
      recordType={account.product || "Bank account"}
      primaryId={<>{account.accountNumber}</>}
      status={account.status}
      meta={
        <>
          <span>{account.holder}</span>
          <span className="type-finance tabular-nums">{florin(account.balance)}</span>
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

function buildAccountAttention({
  account,
  ops,
  pendingIn,
  pendingOut,
}: {
  account: AccountWorkspaceData["account"];
  ops: AccountWorkspaceData["ops"];
  pendingIn: InternalBankTransactionRow[];
  pendingOut: InternalBankTransactionRow[];
}) {
  const items: Array<{ id: string; label: string; detail?: string }> = [];
  const status = account.status.toLowerCase();
  if (status.includes("frozen") || status.includes("restrict") || status.includes("review") || status.includes("closed") || status.includes("pending")) {
    items.push({ id: "status", label: "Account status", detail: account.status });
  }
  if (account.balance < 0) {
    items.push({ id: "neg", label: "Negative balance", detail: florin(account.balance) });
  }
  if (ops.activeHoldTotal > 0) {
    items.push({
      id: "holds",
      label: "Active hold",
      detail: florin(ops.activeHoldTotal),
    });
  }
  if (ops.restrictions.restrictDeposits || ops.restrictions.restrictWithdrawals || ops.restrictions.restrictTransfers) {
    items.push({ id: "restrict", label: "Restrictions active" });
  }
  if (pendingIn.length > 0) {
    items.push({ id: "pending-in", label: "Pending deposit", detail: `${pendingIn.length} open` });
  }
  if (pendingOut.length > 0) {
    items.push({ id: "pending-out", label: "Pending withdrawal", detail: `${pendingOut.length} open` });
  }
  for (const s of ops.scheduled.filter((x) => /fail/i.test(x.status))) {
    items.push({ id: `sched-${s.id}`, label: "Failed scheduled transfer", detail: s.label });
  }
  return items;
}

export type { AccountWorkspaceData };
