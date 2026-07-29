import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = join(import.meta.dirname, "../../..");

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

describe("customer record workspace", () => {
  it("exposes only Overview, Activity, and More primary tabs", () => {
    const view = read("components/internal/workspace/customer-workspace-view.tsx");
    assert.match(view, /label:\s*"Overview"/);
    assert.match(view, /label:\s*"Activity"/);
    assert.match(view, /label:\s*"More"/);
    assert.doesNotMatch(view, /label:\s*"Accounts"/);
    assert.doesNotMatch(view, /label:\s*"Review flags"/);
    assert.doesNotMatch(view, /label:\s*"Timeline"/);
    assert.match(view, /RecordActionsSheet/);
    assert.match(view, /RecordActivityTimeline/);
  });

  it("keeps standing and staff forms out of Overview", () => {
    const view = read("components/internal/workspace/customer-workspace-view.tsx");
    const overviewStart = view.indexOf('id: "overview"');
    const activityStart = view.indexOf('id: "activity"');
    assert.ok(overviewStart >= 0 && activityStart > overviewStart);
    const overview = view.slice(overviewStart, activityStart);
    assert.doesNotMatch(overview, /InternalUserTagPanel/);
    assert.doesNotMatch(overview, /InternalUserAccountStatusPanel/);
    assert.match(view, /InternalUserTagPanel/);
    assert.match(view, /InternalUserAccountStatusPanel/);
  });

  it("route validates via parseCustomerWorkspaceSearch", () => {
    const route = read("routes/internal/users/$userId.tsx");
    assert.match(route, /parseCustomerWorkspaceSearch/);
    assert.match(route, /CustomerWorkspaceView/);
    assert.match(route, /search=\{search\}/);
  });
});

describe("company record workspace", () => {
  it("exposes only Overview, Activity, and More primary tabs", () => {
    const view = read("components/internal/workspace/company-workspace-view.tsx");
    assert.match(view, /label:\s*"Overview"/);
    assert.match(view, /label:\s*"Activity"/);
    assert.match(view, /label:\s*"More"/);
    assert.doesNotMatch(view, /label:\s*"Members"/);
    assert.doesNotMatch(view, /label:\s*"Alta Pay"/);
    assert.match(view, /RecordActionsSheet/);
  });

  it("moves verification and commercial admin out of Overview", () => {
    const view = read("components/internal/workspace/company-workspace-view.tsx");
    const overviewStart = view.indexOf('id: "overview"');
    const activityStart = view.indexOf('id: "activity"');
    const overview = view.slice(overviewStart, activityStart);
    assert.doesNotMatch(overview, /CompanyVerificationActions/);
    assert.doesNotMatch(overview, /AdminCommercialProGrantPanel/);
    assert.doesNotMatch(overview, /CompanyBrandingAdminPanel/);
    assert.match(view, /CompanyVerificationActions/);
    assert.match(view, /AdminCommercialProGrantPanel/);
  });

  it("route validates via parseCompanyWorkspaceSearch", () => {
    const route = read("routes/internal/companies/$companyId.tsx");
    assert.match(route, /parseCompanyWorkspaceSearch/);
    assert.match(route, /search=\{search\}/);
  });
});

describe("record workspace primitives", () => {
  it("uses full-width record layout without permanent sidebar", () => {
    const layout = read("components/internal/workspace/record-workspace-layout.tsx");
    assert.match(layout, /data-record-workspace/);
    assert.match(layout, /Record sections/);
    assert.doesNotMatch(layout, /lg:grid-cols-\[minmax\(0,1fr\)_16rem\]/);
  });

  it("actions sheet is mobile-friendly", () => {
    const sheet = read("components/internal/workspace/record-actions-sheet.tsx");
    assert.match(sheet, /SheetContent/);
    assert.match(sheet, /sticky bottom-0/);
    assert.match(sheet, /data-record-actions/);
  });

  it("relationship redirect uses canonical overview section", () => {
    const route = read("routes/internal/relationships/$userId.tsx");
    assert.match(route, /customerRelationshipSearch/);
    assert.doesNotMatch(route, /tab:\s*"relationship"/);
  });

  it("inbox open-record preserves return context", () => {
    const actions = read("components/internal/inbox/inbox-case-actions.tsx");
    assert.match(actions, /buildInboxReturnPath/);
    assert.match(actions, /from:\s*returnFrom/);
  });
});

describe("mobile record tabs fit without overflow chrome", () => {
  it("uses equal-flex primary tabs instead of horizontal scroll strip", () => {
    const layout = read("components/internal/workspace/record-workspace-layout.tsx");
    assert.match(layout, /flex-1/);
    assert.doesNotMatch(layout, /overflow-x-auto/);
    assert.doesNotMatch(layout, /More workspace tabs/);
  });
});
