import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = join(import.meta.dirname, "../../..");

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

describe("workspace tab navigation", () => {
  it("pushes tab search history instead of replace", () => {
    const source = read("components/internal/workspace/workspace-page.tsx");
    assert.match(source, /search:\s*\(prev/);
    assert.doesNotMatch(source, /replace:\s*true/);
  });

  it("exposes accessible tablist and scrolls the active tab into view", () => {
    const layout = read("components/internal/console/workspace-layout.tsx");
    assert.match(layout, /role="tablist"/);
    assert.match(layout, /role="tab"/);
    assert.match(layout, /scrollIntoView/);
    assert.match(layout, /workspace-tabs-scroll/);
    assert.match(layout, /More workspace tabs/);
  });
});

describe("pending transaction detail resolution", () => {
  it("renders resolve actions on the transaction overview panel", () => {
    const view = read("components/internal/workspace/transaction-workspace-view.tsx");
    assert.match(view, /TransactionWorkspaceActions/);
    assert.match(view, /layout="panel"/);
    assert.match(view, /Return to Inbox/);
    assert.doesNotMatch(view, /Open Inbox money cases/);

    const actions = read("components/internal/transaction-workspace-actions.tsx");
    assert.match(actions, /Resolve transaction/);
    assert.match(actions, /Approve deposit/);
    assert.doesNotMatch(actions, /Open inbox/);
    assert.match(actions, /requireReason|Confirm approval/);
  });
});

describe("internal mobile shell", () => {
  it("wires a mobile nav drawer from shared nav config", () => {
    const shell = read("components/internal/console/internal-shell.tsx");
    assert.match(shell, /InternalMobileNav/);

    const header = read("components/internal/console/internal-header.tsx");
    assert.match(header, /Open navigation menu/);
    assert.match(header, /setMobileNavOpen/);

    const mobile = read("components/internal/console/internal-mobile-nav.tsx");
    assert.match(mobile, /InternalNavLinks/);
    assert.match(mobile, /BackToSiteButton/);
    assert.match(mobile, /onNavigate=\{close\}/);
  });
});

describe("InternalPageShell title sync", () => {
  it("syncs on stable string keys instead of unstable breadcrumb or actions refs", () => {
    const source = read("components/internal/internal-page-shell.tsx");
    assert.match(source, /breadcrumbKey/);
    assert.match(source, /actionsKey/);
    assert.match(source, /breadcrumbsRef/);
    assert.match(source, /actionsRef/);
    assert.doesNotMatch(source, /resolvedBreadcrumbs\]/);
    assert.doesNotMatch(source, /,\s*breadcrumbs,\s*actions\s*\]/);
    assert.doesNotMatch(source, /prevSyncKey/);
  });

  it("bails out of setPage when shell chrome is unchanged", () => {
    const source = read("components/internal/console/internal-shell-context.tsx");
    assert.match(source, /sameTitle && sameActions && sameBreadcrumbs/);
    assert.match(source, /return prev/);
  });
});
