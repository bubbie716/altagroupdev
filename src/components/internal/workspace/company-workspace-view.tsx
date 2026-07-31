"use client";

import { Link, useNavigate } from "@tanstack/react-router";
import {
  INTERNAL_ACCOUNT_WORKSPACE_SEARCH,
  INTERNAL_LOAN_WORKSPACE_SEARCH,
  INTERNAL_TRANSACTION_WORKSPACE_SEARCH,
  INTERNAL_USER_WORKSPACE_SEARCH,
  withInternalSiteSearch,
} from "@/lib/internal/internal-route-search";
import { StatusBadge } from "@/components/internal/status-badge";
import { CompanyVerificationActions } from "@/components/internal/company-verification-actions";
import { AdminCommercialProGrantPanel } from "@/components/internal/admin-commercial-pro-grant-panel";
import { CompanyBrandingAdminPanel } from "@/components/internal/workspace/company-branding-admin-panel";
import { CompanyCommercialConsentPanel } from "@/components/internal/workspace/company-commercial-consent-panel";
import { AdminOnly } from "@/components/internal/admin-only";
import { OpsReviewFlagsPanel } from "@/components/internal/ops-review-flags-panel";
import { InternalAuditTable } from "@/components/internal/internal-audit-table";
import { WorkspaceAuditLink } from "@/components/internal/workspace/workspace-audit-link";
import { InternalNotePanel } from "@/components/internal/internal-note-panel";
import {
  CompanyRelationshipDetailPanel,
  CompanyProductHoldingsPanel,
} from "@/components/internal/company-relationship-intelligence-panel";
import { CompanyRelationshipRecommendationsPanel } from "@/components/internal/company-relationship-recommendations-panel";
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
  RecordActionNavButton,
  RecordActionsSheet,
} from "@/components/internal/workspace/record-actions-sheet";
import { WorkspaceField, WorkspaceFieldGrid } from "@/components/internal/workspace/workspace-fields";
import { formatCompanyRole } from "@/lib/internal/format";
import { florin } from "@/lib/bank/api";
import { useCurrentUser } from "@/hooks/use-current-user";
import { canAccessBankInternal } from "@/lib/auth/permissions";
import { formatAltaUserHandle } from "@/lib/auth/user-display";
import { TerminalOwnerPortfoliosBlock } from "@/components/internal/workspace/terminal-owner-portfolios-block";
import { COMPANY_RELATIONSHIP_TIER_LABELS } from "@/lib/bank/company-relationship-intelligence-config";
import { limitRelatedRecords } from "@/lib/internal/directory-desk";
import type { TimelineEvent } from "@/lib/internal/ops-types";
import type { AuditLogRow } from "@/lib/internal/audit.types";
import type { OpsReviewFlagRow } from "@/lib/internal/ops-review-flag.types";
import {
  recordSectionId,
  toRecordWorkspaceSearchParams,
  type RecordActivityFilter,
  type RecordWorkspaceSearch,
} from "@/lib/internal/record-workspace-search";
import { parseReturnPath } from "@/lib/internal/record-return-context";
import { normalizeCompanyVerificationStatus } from "@/lib/company/verification-status";

type Company360 = Awaited<
  ReturnType<typeof import("@/lib/internal/ops-platform.functions").fetchCompany360>
>;

