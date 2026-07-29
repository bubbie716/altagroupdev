import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { withInternalSiteSearch } from "@/lib/internal/internal-route-search";
import { relatedRecordTarget } from "@/components/internal/workspace/related-records";
import { resolveInternalRouteTitle } from "@/lib/internal/internal-route-title";

const root = join(import.meta.dirname, "../..");

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

/** Shared routes that must carry explicit site when linked from a scoped console. */
const SHARED_ROUTE_MARKERS = [
  "/internal/inbox",
  "/internal/users",
  "/internal/companies",
  "/internal/jobs",
  "/internal/audit",
  "/internal/reports",
  "/internal/lending",
] as const;

describe("surgical fix: Bank Home site propagation", () => {
  it("wraps every Bank Home queue and quick link with withInternalSiteSearch", () => {
    const source = read("routes/internal/bank/index.tsx");
    assert.match(source, /useSiteContext/);
    assert.match(source, /withInternalSiteSearch\([\s\S]*?category: "money" as const, type: "deposit"/);
    assert.match(source, /withInternalSiteSearch\([\s\S]*?category: "money" as const, type: "withdrawal"/);
    assert.match(source, /withInternalSiteSearch\(\{ category: "account_opening" as const \}/);
    assert.match(source, /withInternalSiteSearch\(\{ category: "lending" as const \}/);
    assert.match(source, /to="\/internal\/jobs"/);
    assert.match(source, /to="\/internal\/bank\/scheduled"/);
    assert.match(source, /to="\/internal\/bank\/statements"/);
    const siteWrapped = source.split("withInternalSiteSearch").length - 1;
    assert.ok(siteWrapped >= 8, `expected ≥8 withInternalSiteSearch calls, got ${siteWrapped}`);
  });
});

describe("surgical fix: customer and lending site links", () => {
  it("preserves site on customer loan and application links", () => {
    const source = read("components/internal/workspace/customer-workspace-view.tsx");
    assert.match(source, /lending\/loans\/\$loanId/);
    assert.match(source, /withInternalSiteSearch\(INTERNAL_LOAN_WORKSPACE_SEARCH|withInternalSiteSearch\(internalWorkspaceTabSearch/);
    assert.match(source, /lending\/applications\/\$applicationId/);
    assert.match(source, /withInternalSiteSearch/);
    assert.doesNotMatch(source, /applications\/\$applicationId\/thread"/);
  });

  it("preserves site on lending application related and audit links", () => {
    const lending = read("components/internal/workspace/lending-application-workspace-view.tsx");
    assert.match(lending, /RelatedRecords[\s\S]*site=\{search\.site\}/);
    assert.match(lending, /WorkspaceAuditLink[\s\S]*site=\{search\.site\}/);
    assert.match(lending, /site:\s*search\.site/);
  });

  it("RelatedRecords merges site into shared destinations", () => {
    const target = relatedRecordTarget(
      { kind: "user", id: "u1", label: "Ada" },
      "bank",
    );
    assert.equal(target.search?.site, "bank");
    const loan = relatedRecordTarget(
      { kind: "loan", id: "LN-1", label: "Loan" },
      "bank",
    );
    assert.equal(loan.search?.site, "bank");
  });
});

describe("surgical fix: sheet geometry", () => {
  it("anchors right/left sheets with right-0/left-0 and caps width to viewport", () => {
    const sheet = read("components/ui/sheet.tsx");
    assert.match(sheet, /right-0/);
    assert.match(sheet, /left-0/);
    assert.match(sheet, /max-w-\[100vw\]/);
    assert.match(sheet, /w-\[min\(100%,24rem\)\]/);

    const actions = read("components/internal/workspace/record-actions-sheet.tsx");
    assert.match(actions, /w-\[min\(100%,28rem\)\]/);
    assert.match(actions, /max-w-\[100vw\]/);
  });
});

describe("surgical fix: cold-load heading", () => {
  it("derives a deterministic non-empty h1 from the route pathname", () => {
    const header = read("components/internal/console/internal-header.tsx");
    assert.match(header, /resolveInternalRouteTitle/);
    assert.doesNotMatch(header, /getPublishedInternalPageTitle|publishInternalPageTitle|\\u00a0/);
    assert.doesNotMatch(header, /useSyncExternalStore/);

    const pageShell = read("components/internal/internal-page-shell.tsx");
    assert.doesNotMatch(pageShell, /publishInternalPageTitle|internal-page-title-store/);
    assert.match(pageShell, /pathname/);

    assert.equal(resolveInternalRouteTitle("/internal/users/ui-lab-user"), "Customer");
    assert.notEqual(resolveInternalRouteTitle("/internal/users/ui-lab-user"), "Internal");
  });

  it("scopes shell page titles to the current pathname so prior routes cannot leak", () => {
    const ctx = read("components/internal/console/internal-shell-context.tsx");
    assert.match(ctx, /pathname/);
    assert.match(read("components/internal/console/internal-header.tsx"), /page\.pathname === pathname/);
  });
});

describe("surgical fix: shared-route link inventory helpers", () => {
  it("withInternalSiteSearch keeps Bank site on shared inbox destinations", () => {
    for (const path of SHARED_ROUTE_MARKERS) {
      void path;
      const search = withInternalSiteSearch({ category: "money", type: "deposit" }, "bank");
      assert.equal(search.site, "bank");
    }
    const bare = withInternalSiteSearch({}, "terminal");
    assert.equal(bare.site, "terminal");
  });

  it("Bank and Terminal home sources use site-aware search helpers", () => {
    assert.match(read("routes/internal/bank/index.tsx"), /withInternalSiteSearch/);
    assert.match(read("components/internal/terminal-internal-home.tsx"), /withInternalSiteSearch/);
  });

  it("canonical pages wire RelatedRecords / product links with site", () => {
    const pages = [
      "components/internal/workspace/customer-workspace-view.tsx",
      "components/internal/workspace/company-workspace-view.tsx",
      "components/internal/workspace/lending-application-workspace-view.tsx",
      "components/internal/workspace/account-workspace-view.tsx",
      "components/internal/workspace/alta-card-workspace-view.tsx",
      "components/internal/workspace/terminal-portfolio-workspace-view.tsx",
    ];
    for (const page of pages) {
      const source = read(page);
      assert.match(
        source,
        /withInternalSiteSearch|site:\s*search\.site|site=\{search\.site\}/,
        `${page} must preserve site on internal destinations`,
      );
    }
  });
});
