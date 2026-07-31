import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  CORPORATE_PRIMARY_NAV,
  BANK_PRIMARY_NAV,
  TERMINAL_PRIMARY_NAV,
  getInternalPrimaryNav,
  resolveInternalPrimarySection,
} from "@/components/internal/console/internal-nav-config";
import {
  assertEntityInternalRouteAccess,
  isInternalPathAllowedForUser,
} from "@/lib/internal/entity-internal-scope";
import { canAccessBankInternal, canAccessTerminalInternal } from "@/lib/auth/permissions";
import type { AltaUser } from "@/lib/auth/types";
import { assertNotUiLabMutation } from "@/lib/internal/ui-lab-mutation-gate";

const root = join(import.meta.dirname, "../..");

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

function userWithTags(tags: AltaUser["tags"]): AltaUser {
  return {
    id: "u1",
    discordId: "1",
    discordUsername: "tester",
    avatarUrl: null,
    email: null,
    minecraftUsername: null,
    minecraftUuid: null,
    minecraftVerifiedAt: null,
    eligibilityConfirmedAt: null,
    coreOnboardingCompletedAt: null,
    onboardingCompletedAt: null,
    tags,
    accountStatus: "active",
    internalAccess: true,
    companyMemberships: [],
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  };
}

describe("Phase 8 navigation coherence", () => {
  it("keeps corporate group-only and subsidiary navigation consistent", () => {
    assert.deepEqual(
      CORPORATE_PRIMARY_NAV.map((l) => l.label),
      ["Home", "Inbox", "Directory", "System"],
    );
    assert.deepEqual(
      BANK_PRIMARY_NAV.map((l) => l.label),
      ["Home", "Inbox", "Customers", "Money", "Products", "System"],
    );
    assert.deepEqual(
      TERMINAL_PRIMARY_NAV.map((l) => l.label),
      ["Home", "Inbox", "Investors", "Portfolios", "Orders", "System"],
    );
    assert.equal(getInternalPrimaryNav("corporate"), CORPORATE_PRIMARY_NAV);
    assert.equal(getInternalPrimaryNav("bank"), BANK_PRIMARY_NAV);
    assert.equal(getInternalPrimaryNav("terminal"), TERMINAL_PRIMARY_NAV);
  });

  it("does not expose Bank money routes on Terminal primary nav", () => {
    const paths = TERMINAL_PRIMARY_NAV.flatMap((l) => [l.to, ...(l.matchPrefixes ?? [])]);
    assert.ok(!paths.some((p) => p.startsWith("/internal/bank")));
    assert.ok(!paths.some((p) => p.startsWith("/internal/lending")));
    assert.ok(!paths.some((p) => p.startsWith("/internal/alta-card")));
  });
});

describe("Phase 8 cross-product isolation", () => {
  it("denies Terminal-only staff Bank money and Bank-only staff Terminal ops", () => {
    const terminalAdmin = userWithTags(["terminal_admin"]);
    const bankAdmin = userWithTags(["bank_admin"]);
    assert.equal(canAccessBankInternal(terminalAdmin), false);
    assert.equal(canAccessTerminalInternal(terminalAdmin), true);
    assert.equal(canAccessBankInternal(bankAdmin), true);
    assert.equal(canAccessTerminalInternal(bankAdmin), false);
    assert.throws(() =>
      assertEntityInternalRouteAccess("terminal", "/internal/bank/accounts", terminalAdmin),
    );
    assert.throws(() =>
      assertEntityInternalRouteAccess("terminal", "/internal/bank/interest", terminalAdmin),
    );
    assert.throws(() =>
      assertEntityInternalRouteAccess("bank", "/internal/terminal/orders", bankAdmin),
    );
    assert.equal(
      isInternalPathAllowedForUser("terminal", "/internal/terminal/portfolios", terminalAdmin),
      true,
    );
  });
});