export function CompanyWorkspaceView({
  data,
  auditLogs,
  relationship,
  relationshipRecommendations = [],
  reviewFlags = [],
  search,
}: {
  data: Company360;
  auditLogs: AuditLogRow[];
  relationship: Awaited<
    ReturnType<
      typeof import("@/lib/internal/company-relationship-intelligence.functions").fetchAdminCompanyRelationshipDetail
    >
  > | null;
  relationshipRecommendations?: Awaited<
    ReturnType<
      typeof import("@/lib/internal/company-relationship-intelligence.functions").fetchCompanyRelationshipRecommendations
    >
  >;
  reviewFlags?: OpsReviewFlagRow[];
  search: RecordWorkspaceSearch;
}) {
  const navigate = useNavigate();
  const viewer = useCurrentUser();
  const showBankProducts = viewer ? canAccessBankInternal(viewer) : true;
  const siteKey = search.site ?? "corporate";
  const isTerminalSite = siteKey === "terminal";
  const { company, notes, timeline, bankAccounts, loans, altaPayActivity, commercialPlan } = data;
  const display = relationship?.calculated ?? relationship?.profile;
  const totalAssets = bankAccounts.reduce((s, a) => s + a.balance, 0);
  const creditExposure = loans.reduce((s, l) => s + l.outstandingBalance, 0);
  const unresolvedFlags = reviewFlags.filter((f) => f.status === "ACTIVE");
  const verification = normalizeCompanyVerificationStatus(company.verificationStatus);
  const primaryAccount = bankAccounts[0];
  const accountsLimited = limitRelatedRecords(bankAccounts, 4);
  const loansLimited = limitRelatedRecords(loans, 4);
  const commercialLimited = limitRelatedRecords(altaPayActivity, 4);
  const membersLimited = limitRelatedRecords(company.members, 4);
  const activeRecommendations = relationshipRecommendations.filter((r) => r.status === "ACTIVE");

  const activeProducts = [
    bankAccounts.length > 0 ? "Bank" : null,
    altaPayActivity.length > 0 || commercialPlan ? "Commercial" : null,
    loans.length > 0 ? "Lending" : null,
  ].filter(Boolean) as string[];

  const attention = buildCompanyAttention({
    company,
    verification,
    unresolvedFlags,
    loans,
    commercialPlan,
  });

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

  function goToMoreSection(section: string) {
    void navigate({
      to: ".",
      search: () =>
        toRecordWorkspaceSearchParams({
          tab: "more",
          section,
          from: search.from,
          site: search.site,
        }),
    });
  }

  const returnCtx = parseReturnPath(search.from);
  const breadcrumbs =
    returnCtx?.pathname === "/internal/inbox" || returnCtx?.pathname === "/internal/terminal/investors"
      ? workspaceBreadcrumbs([
          { label: "Home", to: "/internal", search: withInternalSiteSearch({}, search.site) },
          {
            label: returnCtx.pathname.includes("investors") ? "Investors" : "Inbox",
            to: returnCtx.pathname as "/",
            search: returnCtx.search,
          },
          { label: company.name },
        ])
      : workspaceBreadcrumbs([
          { label: "Home", to: "/internal", search: withInternalSiteSearch({}, search.site) },
          { label: "Companies", to: "/internal/companies", search: withInternalSiteSearch({}, search.site) },
          { label: company.name },
        ]);

  const bankProductBlocks = (
    <>
      <ProductBlock
        id={recordSectionId("accounts")}
        title="Bank accounts"
        empty="No business accounts."
        count={bankAccounts.length}
      >
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
                <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">
                  {a.accountNumber}
                </span>
              </Link>
              <span className="type-finance tabular-nums shrink-0">{florin(a.balance)}</span>
            </li>
          ))}
        </ul>
        {accountsLimited.hasMore ? (
          <p className="mt-1.5">
            <Link
              to="/internal/bank/accounts"
              search={withInternalSiteSearch({}, search.site)}
              className="text-[11px] text-gold hover:underline"
            >
              View all accounts
            </Link>
          </p>
        ) : null}
      </ProductBlock>

      <ProductBlock
        id={recordSectionId("lending")}
        title="Lending"
        empty="No business loans."
        count={loans.length}
      >
        <ul className="space-y-1.5 text-[12px]">
          {loansLimited.visible.map((l) => (
            <li key={l.id} className="flex flex-wrap items-baseline justify-between gap-2">
              <Link
                to="/internal/lending/loans/$loanId"
                params={{ loanId: l.id }}
                search={withInternalSiteSearch(INTERNAL_LOAN_WORKSPACE_SEARCH, search.site)}
                className="font-mono text-[11px] text-gold hover:underline"
              >
                {l.id.slice(0, 10)}
              </Link>
              <span className="type-finance tabular-nums">{florin(l.outstandingBalance)}</span>
            </li>
          ))}
        </ul>
        {loansLimited.hasMore ? (
          <p className="mt-1.5">
            <Link
              to="/internal/lending/loans"
              search={withInternalSiteSearch({}, search.site)}
              className="text-[11px] text-gold hover:underline"
            >
              View all loans
            </Link>
          </p>
        ) : null}
      </ProductBlock>

      <ProductBlock
        id={recordSectionId("commercial")}
        title="Alta Pay / commercial"
        empty="No commercial activity."
        count={altaPayActivity.length}
      >
        <ul className="space-y-1.5 text-[12px]">
          {commercialLimited.visible.map((tx) => (
            <li key={tx.id} className="flex flex-wrap justify-between gap-2">
              <Link
                to="/internal/bank/transactions/$transactionId"
                params={{ transactionId: tx.id }}
                search={withInternalSiteSearch(INTERNAL_TRANSACTION_WORKSPACE_SEARCH, search.site)}
                className="font-mono text-[11px] text-gold hover:underline"
              >
                {tx.referenceCode}
              </Link>
              <span className="type-finance tabular-nums">{florin(tx.amount)}</span>
            </li>
          ))}
        </ul>
      </ProductBlock>
    </>
  );

  const peopleCard = (
    <RecordSummaryCard title="People" id={recordSectionId("people")}>
      {company.members.length === 0 ? (
        <RecordEmptyCopy>No members on file.</RecordEmptyCopy>
      ) : (
        <>
          <ul className="space-y-1.5 text-[12px]">
            {membersLimited.visible.map((m) => (
              <li key={m.userId} className="flex flex-wrap items-baseline justify-between gap-2">
                <Link
                  to="/internal/users/$userId"
                  params={{ userId: m.userId }}
                  search={withInternalSiteSearch(INTERNAL_USER_WORKSPACE_SEARCH, search.site)}
                  className="min-w-0 break-words hover:text-gold"
                >
                  {formatAltaUserHandle(m)}
                </Link>
                <span className="text-muted-foreground">{formatCompanyRole(m.role)}</span>
              </li>
            ))}
          </ul>
          {membersLimited.hasMore ? (
            <p className="mt-1.5">
              <button
                type="button"
                onClick={() => goToMoreSection("members")}
                className="text-[11px] text-gold hover:underline"
              >
                View all members
              </button>
            </p>
          ) : null}
        </>
      )}
    </RecordSummaryCard>
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
              <WorkspaceField label="Business assets">
                <span className="type-finance tabular-nums">{florin(totalAssets)}</span>
              </WorkspaceField>
              <WorkspaceField label="Credit exposure">
                <span className="type-finance tabular-nums">{florin(creditExposure)}</span>
              </WorkspaceField>
              <WorkspaceField label="Primary account">
                {primaryAccount ? (
                  <Link
                    to="/internal/bank/accounts/$accountId"
                    params={{ accountId: primaryAccount.id }}
                    search={withInternalSiteSearch(INTERNAL_ACCOUNT_WORKSPACE_SEARCH, search.site)}
                    className="break-words hover:text-gold"
                  >
                    {primaryAccount.accountName}
                  </Link>
                ) : (
                  "—"
                )}
              </WorkspaceField>
              <WorkspaceField label="Active products">
                {activeProducts.join(" · ") || "None"}
              </WorkspaceField>
              <WorkspaceField label="Commercial plan">
                {commercialPlan?.commercialPlan ?? "—"}
              </WorkspaceField>
            </WorkspaceFieldGrid>
          </RecordSummaryCard>
        ) : null}

        {isTerminalSite ? (
          <>
            <RecordSummaryCard title="Products" id={recordSectionId("products")}>
              <ProductBlock id={recordSectionId("terminal")} title="Terminal" empty="No Terminal portfolios on file." count={1}>
                <TerminalOwnerPortfoliosBlock ownerCompanyId={company.id} site={search.site} />
              </ProductBlock>
            </RecordSummaryCard>
            {peopleCard}
            {showBankProducts ? (
              <RecordSummaryCard title="Other Alta products" id={recordSectionId("other-products")}>
                <div className="space-y-3">{bankProductBlocks}</div>
              </RecordSummaryCard>
            ) : null}
          </>
        ) : (
          <>
            <RecordSummaryCard title="Products" id={recordSectionId("products")}>
              <div className="space-y-3">
                {showBankProducts ? (
                  bankProductBlocks
                ) : (
                  <div
                    id={recordSectionId("accounts")}
                    className="rounded-md border border-border/60 bg-surface-1/40 px-3 py-2 text-[12px] text-muted-foreground"
                  >
                    Bank accounts, Alta Pay, Alta Card, and Lending are hidden for Terminal-only staff.
                  </div>
                )}
              </div>
            </RecordSummaryCard>
            {peopleCard}
            <RecordSummaryCard title="Terminal" id={recordSectionId("terminal")}>
              <TerminalOwnerPortfoliosBlock ownerCompanyId={company.id} site={search.site} />
            </RecordSummaryCard>
          </>
        )}

        <RecordSummaryCard title="Relationship" id={recordSectionId("relationship")}>
          {relationship?.calculated ? (
            <div className="space-y-3">
              <WorkspaceFieldGrid columns={3}>
                <WorkspaceField label="Tier">
                  {COMPANY_RELATIONSHIP_TIER_LABELS[relationship.calculated.relationshipTier]}
                </WorkspaceField>
                <WorkspaceField label="Score">
                  <span className="tabular-nums">{relationship.calculated.relationshipScore}</span>
                </WorkspaceField>
                <WorkspaceField label="Business assets">
                  <span className="type-finance tabular-nums">
                    {florin(relationship.calculated.totalBusinessAssets)}
                  </span>
                </WorkspaceField>
              </WorkspaceFieldGrid>
              <CompanyProductHoldingsPanel holdings={relationship.calculated.productHoldings} />
              {activeRecommendations.length > 0 ? (
                <CompanyRelationshipRecommendationsPanel
                  companyId={company.id}
                  recommendations={activeRecommendations.slice(0, 2)}
                  mode="summary"
                />
              ) : null}
            </div>
          ) : display ? (
            <WorkspaceFieldGrid columns={3}>
              <WorkspaceField label="Tier">
                {"relationshipTier" in display
                  ? COMPANY_RELATIONSHIP_TIER_LABELS[
                      display.relationshipTier as keyof typeof COMPANY_RELATIONSHIP_TIER_LABELS
                    ] ?? String(display.relationshipTier)
                  : "—"}
              </WorkspaceField>
              <WorkspaceField label="Score">
                <span className="tabular-nums">
                  {"relationshipScore" in display ? display.relationshipScore : "—"}
                </span>
              </WorkspaceField>
            </WorkspaceFieldGrid>
          ) : (
            <RecordEmptyCopy>Relationship profile unavailable.</RecordEmptyCopy>
          )}
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
      />
    ),
  };

  const more: RecordWorkspaceTab = {
    id: "more",
    label: "More",
    content: (
      <div className="space-y-2">
        <RecordMoreSection
          id={recordSectionId("members")}
          title="Membership administration"
          defaultOpen={search.section === "members" || search.section === "people"}
        >
          {company.members.length === 0 ? (
            <RecordEmptyCopy>No members on file.</RecordEmptyCopy>
          ) : (
            <ul className="space-y-1.5 text-[12px]">
              {company.members.map((m) => (
                <li key={m.membershipId} className="flex flex-wrap justify-between gap-2">
                  <Link
                    to="/internal/users/$userId"
                    params={{ userId: m.userId }}
                    search={withInternalSiteSearch(INTERNAL_USER_WORKSPACE_SEARCH, search.site)}
                    className="hover:text-gold"
                  >
                    {formatAltaUserHandle(m)}
                  </Link>
                  <span className="text-muted-foreground">
                    {formatCompanyRole(m.role)} · {m.joinedAt.slice(0, 10)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </RecordMoreSection>
        <RecordMoreSection
          id={recordSectionId("verification")}
          title="Verification"
          defaultOpen={search.section === "verification" || verification === "pending"}
        >
          <CompanyVerificationActions
            companyId={company.id}
            verificationStatus={company.verificationStatus}
            companyName={company.name}
          />
        </RecordMoreSection>
        <RecordMoreSection
          id={recordSectionId("commercial-plan")}
          title="Commercial plan"
          defaultOpen={search.section === "commercial-plan"}
        >
          <AdminOnly siteKey="bank">
            <AdminCommercialProGrantPanel
              companyId={company.id}
              companyName={company.name}
              commercialPlan={commercialPlan}
            />
          </AdminOnly>
        </RecordMoreSection>
        <RecordMoreSection
          id={recordSectionId("commercial-consent")}
          title="Commercial consent"
          defaultOpen={search.section === "commercial-consent"}
        >
          <AdminOnly siteKey="bank">
            <CompanyCommercialConsentPanel companyId={company.id} />
          </AdminOnly>
        </RecordMoreSection>
        <RecordMoreSection
          id={recordSectionId("branding")}
          title="Commercial branding"
          defaultOpen={search.section === "branding"}
        >
          <AdminOnly siteKey="bank">
            <CompanyBrandingAdminPanel companyId={company.id} />
          </AdminOnly>
        </RecordMoreSection>
        <RecordMoreSection
          id={recordSectionId("recommendations")}
          title="Recommendations"
          defaultOpen={search.section === "recommendations"}
        >
          <CompanyRelationshipRecommendationsPanel
            companyId={company.id}
            recommendations={relationshipRecommendations}
          />
        </RecordMoreSection>
        <RecordMoreSection
          id={recordSectionId("review-flags")}
          title="Review flags"
          defaultOpen={search.section === "review-flags" || unresolvedFlags.length > 0}
        >
          <OpsReviewFlagsPanel targetType="COMPANY" targetId={company.id} initialFlags={reviewFlags} />
        </RecordMoreSection>
        <RecordMoreSection
          id={recordSectionId("notes")}
          title="Internal notes"
          defaultOpen={search.section === "notes"}
        >
          <InternalNotePanel targetType="COMPANY" targetId={company.id} initialNotes={notes} />
        </RecordMoreSection>
        <RecordMoreSection
          id={recordSectionId("audit")}
          title="Audit history"
          defaultOpen={search.section === "audit"}
        >
          <WorkspaceAuditLink entityType="COMPANY" entityId={company.id} />
          <div className="mt-2">
            <InternalAuditTable rows={auditLogs} />
          </div>
        </RecordMoreSection>
        <RecordMoreSection
          id={recordSectionId("entity")}
          title="Entity details"
          defaultOpen={search.section === "entity"}
        >
          <WorkspaceFieldGrid columns={2}>
            <WorkspaceField label="Company ID">
              <span className="break-all font-mono text-[11px]">{company.id}</span>
            </WorkspaceField>
            <WorkspaceField label="Legal name">{company.name}</WorkspaceField>
            <WorkspaceField label="Ticker">
              <span className="font-mono text-[11px]">{company.ticker ?? "—"}</span>
            </WorkspaceField>
            <WorkspaceField label="Type">{company.type}</WorkspaceField>
            <WorkspaceField label="Sector">{company.sector ?? "—"}</WorkspaceField>
            <WorkspaceField label="Registered">
              <span className="font-mono text-[11px]">{company.createdAt.slice(0, 10)}</span>
            </WorkspaceField>
          </WorkspaceFieldGrid>
        </RecordMoreSection>
        {relationship?.calculated ? (
          <RecordMoreSection
            id={recordSectionId("relationship-detail")}
            title="Full relationship profile"
            defaultOpen={search.section === "relationship-detail"}
          >
            <CompanyRelationshipDetailPanel
              companyId={company.id}
              companyName={company.name}
              profile={relationship.profile}
              calculated={relationship.calculated}
              timelineSummary={relationship.timelineSummary}
            />
          </RecordMoreSection>
        ) : null}
      </div>
    ),
  };

  const actions = (
    <RecordActionsSheet title="Company actions" description={`Actions for ${company.name}`}>
      <RecordActionGroup title="Verification">
        <div className="flex flex-wrap gap-2">
          <RecordActionNavButton
            label="Verification administration"
            onNavigate={() => goToMoreSection("verification")}
          />
        </div>
      </RecordActionGroup>
      <RecordActionGroup title="Commercial plan / branding">
        <div className="flex flex-wrap gap-2">
          <RecordActionNavButton
            label="Commercial plan"
            onNavigate={() => goToMoreSection("commercial-plan")}
          />
          <RecordActionNavButton
            label="Commercial branding"
            onNavigate={() => goToMoreSection("branding")}
          />
        </div>
      </RecordActionGroup>
      <RecordActionGroup title="Recommendations">
        <div className="flex flex-wrap gap-2">
          <RecordActionNavButton
            label="Manage recommendations"
            onNavigate={() => goToMoreSection("recommendations")}
          />
        </div>
      </RecordActionGroup>
      <RecordActionGroup title="Notes">
        <div className="flex flex-wrap gap-2">
          <RecordActionNavButton
            label="Add internal note"
            onNavigate={() => goToMoreSection("notes")}
          />
        </div>
      </RecordActionGroup>
    </RecordActionsSheet>
  );

  return (
    <RecordWorkspacePage
      title={company.name}
      breadcrumbs={breadcrumbs}
      recordType={company.type || "Company"}
      primaryId={company.ticker ? <>{company.ticker}</> : undefined}
      status={company.verificationStatus}
      meta={
        <>
          <span>
            Status <StatusBadge status={company.status} />
          </span>
          {commercialPlan ? <span>Plan {commercialPlan.commercialPlan}</span> : null}
        </>
      }
      warning={
        unresolvedFlags.length > 0 || verification === "pending" || company.status.toLowerCase().includes("restrict") ? (
          <span className="text-[12px] text-amber-700 dark:text-amber-300">
            {[
              verification === "pending" ? "Verification pending" : null,
              unresolvedFlags.length > 0 ? `${unresolvedFlags.length} review flag(s)` : null,
              company.status.toLowerCase().includes("restrict") ? company.status : null,
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

function ProductBlock({
  id,
  title,
  empty: _empty,
  count,
  children,
}: {
  id: string;
  title: string;
  empty: string;
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

function buildCompanyAttention({
  company,
  verification,
  unresolvedFlags,
  loans,
  commercialPlan,
}: {
  company: Company360["company"];
  verification: ReturnType<typeof normalizeCompanyVerificationStatus>;
  unresolvedFlags: OpsReviewFlagRow[];
  loans: Company360["loans"];
  commercialPlan: Company360["commercialPlan"];
}) {
  const items: Array<{ id: string; label: string; detail?: string }> = [];
  if (verification === "pending" || verification === "unverified") {
    items.push({
      id: "verification",
      label: "Verification",
      detail: verification === "pending" ? "Pending review" : "Not verified",
    });
  }
  if (unresolvedFlags.length > 0) {
    items.push({
      id: "flags",
      label: "Unresolved review flags",
      detail: `${unresolvedFlags.length} open`,
    });
  }
  if (company.status.toLowerCase().includes("restrict")) {
    items.push({ id: "status", label: "Restricted status", detail: company.status });
  }
  for (const loan of loans.filter((l) => /delinq|overdue|default|past.?due/i.test(l.status))) {
    items.push({
      id: `loan-${loan.id}`,
      label: "Lending needs attention",
      detail: loan.status,
    });
  }
  if (commercialPlan?.billingStatus && /past.?due|fail|overdue/i.test(commercialPlan.billingStatus)) {
    items.push({
      id: "billing",
      label: "Commercial billing",
      detail: commercialPlan.billingStatus,
    });
  }
  return items;
}
