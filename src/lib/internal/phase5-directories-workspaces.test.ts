import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  companyMatchesQuery,
  companyNeedsDirectoryAttention,
  customerNeedsDirectoryAttention,
  customerProductSummary,
  limitRelatedRecords,
  sortCustomersForDirectory,
  sortCompaniesForDirectory,
  suggestedLoanPaymentAmount,
} from "@/lib/internal/directory-desk";
import { resolveInternalRouteTitle } from "@/lib/internal/internal-route-title";
import type { InternalUserListRow } from "@/lib/internal/user-management.types";
import type { InternalCompanyRow } from "@/lib/company/types";
import { assertEntityInternalRouteAccess } from "@/lib/internal/entity-internal-scope";
import type { AltaUser } from "@/lib/auth/types";

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

function customer(
  partial: Partial<InternalUserListRow> & Pick<InternalUserListRow, "id" | "discordUsername" | "accountStatus">,
): InternalUserListRow {
  return {
    discordId: "d1",
    email: null,
    minecraftUsername: null,
    minecraftUuid: null,
    minecraftVerifiedAt: null,
    eligibilityConfirmedAt: null,
    coreOnboardingCompletedAt: null,
    onboardingCompletedAt: null,
    tags: [],
    companyCount: 0,
    bankAccountCount: 0,
    altaCardCount: 0,
    activeLoanCount: 0,
    terminalPortfolioCount: 0,
    totalBankBalance: 0,
    lastLoginAt: "2026-07-28T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

function company(
  partial: Partial<InternalCompanyRow> & Pick<InternalCompanyRow, "id" | "name" | "verificationStatus">,
): InternalCompanyRow {
  return {
    ticker: null,
    type: "Private Company",
    sector: "Energy",
    status: "Active",
    representativeCount: 1,
    primaryContact: "carter",
    lastUpdated: "2026-07-28",
    ...partial,
  };
}

describe("phase5: Customer directory", () => {
  it("uses simplified columns and mobile Review customer cards", () => {
    const src = read("routes/internal/users/index.tsx");
    assert.match(src, /Standing/);
    assert.match(src, /Products \/ relationships/);
    assert.match(src, /Last activity|Last /);
    assert.match(src, /Needs attention/);
    assert.match(src, /Review customer/);
    assert.match(src, /md:hidden/);
    assert.doesNotMatch(src, />\s*Manage\s*</);
    assert.doesNotMatch(src, /header: "Discord ID"/);
    assert.doesNotMatch(src, /header: "Email"/);
    assert.doesNotMatch(src, /header: "Bank balance"/);
    assert.doesNotMatch(src, /AdminDataTable/);
  });

  it("sorts attention customers first when filtered", () => {
    const sorted = sortCustomersForDirectory(
      [
        customer({ id: "1", discordUsername: "zoe", accountStatus: "active" }),
        customer({ id: "2", discordUsername: "ada", accountStatus: "frozen" }),
      ],
      true,
    );
    assert.equal(sorted.length, 1);
    assert.equal(sorted[0]!.id, "2");
    assert.equal(customerNeedsDirectoryAttention(sorted[0]!), true);
    assert.match(customerProductSummary(customer({
      id: "3",
      discordUsername: "x",
      accountStatus: "active",
      bankAccountCount: 2,
      altaCardCount: 1,
      activeLoanCount: 1,
    })), /2 accts/);
  });
});

describe("phase5: Company directory", () => {
  it("uses simplified columns without row verification mutations", () => {
    const src = read("routes/internal/companies/index.tsx");
    assert.match(src, /Type \/ sector/);
    assert.match(src, /Verification/);
    assert.match(src, /Primary contact/);
    assert.match(src, /Review company/);
    assert.match(src, /md:hidden/);
    assert.doesNotMatch(src, /CompanyVerificationActions/);
    assert.doesNotMatch(src, />\s*Manage\s*</);
    assert.doesNotMatch(src, /AdminDataTable/);
  });

  it("sorts attention companies and matches search", () => {
    const sorted = sortCompaniesForDirectory(
      [
        company({ id: "1", name: "Verified Co", verificationStatus: "verified" }),
        company({ id: "2", name: "Pending Co", verificationStatus: "pending" }),
      ],
      true,
    );
    assert.equal(sorted[0]!.id, "2");
    assert.equal(companyNeedsDirectoryAttention(sorted[0]!), true);
    assert.equal(companyMatchesQuery(sorted[0]!, "pending"), true);
  });
});

describe("phase5: Record title architecture", () => {
  it("keeps route fallbacks and does not duplicate title as workspace h2", () => {
    assert.equal(resolveInternalRouteTitle("/internal/users/ui-lab-user"), "Customer");
    assert.equal(resolveInternalRouteTitle("/internal/companies/CO-ALTG"), "Company");
    assert.equal(resolveInternalRouteTitle("/internal/lending/loans/LN-LAB-ACTIVE"), "Loan");
    assert.equal(resolveInternalRouteTitle("/internal/alta-card/AC-LAB-GOLD"), "Alta Card");
    assert.equal(resolveInternalRouteTitle("/internal/terminal/portfolios/x"), "Portfolio");
    const layout = read("components/internal/workspace/record-workspace-layout.tsx");
    assert.doesNotMatch(layout, /<h2[\s\S]*\{title\}/);
    assert.match(layout, /Shell H1 owns the unique record title|aria-label=\{title\}/);
  });
});

describe("phase5: Actions, context, related records", () => {
  it("removes related-record lists from Customer Actions", () => {
    const src = read("components/internal/workspace/customer-workspace-view.tsx");
    assert.doesNotMatch(src, /RecordActionGroup title="Related records"/);
    assert.match(src, /RecordActionNavButton/);
    assert.match(src, /isTerminalSite/);
    assert.match(src, /limitRelatedRecords/);
    assert.match(src, /Other Alta products|Terminal/);
  });

  it("moves company recommendation mutations out of Overview", () => {
    const src = read("components/internal/workspace/company-workspace-view.tsx");
    assert.match(src, /mode="summary"/);
    assert.match(src, /recommendations/);
    assert.match(src, /Manage recommendations|RecordActionNavButton/);
    const overviewChunk = src.slice(src.indexOf('id: "overview"'), src.indexOf('id: "activity"'));
    assert.doesNotMatch(overviewChunk, /mode="manage"/);
    assert.doesNotMatch(overviewChunk, />Regenerate</);
  });

  it("limits related records and supports View all", () => {
    const { visible, hasMore, remaining } = limitRelatedRecords([1, 2, 3, 4, 5, 6], 4);
    assert.deepEqual(visible, [1, 2, 3, 4]);
    assert.equal(hasMore, true);
    assert.equal(remaining, 2);
    const customer = read("components/internal/workspace/customer-workspace-view.tsx");
    assert.match(customer, /View all/);
  });
});

describe("phase5: Alta Card and loan payment", () => {
  it("renames Close card and keeps sheet Close distinct", () => {
    const card = read("components/internal/workspace/alta-card-workspace-view.tsx");
    assert.match(card, /label="Close card"/);
    assert.match(card, /label="Freeze card"/);
    assert.match(card, /label="Mark card lost"/);
    assert.doesNotMatch(card, /label="Close"/);
    assert.doesNotMatch(card, /label="Close \(lost\)"/);
    const sheet = read("components/ui/sheet.tsx");
    assert.match(sheet, />Close</);
  });

  it("labels payment amount and does not default to full payoff", () => {
    const form = read("components/internal/internal-loan-payment-form.tsx");
    assert.match(form, /Payment amount/);
    assert.match(form, /Review payment/);
    assert.match(form, /Confirm payment/);
    assert.doesNotMatch(form, /useState\(String\(currentPayoffAmount\)\)/);
    assert.equal(suggestedLoanPaymentAmount([{ status: "pending", remainingAmount: 250 }]), 250);
    assert.equal(suggestedLoanPaymentAmount([{ status: "paid", remainingAmount: 0 }]), null);
  });
});

describe("phase5: Overlay close and terminal isolation", () => {
  it("closes Actions sheet before navigation", () => {
    const sheet = read("components/internal/workspace/record-actions-sheet.tsx");
    assert.match(sheet, /useRecordActionsClose|closeThen/);
    assert.match(sheet, /RecordActionNavButton/);
  });

  it("keeps Terminal-only staff off Bank product routes", () => {
    assert.throws(() =>
      assertEntityInternalRouteAccess(
        "terminal",
        "/internal/bank/accounts",
        userWithTags(["terminal_admin"]),
      ),
    );
    assert.doesNotThrow(() =>
      assertEntityInternalRouteAccess(
        "terminal",
        "/internal/users/ui-lab-user",
        userWithTags(["terminal_admin"]),
      ),
    );
  });

  it("preserves site/from on directory record links", () => {
    assert.match(read("routes/internal/users/index.tsx"), /buildListReturnPath/);
    assert.match(read("routes/internal/companies/index.tsx"), /buildListReturnPath/);
    assert.match(read("routes/internal/users/index.tsx"), /withInternalSiteSearch/);
    assert.match(read("routes/internal/companies/index.tsx"), /withInternalSiteSearch/);
  });
});
