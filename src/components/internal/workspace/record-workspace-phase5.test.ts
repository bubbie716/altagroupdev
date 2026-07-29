import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "../../..");

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

describe("Phase 5 Alta Card workspace", () => {
  it("uses RecordWorkspacePage with three primary tabs", () => {
    const view = read("components/internal/workspace/alta-card-workspace-view.tsx");
    assert.match(view, /RecordWorkspacePage/);
    assert.match(view, /id:\s*"overview"/);
    assert.match(view, /id:\s*"activity"/);
    assert.match(view, /id:\s*"more"/);
    assert.doesNotMatch(view, /WorkspaceSidebar/);
    assert.match(view, /RecordActionsSheet/);
    assert.match(view, /····\$\{|maskedLastFour|cardLastFour/);
    assert.doesNotMatch(view, /Private Banking|private banking/i);
  });

  it("route uses parseAltaCardWorkspaceSearch", () => {
    const route = read("routes/internal/alta-card/$cardId.tsx");
    assert.match(route, /parseAltaCardWorkspaceSearch/);
    assert.doesNotMatch(route, /parseWorkspaceTab/);
  });

  it("never renders full PAN/CVV in card product workspace", () => {
    const src = read("components/internal/workspace/alta-card-workspace-view.tsx");
    assert.doesNotMatch(src, /securityCode|fullPan|card\.pan|primaryAccountNumber/i);
    assert.match(src, /····|cardLastFour/);
  });
});

describe("Phase 5 lending application case record", () => {
  it("uses RecordSinglePage without tab strip", () => {
    const view = read("components/internal/workspace/lending-application-workspace-view.tsx");
    assert.match(view, /RecordSinglePage/);
    assert.doesNotMatch(view, /WorkspaceSidebar/);
    assert.match(view, /LendingApplicationDecisionSummary/);
    assert.match(view, /LendingApplicationDecisionActions/);
    assert.match(view, /LendingRelationshipCompactSummary/);
    assert.match(view, /Underwriting details/);
    assert.match(view, /embedded/);
    assert.doesNotMatch(view, /ResolvedLendingRelationshipIntegrationBlock integration=\{integration\}[\s\S]*Applicant & company/);
  });

  it("route uses parseLendingApplicationSearch", () => {
    const route = read("routes/internal/lending/applications/$applicationId/index.tsx");
    assert.match(route, /parseLendingApplicationSearch/);
    assert.doesNotMatch(route, /parseWorkspaceTab/);
  });

  it("legacy thread path redirects to evidence section", () => {
    const thread = read("routes/internal/lending/applications/$applicationId/thread.tsx");
    assert.match(thread, /section:\s*["']evidence["']/);
  });
});

describe("Phase 5 active loan workspace", () => {
  it("uses RecordWorkspacePage with three tabs", () => {
    const view = read("components/internal/workspace/loan-workspace-view.tsx");
    assert.match(view, /RecordWorkspacePage/);
    assert.match(view, /id:\s*"overview"/);
    assert.match(view, /id:\s*"activity"/);
    assert.match(view, /id:\s*"more"/);
    assert.doesNotMatch(view, /WorkspaceSidebar/);
    assert.match(view, /LOAN_ACTIVITY_FILTERS|scope="loan"/);
  });

  it("route uses parseLoanWorkspaceSearch", () => {
    const route = read("routes/internal/lending/loans/$loanId.tsx");
    assert.match(route, /parseLoanWorkspaceSearch/);
  });
});

describe("Phase 5 card application/review cases", () => {
  it("application uses RecordSinglePage", () => {
    const view = read("components/internal/workspace/alta-card-application-workspace-view.tsx");
    assert.match(view, /RecordSinglePage/);
    assert.doesNotMatch(view, /WorkspaceSidebar/);
  });

  it("review uses RecordSinglePage", () => {
    const view = read("components/internal/workspace/alta-card-review-workspace-view.tsx");
    assert.match(view, /RecordSinglePage/);
    assert.doesNotMatch(view, /WorkspaceSidebar/);
  });
});

describe("Phase 5 inbox open labels", () => {
  it("uses specific review copy for card and lending", () => {
    const labels = read("lib/internal/inbox-normalize.ts");
    assert.match(labels, /Review application/);
    assert.match(labels, /Review card/);
    assert.match(labels, /Review evidence/);
    assert.match(read("components/internal/inbox/inbox-case-actions.tsx"), /inboxPrimaryActionLabel/);
  });
});
