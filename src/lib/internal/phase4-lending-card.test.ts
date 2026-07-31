import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { InternalActiveLoanRow, InternalLoanApplicationRow } from "@/lib/bank/lending-types";
import type { AltaCardRow } from "@/lib/bank/alta-card-types";
import {
  buildLendingAttentionItems,
  isWaitingOnEvidence,
  loanBorrowerType,
  loanDirectoryMatchesQuery,
  loanNeedsDirectoryAttention,
  sortLoansForDirectory,
} from "@/lib/internal/lending-desk";
import {
  buildAltaCardAttentionItems,
  maskAltaCardLastFour,
  sortCardsForDirectory,
} from "@/lib/internal/alta-card-desk";
import { withInternalSiteSearch } from "@/lib/internal/internal-route-search";
import { getInternalContextualNav } from "@/components/internal/console/internal-nav-config";
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
    tags,
    accountStatus: "active",
    internalAccess: true,
    companyMemberships: [],
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  };
}

function app(
  partial: Partial<InternalLoanApplicationRow> & Pick<InternalLoanApplicationRow, "id" | "status">,
): InternalLoanApplicationRow {
  return {
    productType: "personal_credit_line",
    productLabel: "Personal Credit Line",
    requestedAmount: 1000,
    termMonths: 6,
    estimatedTotalOutstanding: null,
    estimatedTotalInterest: null,
    purpose: "p",
    repaymentPlan: "r",
    collateralDescription: null,
    notes: null,
    statusLabel: partial.status,
    reviewNote: null,
    companyId: null,
    companyName: null,
    linkedBankAccountId: null,
    linkedAccountLabel: null,
    submittedAt: "2026-07-20T00:00:00.000Z",
    reviewedAt: null,
    threadId: null,
    threadStatus: null,
    applicantUserId: "u1",
    applicantLabel: "ada",
    linkedAccountNumber: null,
    dealRoomId: null,
    ...partial,
  };
}

function loan(
  partial: Partial<InternalActiveLoanRow> & Pick<InternalActiveLoanRow, "id" | "status">,
): InternalActiveLoanRow {
  return {
    productLabel: "Personal Credit Line",
    productType: "personal_credit_line",
    borrowerLabel: "ada",
    companyName: null,
    linkedAccountNumber: "1001",
    linkedBankAccountId: "a1",
    principalAmount: 1000,
    principalOutstanding: 800,
    accruedInterest: 0,
    currentPayoffAmount: 800,
    outstandingBalance: 800,
    guaranteedInterestOwed: 0,
    remainingPotentialInterest: 0,
    projectedFullTermCost: 1000,
    nextInterestGuaranteeDate: null,
    principalRepaid: 200,
    principalPercentRepaid: 20,
    amountRepaid: 200,
    percentRepaid: 20,
    totalRepaymentObligation: 1000,
    interestRateLabel: "7.5%",
    statusLabel: partial.status,
    includesAccruedInterest: false,
    riskStatusLabel: "n/a",
    paymentStatusLabel: "n/a",
    lastPaymentAt: null,
    nextInterestAccrualAt: null,
    interestGuaranteeSchedule: [],
    paymentSchedule: [],
    termMonths: 6,
    monthlyPrincipalPercent: null,
    updatedAt: "2026-07-28T00:00:00.000Z",
    ...partial,
  };
}

function card(partial: Partial<AltaCardRow> & Pick<AltaCardRow, "id" | "status">): AltaCardRow {
  return {
    ownerUserId: "u1",
    ownerUsername: "ada",
    companyId: null,
    companyName: null,
    applicationId: null,
    tier: "gold",
    cardType: "personal",
    creditLimit: 5000,
    availableCredit: 4000,
    currentBalance: 1000,
    statementBalance: 1000,
    minimumPaymentDue: 50,
    interestRate: 0.2,
    dueDate: null,
    currentBillingCycleStart: null,
    currentBillingCycleEnd: null,
    currentStatementId: null,
    lastStatementDate: null,
    nextStatementDate: null,
    paymentDueDate: null,
    cardLastFour: "8842",
    openedAt: "2026-01-01T00:00:00.000Z",
    closedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-07-28T00:00:00.000Z",
    ...partial,
  };
}

describe("phase4: Lending attention and evidence", () => {
  it("shows only nonzero distinct attention and does not double-count evidence", () => {
    const applications = [
      app({ id: "1", status: "pending", threadStatus: null }),
      app({ id: "2", status: "under_review", threadStatus: "waiting_on_applicant" }),
      app({ id: "3", status: "under_review", threadStatus: "waiting_on_applicant" }),
    ];
    assert.equal(isWaitingOnEvidence(applications[1]!), true);
    const items = buildLendingAttentionItems({
      applications,
      frozenLoans: [],
      siteKey: "corporate",
      withSite: withInternalSiteSearch,
    });
    const review = items.find((i) => i.id === "apps-review");
    const evidence = items.find((i) => i.id === "apps-evidence");
    assert.equal(review?.count, 1);
    assert.equal(evidence?.count, 2);
    assert.equal(items.some((i) => /Evidence cases/i.test(i.label)), false);
    const landing = read("routes/internal/lending/index.tsx");
    assert.doesNotMatch(landing, /Evidence cases/);
    assert.doesNotMatch(landing, /Operational queues/);
    assert.match(landing, /Browse loans/);
    assert.match(landing, /Needs attention/);
  });

  it("sorts attention loans before healthy and matches search", () => {
    const sorted = sortLoansForDirectory([
      loan({ id: "a", status: "active", borrowerLabel: "zoe" }),
      loan({ id: "b", status: "frozen", borrowerLabel: "ada" }),
      loan({
        id: "c",
        status: "active",
        companyName: "Acme Co",
        borrowerLabel: "Acme Co",
        productType: "business_credit_line",
        productLabel: "Business Credit Line",
      }),
    ]);
    assert.equal(sorted[0]!.id, "b");
    assert.equal(loanNeedsDirectoryAttention(sorted[0]!), true);
    assert.equal(loanBorrowerType(sorted[2]!), "company");
    assert.equal(loanDirectoryMatchesQuery(sorted[2]!, "acme"), true);
  });
});

