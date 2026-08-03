"use client";

import { useNavigate } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import {
  INTERNAL_ACCOUNT_WORKSPACE_SEARCH,
  INTERNAL_ALTA_CARD_WORKSPACE_SEARCH,
  INTERNAL_COMPANY_WORKSPACE_SEARCH,
  INTERNAL_LOAN_WORKSPACE_SEARCH,
  withInternalSiteSearch,
} from "@/lib/internal/internal-route-search";
import { StatusBadge } from "@/components/internal/status-badge";
import { InternalUserTagPanel } from "@/components/internal/internal-user-tag-panel";
import { InternalDiscordRolePanel } from "@/components/internal/internal-discord-role-panel";
import { InternalUserAccountStatusPanel } from "@/components/internal/internal-user-account-status-panel";
import { OpsReviewFlagsPanel } from "@/components/internal/ops-review-flags-panel";
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
} from "@/components/internal/workspace/record-workspace-layout";
import { RecordActivityTimeline } from "@/components/internal/workspace/record-activity-timeline";
import {
  RecordActionGroup,
  RecordActionNavButton,
  RecordActionsSheet,
} from "@/components/internal/workspace/record-actions-sheet";
import { WorkspaceField, WorkspaceFieldGrid } from "@/components/internal/workspace/workspace-fields";
import type { RecordWorkspaceTab } from "@/components/internal/workspace/record-workspace-layout";
import { formatAccountStatus } from "@/lib/auth/tags";
import { florin } from "@/lib/bank/api";
import { formatAltaUserHandle } from "@/lib/auth/user-display";
import { displayRelationshipTierLabel } from "@/lib/bank/relationship-terminology";
import type { InternalUserDetail } from "@/lib/internal/user-management.types";
import type { TimelineEvent } from "@/lib/internal/ops-types";
import type { OpsReviewFlagRow } from "@/lib/internal/ops-review-flag.types";
import {
  CUSTOMER_ACTIVITY_FILTERS,
  recordSectionId,
  toRecordWorkspaceSearchParams,
  type RecordActivityFilter,
  type RecordWorkspaceSearch,
} from "@/lib/internal/record-workspace-search";
import { eventMatchesActivityFilter } from "@/lib/internal/record-activity-filters";
import { limitRelatedRecords } from "@/lib/internal/directory-desk";
import { parseReturnPath } from "@/lib/internal/record-return-context";
import { useCurrentUser } from "@/hooks/use-current-user";
import { canAccessBankInternal } from "@/lib/auth/permissions";
import { TerminalOwnerPortfoliosBlock } from "@/components/internal/workspace/terminal-owner-portfolios-block";
import { CustomerOnboardingSummaryPanel } from "@/components/internal/workspace/customer-onboarding-summary-panel";
import type { CustomerOnboardingSummary } from "@/lib/onboarding/onboarding-types";

type CustomerWorkspaceData = {
  user: InternalUserDetail;
  notes: import("@/lib/internal/internal-note.types").InternalNoteRow[];
  timeline: TimelineEvent[];
  altaPayActivity: Array<{
    id: string;
    accountId: string;
    direction: string;
    referenceCode: string;
    amount: number;
    accountName: string;
    accountNumber: string;
    createdAt: string;
  }>;
  operatorPanel: {
    panel: import("@/lib/bank/relationship-intelligence-types").RelationshipIntelligencePanelData | null;
    recommendations: import("@/lib/bank/relationship-intelligence-types").RelationshipRecommendationRow[];
    timelinePreview: import("@/lib/bank/relationship-intelligence-types").RelationshipTimelineEventRow[];
    preApprovalReadiness: import("@/lib/bank/relationship-intelligence-types").PreApprovalReadiness | null;
    altaCardId: string | null;
  };
  reviewFlags?: OpsReviewFlagRow[];
  onboardingSummary?: CustomerOnboardingSummary | null;
};

