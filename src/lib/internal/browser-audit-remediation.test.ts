import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  inboxSearchToParams,
  parseInboxSearch,
} from "@/lib/internal/inbox-types";
import { inboxItemFromLendingApp } from "@/lib/internal/inbox-normalize";
import { preserveDevSiteSearch } from "@/lib/site/preserve-dev-site-search";
import { toRecordWorkspaceSearchParams } from "@/lib/internal/record-workspace-search";
import { parseAltaCardWorkspaceSearch } from "@/lib/internal/internal-route-search";
import { formatOpsAuditActionTitle } from "@/lib/internal/ops-activity-title";
import { resolveInternalRouteTitle } from "@/lib/internal/internal-route-title";

const root = join(import.meta.dirname, "../..");

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

describe("browser-audit remediation: site context", () => {
  it("preserves site through Inbox case selection params", () => {
    const parsed = parseInboxSearch({
      site: "bank",
      category: "money",
      caseId: "withdrawal:TX-LAB-3",
      sort: "oldest",
    });
    assert.equal(parsed.site, "bank");
    assert.equal(inboxSearchToParams(parsed).site, "bank");
    assert.equal(inboxSearchToParams(parsed).caseId, "withdrawal:TX-LAB-3");
  });

  it("merges site when updating record workspace tab", () => {
    const next = preserveDevSiteSearch({ site: "bank", tab: "overview" }, {
      ...toRecordWorkspaceSearchParams({ tab: "activity", from: "/internal/inbox?site=bank" }),
    });
    assert.equal(next.site, "bank");
    assert.equal(next.tab, "activity");
  });

  it("legacy queue redirects forward site via withInternalSiteSearch", () => {
    assert.match(read("routes/internal/queues/deposits.tsx"), /withInternalSiteSearch/);
    assert.match(read("routes/internal/queues/withdrawals.tsx"), /withInternalSiteSearch/);
    assert.match(read("routes/internal/exceptions.tsx"), /validateDevSiteSearch|siteSearchPatch/);
    assert.match(
      read("routes/internal/lending/applications/$applicationId/thread.tsx"),
      /siteSearchPatch\(search\.site\)|withInternalSiteSearch/,
    );
  });
});

describe("browser-audit remediation: inbox navigation", () => {
  it("opens records via programmatic navigate with beginOutboundNavigation", () => {
    const actions = read("components/internal/inbox/inbox-case-actions.tsx");
    const navigation = read("lib/internal/inbox-navigation.ts");
    assert.match(actions, /onBeginNavigate/);
    assert.match(actions, /buildInboxRecordHref/);
    assert.match(actions, /href=\{recordHref\}/);
    assert.match(navigation, /materializeInboxDestination/);
    assert.doesNotMatch(actions, /<Link[\s\S]*Review withdrawal/);

    const page = read("components/internal/inbox/inbox-page.tsx");
    assert.match(page, /outboundNavRef/);
    assert.doesNotMatch(page, /navigatingAway/);
    assert.match(page, /beginOutboundNavigation/);
    assert.match(page, /if \(outboundNavRef\.current\) return/);
  });
});

describe("browser-audit remediation: sheets", () => {
  it("offsets sheet below UI Lab banner and stacks above it", () => {
    const sheet = read("components/ui/sheet.tsx");
    assert.match(sheet, /--ui-lab-banner-height/);
    assert.match(sheet, /z-\[10050\]/);
    assert.match(sheet, /--internal-sheet-available-height|100dvh/);
    assert.match(sheet, /overflow-hidden/);
  });
});

describe("browser-audit remediation: recommendationId", () => {
  it("does not throw when Alta Card search is undefined", () => {
    assert.deepEqual(parseAltaCardWorkspaceSearch(undefined).tab, "overview");
    assert.equal(parseAltaCardWorkspaceSearch(undefined).recommendationId, undefined);
    assert.equal(parseAltaCardWorkspaceSearch({}).recommendationId, undefined);
  });

  it("guards recommendationId server inputs", () => {
    assert.match(
      read("lib/internal/relationship-intelligence.functions.ts"),
      /recommendationId is required/,
    );
    assert.match(
      read("lib/internal/company-relationship-intelligence.functions.ts"),
      /requireRecommendationId/,
    );
    assert.match(
      read("server/relationship-intelligence-recommendation.service.ts"),
      /actionPath\.search \?\? \{\}/,
    );
    assert.match(
      read("components/internal/relationship-recommendation-panel.tsx"),
      /useServerFn\(useRelationshipRecommendationRecord\)/,
    );
    assert.match(
      read("components/internal/company-relationship-recommendation-context-panel.tsx"),
      /useServerFn\(useCompanyRelationshipRecommendationRecord\)/,
    );
  });
});

describe("browser-audit remediation: lending simplification", () => {
  it("keeps decision controls in Actions sheet and collapses RI", () => {
    const view = read("components/internal/workspace/lending-application-workspace-view.tsx");
    assert.match(view, /LendingApplicationDecisionActions|Credit decision/);
    assert.match(view, /LendingRelationshipCompactSummary|Underwriting details/);
    assert.doesNotMatch(view, /Suggested products \(placeholder\)/);
  });
});

describe("browser-audit remediation: copy", () => {
  it("deduplicates lending inbox party copy", () => {
    const item = inboxItemFromLendingApp({
      id: "app1",
      status: "pending",
      productLabel: "Business Credit Line",
      applicantLabel: "carter",
      companyName: "Alta Group N.V.",
      requestedAmount: 1000,
      submittedAt: new Date().toISOString(),
      linkedAccountNumber: null,
    } as never);
    assert.ok(item);
    assert.equal(item!.title, "Business Credit Line");
    assert.equal(item!.partyLabel, "Alta Group N.V. · carter");
    assert.equal(item!.description, item!.partyLabel);
  });

  it("humanizes raw event codes for primary copy", () => {
    assert.equal(formatOpsAuditActionTitle("ALTA_CARD_CASH_ADVANCE_CREATED"), "Cash advance created");
    assert.equal(formatOpsAuditActionTitle("LOAN_PAYMENT"), "Loan payment");
    assert.equal(formatOpsAuditActionTitle("LOAN_PAYMENT_MADE"), "Loan payment made");
    assert.equal(formatOpsAuditActionTitle("BUSINESS CREDIT LINE"), "Business Credit Line");
  });

  it("hides Bank action scenario on Terminal and uses Terminal search placeholder", () => {
    assert.match(
      read("components/bank/actions/ui-lab-bank-action-scenario-control.tsx"),
      /siteKey === "terminal"|terminal/,
    );
    assert.match(
      read("components/internal/internal-global-search.tsx"),
      /Search investors, portfolios, orders/,
    );
  });
});

describe("browser-audit remediation: header title", () => {
  it("uses deterministic route titles instead of a module-global title store", () => {
    assert.equal(resolveInternalRouteTitle("/internal/inbox"), "Inbox");
    assert.doesNotMatch(
      read("components/internal/internal-page-shell.tsx"),
      /publishInternalPageTitle|internal-page-title-store/,
    );
    assert.match(read("components/internal/console/internal-header.tsx"), /resolveInternalRouteTitle/);
    assert.match(read("components/internal/internal-page-shell.tsx"), /breadcrumbKey/);
    assert.doesNotMatch(
      read("components/internal/console/internal-header.tsx"),
      /useSyncExternalStore|publishedTitle/,
    );
  });
});