describe("Phase 8 UI Lab mutation safety", () => {
  it("gates manual interest, transfers, Alta Pay reverse, and jobs in UI", () => {
    assert.match(read("components/bank/internal-manual-interest-ops.tsx"), /useUiLabMutationGate/);
    assert.match(
      read("components/bank/internal-manual-interest-ops.tsx"),
      /Manual interest posting and scheduling are disabled in UI Lab/,
    );
    assert.match(read("components/bank/internal-account-interest-ops.tsx"), /unavailableLabel\("Preview"\)/);
    assert.match(
      read("components/internal/workspace/scheduled-transfer-workspace-view.tsx"),
      /useUiLabMutationGate/,
    );
    assert.match(
      read("components/internal/workspace/alta-pay-payment-workspace-view.tsx"),
      /useUiLabMutationGate/,
    );
    assert.match(read("routes/internal/bank/alta-pay/index.tsx"), /useUiLabMutationGate/);
    assert.match(read("components/internal/jobs/internal-jobs-table.tsx"), /unavailableLabel\("Run"\)/);
  });

  it("blocks manual interest and job mutations server-side in UI Lab helpers", () => {
    assert.match(read("lib/bank/manual-interest.functions.ts"), /assertNotUiLabMutation/);
    assert.match(read("lib/internal/ops-jobs.functions.ts"), /assertNotUiLabMutation/);
    assert.match(read("lib/bank/lending.functions.ts"), /assertNotUiLabMutation/);
    assert.match(read("lib/company/company.functions.ts"), /assertNotUiLabMutation/);
    assert.match(read("lib/internal/user-management.functions.ts"), /assertNotUiLabMutation/);
    assert.match(read("lib/internal/internal-note.functions.ts"), /assertNotUiLabMutation/);
    // assertNotUiLabMutation throws only when UI Lab is on; outside UI Lab it is a no-op.
    assert.doesNotThrow(() => assertNotUiLabMutation("test"));
  });

  it("gates lending, company verification, customer standing, staff access, and notes in UI", () => {
    assert.match(read("components/internal/workspace/lending-application-workspace-view.tsx"), /useUiLabMutationGate/);
    assert.match(read("components/internal/company-verification-actions.tsx"), /unavailableLabel\("Verify"\)/);
    assert.match(read("components/internal/internal-user-account-status-panel.tsx"), /useUiLabMutationGate/);
    assert.match(read("components/internal/internal-user-tag-panel.tsx"), /useUiLabMutationGate/);
    assert.match(read("components/internal/internal-note-panel.tsx"), /unavailableLabel\("Add note"\)/);
  });

  it("hides Inbox mutation actions in UI Lab while keeping open links", () => {
    const actions = read("components/internal/inbox/inbox-case-actions.tsx");
    assert.match(actions, /useUiLabMutationGate/);
    assert.match(actions, /!uiLab && item\.caseType === "deposit"/);
    assert.match(actions, /!uiLab && item\.caseType === "withdrawal"/);
  });

  it("uses specific Inbox open labels instead of Open record", () => {
    const actions = read("components/internal/inbox/inbox-case-actions.tsx");
    assert.doesNotMatch(actions, /"Open record"/);
    assert.match(actions, /inboxPrimaryActionLabel/);
    const labels = read("lib/internal/inbox-normalize.ts");
    assert.match(labels, /Review account opening/);
    assert.match(labels, /Review company verification/);
    assert.match(labels, /Review exception/);
    assert.match(labels, /Review failed transfer/);
  });
});

describe("Phase 8 legacy and dead-route posture", () => {
  it("retains compatibility redirects for queues and scheduled transfers", () => {
    assert.ok(existsSync(join(root, "routes/internal/queues/deposits.tsx")));
    assert.ok(existsSync(join(root, "routes/internal/bank/scheduled.tsx")));
    assert.match(read("routes/internal/bank/scheduled.tsx"), /redirect/);
    assert.match(read("routes/internal/queues/deposits.tsx"), /redirect/);
  });

  it("keeps listings/ipos as intentional home redirects, not fake ops", () => {
    assert.match(read("routes/internal/listings.tsx"), /redirect/);
    assert.match(read("routes/internal/ipos.tsx"), /redirect/);
  });

  it("does not restore Private Banking internal queue routes", () => {
    assert.equal(existsSync(join(root, "routes/internal/queues/private-banking.tsx")), false);
  });
});

describe("Phase 8 shell and Terminal honesty", () => {
  it("preserves InternalPageShell stable sync keys", () => {
    const shell = read("components/internal/internal-page-shell.tsx");
    assert.match(shell, /breadcrumbKey/);
    assert.match(shell, /actionsKey/);
  });

  it("keeps Terminal System honest about unavailable sync/recon", () => {
    const system = read("routes/internal/terminal/system.tsx");
    assert.match(system, /not implemented/i);
    assert.match(system, /Readiness/);
    assert.match(system, /Reconciliation/);
    assert.doesNotMatch(system, /Fully reconciled/);
    assert.doesNotMatch(system, /Run reconciliation/);
  });

  it("activates Terminal System for legacy settings path", () => {
    assert.equal(resolveInternalPrimarySection("terminal", "/internal/terminal/settings"), "system");
  });
});