export function CustomerWorkspaceView({
  data,
  search,
}: {
  data: CustomerWorkspaceData;
  search: RecordWorkspaceSearch;
}) {
  const navigate = useNavigate();
  const viewer = useCurrentUser();
  const showBankProducts = viewer ? canAccessBankInternal(viewer) : true;
  const siteKey = search.site ?? "corporate";
  const isTerminalSite = siteKey === "terminal";
  const isBankSite = siteKey === "bank";
  const { user, notes, timeline, operatorPanel, reviewFlags = [], onboardingSummary = null } = data;
  const creditExposure = user.activeLoans.reduce((s, l) => s + l.currentPayoffAmount, 0);
  const panel = operatorPanel.panel;
  const unresolvedFlags = reviewFlags.filter((f) => f.status === "ACTIVE");
  const standingNeedsAttention = ["restricted", "frozen", "pending_review"].includes(user.accountStatus);

  const attention = buildCustomerAttention({
    user,
    unresolvedFlags,
    standingNeedsAttention,
  });

  const activeProducts = [
    user.bankAccounts.length > 0 ? "Bank" : null,
    operatorPanel.altaCardId ? "Alta Card" : null,
    user.activeLoans.length > 0 || user.loanApplications.length > 0 ? "Lending" : null,
    user.companyMemberships.length > 0 ? "Companies" : null,
  ].filter(Boolean) as string[];

  const recommendation = operatorPanel.recommendations[0];

  const accountsLimited = limitRelatedRecords(user.bankAccounts, 4);
  const companiesLimited = limitRelatedRecords(user.companyMemberships, 4);
  const lendingItems = [
    ...user.activeLoans.map((l) => ({ kind: "loan" as const, loan: l })),
    ...user.loanApplications.map((a) => ({ kind: "application" as const, application: a })),
  ];
  const lendingLimited = limitRelatedRecords(lendingItems, 4);

  const activityFilters = customerActivityFilters(timeline, { isTerminalSite, isBankSite });

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

  function navigateMoreSection(section: string) {
    void navigate({
      to: ".",
      search: (prev: Record<string, unknown>) =>
        toRecordWorkspaceSearchParams({
          tab: "more",
          section,
          from: search.from,
          site:
            search.site ??
            (typeof prev.site === "string" && prev.site.trim() ? prev.site.trim() : undefined),
        }),
    });
  }

  const returnCtx = parseReturnPath(search.from);
  const customerLabel = formatAltaUserHandle(user);
  const breadcrumbs =
    returnCtx?.pathname === "/internal/inbox" || returnCtx?.pathname === "/internal/terminal/investors"
      ? workspaceBreadcrumbs([
          { label: "Home", to: "/internal", search: withInternalSiteSearch({}, search.site) },
          {
            label: returnCtx.pathname.includes("investors") ? "Investors" : "Inbox",
            to: returnCtx.pathname as "/",
            search: returnCtx.search,
          },
          { label: customerLabel },
        ])
      : workspaceBreadcrumbs([
          { label: "Home", to: "/internal", search: withInternalSiteSearch({}, search.site) },
          { label: "Customers", to: "/internal/users", search: withInternalSiteSearch({}, search.site) },
          { label: customerLabel },
        ]);

  const bankAccountsBlock = (
    <ProductBlock id={recordSectionId("accounts")} title="Bank accounts" count={user.bankAccounts.length}>
      <ul className="space-y-1.5">
        {accountsLimited.visible.map((a) => (
          <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-2 text-[12px]">
            <Link
              to="/internal/bank/accounts/$accountId"
              params={{ accountId: a.id }}
              search={withInternalSiteSearch(INTERNAL_ACCOUNT_WORKSPACE_SEARCH, search.site)}
              className="min-w-0 break-words hover:text-gold"
            >
              {a.accountName}
              <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">{a.accountNumber}</span>
            </Link>
            <span className="type-finance tabular-nums shrink-0">{florin(a.balance)}</span>
          </li>
        ))}
      </ul>
      {accountsLimited.hasMore ? (
        <Link
          to="/internal/bank/accounts"
          search={withInternalSiteSearch({}, search.site)}
          className="mt-1.5 inline-block text-[11px] text-gold hover:underline"
        >
          View all accounts
        </Link>
      ) : null}
    </ProductBlock>
  );

  const cardsBlock = (
    <ProductBlock
      id={recordSectionId("cards")}
      title="Alta Card"
      count={operatorPanel.altaCardId ? 1 : 0}
    >
      {operatorPanel.altaCardId ? (
        <Link
          to="/internal/alta-card/$cardId"
          params={{ cardId: operatorPanel.altaCardId }}
          search={withInternalSiteSearch(INTERNAL_ALTA_CARD_WORKSPACE_SEARCH, search.site)}
          className="text-[12px] text-gold hover:underline"
        >
          Open Alta Card record →
        </Link>
      ) : null}
    </ProductBlock>
  );

  const lendingBlock = (
    <ProductBlock
      id={recordSectionId("lending")}
      title="Lending"
      count={lendingItems.length}
    >
      <ul className="space-y-1.5 text-[12px]">
        {lendingLimited.visible.map((item) =>
          item.kind === "loan" ? (
            <li key={item.loan.id} className="flex flex-wrap items-baseline justify-between gap-2">
              <Link
                to="/internal/lending/loans/$loanId"
                params={{ loanId: item.loan.id }}
                search={withInternalSiteSearch(INTERNAL_LOAN_WORKSPACE_SEARCH, search.site)}
                className="hover:text-gold"
              >
                {item.loan.productLabel}
              </Link>
              <span className="type-finance tabular-nums">{florin(item.loan.currentPayoffAmount)}</span>
            </li>
          ) : (
            <li
              key={item.application.id}
              className="flex flex-wrap items-baseline justify-between gap-2"
            >
              <Link
                to="/internal/lending/applications/$applicationId"
                params={{ applicationId: item.application.id }}
                search={withInternalSiteSearch({ section: "evidence" }, search.site)}
                className="hover:text-gold"
              >
                {item.application.productLabel} application
              </Link>
              <StatusBadge status={item.application.statusLabel} />
            </li>
          ),
        )}
      </ul>
      {lendingLimited.hasMore ? (
        <Link
          to="/internal/lending/loans"
          search={withInternalSiteSearch({}, search.site)}
          className="mt-1.5 inline-block text-[11px] text-gold hover:underline"
        >
          View all loans
        </Link>
      ) : null}
    </ProductBlock>
  );

  const otherAltaProductsSection = showBankProducts ? (
    <div className="space-y-3 rounded-md border border-border/50 bg-surface-1/30 px-3 py-2.5">
      <h4 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Other Alta products
      </h4>
      {bankAccountsBlock}
      {cardsBlock}
      {lendingBlock}
    </div>
  ) : null;

  const terminalBlock = (
    <ProductBlock id={recordSectionId("terminal")} title="Terminal" count={1}>
      <TerminalOwnerPortfoliosBlock ownerUserId={user.id} site={search.site} />
    </ProductBlock>
  );

  const otherAltaProductsCollapsed = (
    <details className="rounded-md border border-border/50 bg-surface-1/30 px-3 py-2.5">
      <summary className="cursor-pointer text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Other Alta products
      </summary>
      <div className="mt-3 space-y-3">{terminalBlock}</div>
    </details>
  );

  const companiesBlock = (
    <ProductBlock
      id={recordSectionId("companies")}
      title="Company relationships"
      count={user.companyMemberships.length}
    >
      <ul className="space-y-1.5 text-[12px]">
        {companiesLimited.visible.map((m) => (
          <li key={m.companyId} className="flex flex-wrap items-baseline justify-between gap-2">
            <Link
              to="/internal/companies/$companyId"
              params={{ companyId: m.companyId }}
              search={withInternalSiteSearch(INTERNAL_COMPANY_WORKSPACE_SEARCH, search.site)}
              className="min-w-0 break-words hover:text-gold"
            >
              {m.companyName}
            </Link>
            <span className="text-muted-foreground">{m.roleLabel}</span>
          </li>
        ))}
      </ul>
      {companiesLimited.hasMore ? (
        <button
          type="button"
          className="mt-1.5 text-[11px] text-gold hover:underline"
          onClick={() => navigateMoreSection("memberships")}
        >
          View all companies
        </button>
      ) : null}
    </ProductBlock>
  );

  const bankProductBlocks = showBankProducts ? (
    <>
      {user.bankAccounts.length > 0 ? bankAccountsBlock : null}
      {operatorPanel.altaCardId ? cardsBlock : null}
      {lendingItems.length > 0 ? lendingBlock : null}
    </>
  ) : (
    <div
      id={recordSectionId("accounts")}
      className="rounded-md border border-border/60 bg-surface-1/40 px-3 py-2 text-[12px] text-muted-foreground"
    >
      Bank accounts, Alta Card, and Lending are hidden for Terminal-only staff.
    </div>
  );

  const productsContent = isTerminalSite ? (
    <>
      {terminalBlock}
      {user.companyMemberships.length > 0 ? companiesBlock : null}
      {otherAltaProductsSection}
      {!showBankProducts ? bankProductBlocks : null}
    </>
  ) : isBankSite ? (
    <>
      {bankProductBlocks}
    </>
  ) : (
    <>
      {bankProductBlocks}
      {user.companyMemberships.length > 0 ? companiesBlock : null}
      {terminalBlock}
    </>
  );

  const overview: RecordWorkspaceTab = {
    id: "overview",
    label: "Overview",
    content: (
      <div className="space-y-3">
        {attention.length > 0 ? <RecordAttentionBanner items={attention} /> : null}

        {showBankProducts ? (
          <RecordSummaryCard title="Financial relationship" id={recordSectionId("financial")}>
            <WorkspaceFieldGrid columns={4}>
              <WorkspaceField label="Bank assets">
                <span className="type-finance tabular-nums">{florin(user.totalBankBalance)}</span>
              </WorkspaceField>
              <WorkspaceField label="Credit exposure">
                <span className="type-finance tabular-nums">{florin(creditExposure)}</span>
              </WorkspaceField>
              <WorkspaceField label="Active products">
                {activeProducts.join(" · ") || "None"}
              </WorkspaceField>
              <WorkspaceField label="Customer standing">
                <StatusBadge status={formatAccountStatus(user.accountStatus)} />
              </WorkspaceField>
            </WorkspaceFieldGrid>
          </RecordSummaryCard>
        ) : (
          <RecordSummaryCard title="Investor" id={recordSectionId("financial")}>
            <WorkspaceFieldGrid columns={2}>
              <WorkspaceField label="Standing">
                <StatusBadge status={formatAccountStatus(user.accountStatus)} />
              </WorkspaceField>
              <WorkspaceField label="Products">Terminal</WorkspaceField>
            </WorkspaceFieldGrid>
          </RecordSummaryCard>
        )}

        {isBankSite ? (
          <>
            {(user.bankAccounts.length > 0 ||
              operatorPanel.altaCardId ||
              lendingItems.length > 0) &&
            showBankProducts ? (
              <RecordSummaryCard
                title="Bank products"
                id={recordSectionId("products")}
                actions={
                  <span className="text-[11px] text-muted-foreground">Summaries only</span>
                }
              >
                <div className="space-y-3">{bankProductBlocks}</div>
              </RecordSummaryCard>
            ) : null}

            <RecordSummaryCard title="Relationship" id={recordSectionId("relationship")}>
              {panel ? (
                <WorkspaceFieldGrid columns={3}>
                  <WorkspaceField label="Tier">
                    {displayRelationshipTierLabel(panel.relationshipTier, panel.relationshipScore)}
                  </WorkspaceField>
                  <WorkspaceField label="Score">
                    <span className="tabular-nums">{panel.relationshipScore}</span>
                  </WorkspaceField>
                  <WorkspaceField label="Alta assets">
                    <span className="type-finance tabular-nums">{florin(panel.totalAltaAssets)}</span>
                  </WorkspaceField>
                  {recommendation ? (
                    <WorkspaceField label="Recommendation" className="sm:col-span-2 lg:col-span-3">
                      {recommendation.title}
                      {recommendation.summary ? (
                        <span className="text-muted-foreground"> — {recommendation.summary}</span>
                      ) : null}
                    </WorkspaceField>
                  ) : null}
                </WorkspaceFieldGrid>
              ) : (
                <RecordEmptyCopy>Relationship profile unavailable.</RecordEmptyCopy>
              )}
            </RecordSummaryCard>

            {user.companyMemberships.length > 0 ? (
              <RecordSummaryCard title="Related companies" id={recordSectionId("companies")}>
                {companiesBlock}
              </RecordSummaryCard>
            ) : null}

            {otherAltaProductsCollapsed}
          </>
        ) : (
          <>
            <RecordSummaryCard
              title="Products"
              id={recordSectionId("products")}
              actions={
                <span className="text-[11px] text-muted-foreground">Summaries only</span>
              }
            >
              <div className="space-y-3">{productsContent}</div>
            </RecordSummaryCard>

            <RecordSummaryCard title="Relationship" id={recordSectionId("relationship")}>
              {panel ? (
                <WorkspaceFieldGrid columns={3}>
                  <WorkspaceField label="Tier">
                    {displayRelationshipTierLabel(panel.relationshipTier, panel.relationshipScore)}
                  </WorkspaceField>
                  <WorkspaceField label="Score">
                    <span className="tabular-nums">{panel.relationshipScore}</span>
                  </WorkspaceField>
                  <WorkspaceField label="Alta assets">
                    <span className="type-finance tabular-nums">{florin(panel.totalAltaAssets)}</span>
                  </WorkspaceField>
                  {recommendation ? (
                    <WorkspaceField label="Recommendation" className="sm:col-span-2 lg:col-span-3">
                      {recommendation.title}
                      {recommendation.summary ? (
                        <span className="text-muted-foreground"> — {recommendation.summary}</span>
                      ) : null}
                    </WorkspaceField>
                  ) : null}
                </WorkspaceFieldGrid>
              ) : (
                <RecordEmptyCopy>Relationship profile unavailable.</RecordEmptyCopy>
              )}
            </RecordSummaryCard>
          </>
        )}
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
        filters={activityFilters}
      />
    ),
  };

  const more: RecordWorkspaceTab = {
    id: "more",
    label: "More",
    content: (
      <div className="space-y-2">
        <RecordMoreSection
          id={recordSectionId("staff-access")}
          title="Staff access"
          defaultOpen={search.section === "staff-access"}
        >
          <InternalUserTagPanel user={user} />
          <InternalDiscordRolePanel userId={user.id} />
        </RecordMoreSection>
        <RecordMoreSection
          id={recordSectionId("standing")}
          title="Customer standing"
          defaultOpen={search.section === "standing"}
        >
          <InternalUserAccountStatusPanel user={user} />
        </RecordMoreSection>
        <RecordMoreSection
          id={recordSectionId("memberships")}
          title="Company memberships"
          defaultOpen={search.section === "memberships" || search.section === "companies"}
        >
          {user.companyMemberships.length === 0 ? (
            <RecordEmptyCopy>No company memberships.</RecordEmptyCopy>
          ) : (
            <ul className="space-y-1.5 text-[12px]">
              {user.companyMemberships.map((m) => (
                <li key={m.companyId} className="flex flex-wrap justify-between gap-2">
                  <Link
                    to="/internal/companies/$companyId"
                    params={{ companyId: m.companyId }}
                    search={withInternalSiteSearch(INTERNAL_COMPANY_WORKSPACE_SEARCH, search.site)}
                    className="hover:text-gold"
                  >
                    {m.companyName}
                  </Link>
                  <span className="text-muted-foreground">{m.roleLabel}</span>
                </li>
              ))}
            </ul>
          )}
        </RecordMoreSection>
        <RecordMoreSection
          id={recordSectionId("review-flags")}
          title="Review flags"
          defaultOpen={search.section === "review-flags" || unresolvedFlags.length > 0}
        >
          <OpsReviewFlagsPanel targetType="USER" targetId={user.id} initialFlags={reviewFlags} />
        </RecordMoreSection>
        <RecordMoreSection
          id={recordSectionId("notes")}
          title="Internal notes"
          defaultOpen={search.section === "notes"}
        >
          <InternalNotePanel targetType="USER" targetId={user.id} initialNotes={notes} />
        </RecordMoreSection>
        <RecordMoreSection
          id={recordSectionId("audit")}
          title="Complete audit history"
          defaultOpen={search.section === "audit"}
        >
          <WorkspaceAuditLink entityType="USER" entityId={user.id} site={search.site} />
          <div className="mt-2">
            <InternalAuditTable rows={user.recentAuditLogs} />
          </div>
        </RecordMoreSection>
        <RecordMoreSection
          id={recordSectionId("onboarding")}
          title="Onboarding & legal"
          defaultOpen={search.section === "onboarding"}
        >
          {onboardingSummary ? (
            <CustomerOnboardingSummaryPanel summary={onboardingSummary} userId={user.id} />
          ) : (
            <RecordEmptyCopy>Onboarding status unavailable.</RecordEmptyCopy>
          )}
        </RecordMoreSection>
        <RecordMoreSection
          id={recordSectionId("identity")}
          title="Technical identity"
          defaultOpen={search.section === "identity"}
        >
          <WorkspaceFieldGrid columns={2}>
            <WorkspaceField label="User ID">
              <span className="break-all font-mono text-[11px]">{user.id}</span>
            </WorkspaceField>
            <WorkspaceField label="Discord ID">
              <span className="break-all font-mono text-[11px]">{user.discordId}</span>
            </WorkspaceField>
            <WorkspaceField label="Email">{user.email ?? "—"}</WorkspaceField>
            <WorkspaceField label="Minecraft username">
              <span className="font-mono text-[11px]">{user.minecraftUsername ?? "—"}</span>
            </WorkspaceField>
            <WorkspaceField label="Minecraft status">
              {onboardingSummary?.minecraftStatus ?? "Not verified"}
            </WorkspaceField>
          </WorkspaceFieldGrid>
        </RecordMoreSection>
      </div>
    ),
  };

  const actions = (
    <RecordActionsSheet title="Customer actions" description={`Actions for ${customerLabel}`}>
      <RecordActionGroup title="Standing & access">
        <p className="text-[12px] text-muted-foreground">
          Change standing and staff access in More, or jump there now.
        </p>
        <div className="flex flex-wrap gap-2">
          <RecordActionNavButton
            label="Change customer standing"
            onNavigate={() => navigateMoreSection("standing")}
          />
          <RecordActionNavButton
            label="Manage staff access"
            onNavigate={() => navigateMoreSection("staff-access")}
          />
          <RecordActionNavButton
            label="Add internal note"
            onNavigate={() => navigateMoreSection("notes")}
          />
          {unresolvedFlags.length > 0 ? (
            <RecordActionNavButton
              label={`Review unresolved flags (${unresolvedFlags.length})`}
              onNavigate={() => navigateMoreSection("review-flags")}
            />
          ) : null}
        </div>
      </RecordActionGroup>
    </RecordActionsSheet>
  );

  return (
    <RecordWorkspacePage
      title={customerLabel}
      breadcrumbs={breadcrumbs}
      recordType="Customer"
      primaryId={<>Discord {user.discordId}</>}
      status={formatAccountStatus(user.accountStatus)}
      meta={
        <>
          <span>Discord {user.discordUsername}</span>
          {panel ? (
            <span>
              {displayRelationshipTierLabel(panel.relationshipTier, panel.relationshipScore)} ·{" "}
              <span className="tabular-nums">{panel.relationshipScore}</span>
            </span>
          ) : null}
          <span>· Customer since {user.createdAt.slice(0, 10)}</span>
        </>
      }
      warning={
        standingNeedsAttention || unresolvedFlags.length > 0 ? (
          <span className="text-[12px] text-amber-700 dark:text-amber-300">
            {[
              standingNeedsAttention ? formatAccountStatus(user.accountStatus) : null,
              unresolvedFlags.length > 0 ? `${unresolvedFlags.length} review flag(s)` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        ) : null
      }
      headerActions={actions}
      tabs={[overview, activity, more]}
      search={search}
    />
  );
}

function customerActivityFilters(
  events: TimelineEvent[],
  { isTerminalSite, isBankSite }: { isTerminalSite: boolean; isBankSite: boolean },
): RecordActivityFilter[] {
  const order: readonly RecordActivityFilter[] = isTerminalSite
    ? ["all", "operator", "relationship", "money", "lending", "cards"]
    : isBankSite
      ? ["all", "money", "lending", "cards", "relationship", "operator"]
      : CUSTOMER_ACTIVITY_FILTERS;

  return order.filter((id) => {
    if (id === "all") return true;
    return events.some((e) => eventMatchesActivityFilter(e, id));
  });
}

function ProductBlock({
  id,
  title,
  count,
  children,
}: {
  id: string;
  title: string;
  count: number;
  children?: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <div id={id} className="scroll-mt-4 border-t border-border/40 pt-2.5 first:border-0 first:pt-0">
      <h4 className="text-[12px] font-medium text-foreground">{title}</h4>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function buildCustomerAttention({
  user,
  unresolvedFlags,
  standingNeedsAttention,
}: {
  user: InternalUserDetail;
  unresolvedFlags: OpsReviewFlagRow[];
  standingNeedsAttention: boolean;
}) {
  const items: Array<{ id: string; label: string; detail?: string }> = [];
  if (standingNeedsAttention) {
    items.push({
      id: "standing",
      label: "Customer standing",
      detail: formatAccountStatus(user.accountStatus),
    });
  }
  if (unresolvedFlags.length > 0) {
    items.push({
      id: "flags",
      label: "Unresolved review flags",
      detail: `${unresolvedFlags.length} open`,
    });
  }
  const overdueish = user.activeLoans.filter((l) =>
    /delinq|overdue|default|past.?due/i.test(l.statusLabel),
  );
  for (const loan of overdueish) {
    items.push({
      id: `loan-${loan.id}`,
      label: "Lending needs attention",
      detail: `${loan.productLabel} · ${loan.statusLabel}`,
    });
  }
  const pendingMoney = user.recentTransactions.filter((t) =>
    /pending|failed|denied/i.test(t.status),
  );
  for (const tx of pendingMoney.slice(0, 3)) {
    items.push({
      id: `tx-${tx.id}`,
      label: "Money movement",
      detail: `${tx.description} · ${tx.status}`,
    });
  }
  return items;
}

export type { CustomerWorkspaceData };
