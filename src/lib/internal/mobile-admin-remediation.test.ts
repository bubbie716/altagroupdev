import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  formatAltaCardTransactionSummary,
  formatAltaCardTransactionType,
} from "@/lib/bank/alta-card-types";
import { formatLendingAuditActionTitle } from "@/lib/bank/lending-audit-display";
import {
  formatOpsAuditActionTitle,
  isPassiveHomeActivityAction,
} from "@/lib/internal/ops-activity-title";

const root = join(import.meta.dirname, "../..");

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

describe("mobile-admin remediation: internal shell scroll architecture", () => {
  it("bounds shell height with UI Lab banner subtraction", () => {
    const css = read("styles.css");
    assert.match(css, /--internal-shell-available-height:\s*calc\(100dvh - var\(--ui-lab-banner-height/);
    assert.match(css, /body:has\(\.internal-shell\) \.flex\.min-h-screen/);
    assert.match(css, /height:\s*var\(--internal-shell-available-height\)/);
    assert.match(css, /html:has\(\.internal-shell\)/);
  });

  it("gives the inner flex column min-h-0 so main can scroll", () => {
    const shell = read("components/internal/console/internal-shell.tsx");
    const css = read("styles.css");
    assert.match(shell, /internal-shell-column/);
    assert.match(shell, /internal-main/);
    assert.doesNotMatch(shell, /\bh-dvh\b/);
    assert.match(css, /\.internal-shell-column\s*\{[^}]*min-height:\s*0/s);
    assert.match(css, /\.internal-shell-column\s*\{[^}]*overflow:\s*hidden/s);
  });

  it("keeps main as the authoritative overflow-y-auto region", () => {
    const css = read("styles.css");
    const shell = read("components/internal/console/internal-shell.tsx");
    assert.match(css, /\.internal-main\s*\{[^}]*overflow-y:\s*auto/s);
    assert.match(css, /\.internal-main\s*\{[^}]*min-height:\s*0/s);
    assert.match(shell, /<main className="internal-main/);
    assert.doesNotMatch(shell, /internal-main[^"]*overflow-y-auto/);
  });
});

describe("mobile-admin remediation: shared sheets", () => {
  it("bounds left/right sheets to available height with scrollable bodies", () => {
    const sheet = read("components/ui/sheet.tsx");
    assert.match(sheet, /--internal-sheet-available-height/);
    assert.match(sheet, /left:[\s\S]*overflow-hidden/);
    assert.match(sheet, /right:[\s\S]*overflow-hidden/);

    const record = read("components/internal/workspace/record-actions-sheet.tsx");
    assert.match(record, /min-h-0 flex-1 overflow-y-auto/);
    assert.match(record, /safe-area-inset-bottom/);

    const jobs = read("components/internal/jobs/internal-jobs-table.tsx");
    assert.match(jobs, /min-h-0 flex-1 overflow-y-auto/);
    assert.doesNotMatch(jobs, /maxHeight:\s*"calc\(100dvh/);

    const interest = read("routes/internal/bank/interest.tsx");
    assert.match(interest, /min-h-0 flex-1[\s\S]*overflow-y-auto/);
    assert.doesNotMatch(interest, /maxHeight:\s*"calc\(100dvh/);

    const inbox = read("components/internal/inbox/inbox-page.tsx");
    assert.match(inbox, /min-h-0 flex-1 overflow-y-auto/);
    assert.match(inbox, /--internal-sheet-available-height/);

    const audit = read("routes/internal/audit.tsx");
    assert.match(audit, /--internal-sheet-available-height/);
    assert.match(audit, /min-h-0 flex-1[\s\S]*overflow-y-auto/);

    const mobileNav = read("components/internal/console/internal-mobile-nav.tsx");
    assert.match(mobileNav, /overflow-hidden/);
    assert.match(mobileNav, /safe-area-inset-bottom/);
  });
});

describe("mobile-admin remediation: contextual navigation", () => {
  it("scrolls primary links separately while pinning the 44px More trigger", () => {
    const css = read("styles.css");
    const nav = read("components/internal/console/internal-contextual-nav.tsx");
    assert.match(css, /\.internal-contextual-nav\s*\{[^}]*overflow-x:\s*hidden/s);
    assert.match(css, /\.internal-contextual-nav\s*\{[^}]*safe-area-inset-right/s);
    assert.match(css, /\.internal-contextual-nav-scroll\s*\{[^}]*overflow-x:\s*auto/s);
    assert.match(css, /\.internal-contextual-nav-mobile\s*\{[^}]*overflow:\s*hidden/s);
    assert.match(nav, /internal-contextual-nav-scroll/);
    assert.match(nav, /internal-contextual-nav-more shrink-0/);
    assert.match(nav, /min-h-11 min-w-11/);
    assert.match(nav, /label="More"/);
  });
});

describe("mobile-admin remediation: Alta Card activity copy", () => {
  it("humanizes transaction types with a visual amount separator", () => {
    assert.equal(formatAltaCardTransactionType("cash_advance"), "Cash advance");
    assert.equal(formatAltaCardTransactionType("purchase"), "Purchase");
    assert.equal(formatAltaCardTransactionType("payment"), "Payment");
    assert.equal(formatAltaCardTransactionSummary("cash_advance", 100), "Cash advance · ƒ100.00");
    assert.match(formatAltaCardTransactionSummary("cash_advance", 100), / · /);
    assert.doesNotMatch(formatAltaCardTransactionSummary("cash_advance", 100), /cash_advanceƒ/);
  });

  it("excludes passive relationship-view events from Alta Card timeline query", () => {
    assert.equal(isPassiveHomeActivityAction("ALTA_CARD_RELATIONSHIP_RECOMMENDATION_VIEWED"), true);
    assert.equal(isPassiveHomeActivityAction("ALTA_CARD_PAYMENT_MADE"), false);
    const service = read("server/ops-platform.service.ts");
    assert.match(service, /entityType === "ALTA_CARD" && isPassiveHomeActivityAction/);
    assert.match(
      read("components/internal/workspace/alta-card-workspace-view.tsx"),
      /formatAltaCardTransactionSummary/,
    );
  });
});

describe("mobile-admin remediation: loan activity copy", () => {
  it("sentence-cases loan payment audit titles via the lending formatter", () => {
    assert.equal(formatLendingAuditActionTitle("LOAN_PAYMENT_MADE"), "Loan payment made");
    assert.equal(formatLendingAuditActionTitle("LOAN_PAYMENT"), "Loan payment");
    assert.equal(formatOpsAuditActionTitle("LOAN_PAYMENT_MADE"), "Loan payment made");
    assert.doesNotMatch(formatLendingAuditActionTitle("LOAN_PAYMENT_MADE"), /LOAN PAYMENT MADE/);
  });
});