describe("phase4: Loan directory route and auth", () => {
  it("exposes canonical loans directory with filters and site/from preservation", () => {
    const src = read("routes/internal/lending/loans/index.tsx");
    assert.match(src, /createFileRoute\("\/internal\/lending\/loans\/"\)/);
    assert.match(src, /Borrower type/);
    assert.match(src, /Needs attention/);
    assert.match(src, /Review loan/);
    assert.match(src, /buildListReturnPath/);
    assert.match(src, /withInternalSiteSearch/);
    assert.match(src, /md:hidden/);
    assert.doesNotMatch(src, />\s*Open\s*</);
    assert.throws(() => assertEntityInternalRouteAccess("corporate", "/internal/lending/loans"));
    assert.doesNotThrow(() =>
      assertEntityInternalRouteAccess("bank", "/internal/lending/loans", userWithTags(["bank_admin"])),
    );
    assert.throws(() =>
      assertEntityInternalRouteAccess(
        "terminal",
        "/internal/lending/loans",
        userWithTags(["terminal_admin"]),
      ),
    );
  });
});

describe("phase4: Alta Card attention and directory", () => {
  it("excludes active-card counts from attention", () => {
    const items = buildAltaCardAttentionItems({
      pendingApplications: 2,
      openReviews: 0,
      lostStolen: 0,
      delinquent: 1,
      siteKey: "bank",
      withSite: withInternalSiteSearch,
    });
    assert.equal(items.some((i) => /Active cards/i.test(i.label)), false);
    assert.equal(items.find((i) => i.id === "card-apps")?.count, 2);
    const landing = read("routes/internal/alta-card/index.tsx");
    assert.doesNotMatch(landing, /Billing & schedulers/);
    assert.doesNotMatch(landing, /Product snapshot/);
    assert.match(landing, /Browse cards/);
    assert.match(landing, /No Alta Card work needs attention|Needs attention/);
  });

  it("masks cards and uses simplified directory fields", () => {
    assert.equal(maskAltaCardLastFour("8842"), "•••• 8842");
    const sorted = sortCardsForDirectory([
      card({ id: "1", status: "active" }),
      card({ id: "2", status: "delinquent", cardLastFour: "1234" }),
    ]);
    assert.equal(sorted[0]!.status, "delinquent");
    const src = read("routes/internal/alta-card/cards/index.tsx");
    assert.match(src, /maskAltaCardLastFour|••••/);
    assert.match(src, /Balance \/ limit/);
    assert.match(src, /Review card/);
    assert.match(src, /md:hidden/);
    assert.doesNotMatch(src, /Opened/);
    assert.doesNotMatch(src, />\s*Open\s*</);
    assert.doesNotMatch(src, />\s*Manage\s*</);
  });
});

describe("phase4: redirects, nav, search", () => {
  it("redirects card application and review indexes to Inbox", () => {
    const apps = read("routes/internal/alta-card/applications/index.tsx");
    const reviews = read("routes/internal/alta-card/reviews/index.tsx");
    assert.match(apps, /to: "\/internal\/inbox"/);
    assert.match(apps, /alta_card_application/);
    assert.match(reviews, /to: "\/internal\/inbox"/);
    assert.match(reviews, /alta_card_review/);
    assert.doesNotMatch(apps, /queues\/alta-card-applications/);
  });

  it("keeps product contextual navigation Overview/Loans and Overview/Cards", () => {
    const lending = getInternalContextualNav("bank", "/internal/lending/loans/abc");
    assert.deepEqual(
      lending?.links.map((l) => l.label),
      ["Overview", "Loans"],
    );
    const cards = getInternalContextualNav("bank", "/internal/alta-card");
    assert.deepEqual(
      cards?.links.map((l) => l.label),
      ["Overview", "Cards"],
    );
    assert.equal(getInternalContextualNav("corporate", "/internal/alta-card"), null);
  });

  it("improves global search loan labels and borrower matching", () => {
    const src = read("server/ops-global-search.service.ts");
    assert.match(src, /discordUsername/);
    assert.match(src, /Personal Credit Line|Business Credit Line/);
    assert.match(src, /••••/);
  });

  it("zero attention states are compact on both landings", () => {
    assert.match(read("routes/internal/lending/index.tsx"), /No Lending work needs attention/);
    assert.match(read("routes/internal/alta-card/index.tsx"), /No Alta Card work needs attention/);
  });
});
