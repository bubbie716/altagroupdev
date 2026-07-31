import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  CANONICAL_VISIBLE_PATHS,
  INTERNAL_ROUTE_INVENTORY,
} from "@/lib/internal/internal-route-inventory";
import {
  CANONICAL_LIST_SOURCES_FOR_CTA_SWEEP,
  FORBIDDEN_GENERIC_CTA_PATTERN,
  MOBILE_LIST_INVENTORY,
} from "@/lib/internal/mobile-list-inventory";
import {
  groupOpsSearchResults,
  prioritizeTerminalSearchResults,
  visibleGroupResults,
} from "@/lib/internal/ops-search-groups";
import type { GlobalSearchResult } from "@/lib/internal/ops-types";
import {
  loanNeedsDirectoryAttention,
  nextLoanDueLabel,
} from "@/lib/internal/lending-desk";
import type { InternalActiveLoanRow } from "@/lib/bank/lending-types";
import {
  buildRelationshipDirectoryRows,
  relationshipHasScoreDrop,
} from "@/lib/internal/relationship-desk";
import type { RelationshipIntelligenceDashboard } from "@/lib/bank/relationship-intelligence-types";
import { getInternalContextualNav } from "@/components/internal/console/internal-nav-config";
import { resolveInternalRouteTitle } from "@/lib/internal/internal-route-title";

const root = join(import.meta.dirname, "../..");

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

function walkTsx(dir: string, base = ""): string[] {
  let out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const rel = base ? `${base}/${e}` : e;
    if (statSync(p).isDirectory()) out = out.concat(walkTsx(p, rel));
    else if (e.endsWith(".tsx")) out.push(rel);
  }
  return out;
}

function sampleLoan(
  patch: Partial<InternalActiveLoanRow> & Pick<InternalActiveLoanRow, "status" | "paymentSchedule">,
): InternalActiveLoanRow {
  const { status, paymentSchedule, statusLabel, riskStatusLabel, paymentStatusLabel, ...rest } =
    patch;
  return {
    id: "loan-1",
    productLabel: "Line",
    productType: "personal_credit_line",
    borrowerLabel: "carter",
    companyName: null,
    linkedAccountNumber: null,
    linkedBankAccountId: null,
    principalAmount: 1000,
    principalOutstanding: 1000,
    accruedInterest: 0,
    currentPayoffAmount: 1000,
    outstandingBalance: 1000,
    guaranteedInterestOwed: 0,
    remainingPotentialInterest: 0,
    projectedFullTermCost: 1000,
    nextInterestGuaranteeDate: null,
    principalRepaid: 0,
    principalPercentRepaid: 0,
    amountRepaid: 0,
    percentRepaid: 0,
    totalRepaymentObligation: 1000,
    interestRateLabel: "7.5%",
    status,
    statusLabel: statusLabel ?? String(status),
    includesAccruedInterest: false,
    riskStatusLabel: riskStatusLabel ?? "Not available",
    paymentStatusLabel: paymentStatusLabel ?? "Not available",
    lastPaymentAt: null,
    nextInterestAccrualAt: null,
    interestGuaranteeSchedule: [],
    paymentSchedule,
    termMonths: 6,
    monthlyPrincipalPercent: null,
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...rest,
  };
}

describe("Phase 8 Relationship Intelligence", () => {
  it("exposes Relationships in Corporate Directory and Bank Customers contextual nav", () => {
    const corporate = getInternalContextualNav("corporate", "/internal/users");
    const bank = getInternalContextualNav("bank", "/internal/companies");
    assert.ok(corporate?.links.some((l) => l.label === "Relationships" && l.to === "/internal/relationships"));
    assert.ok(bank?.links.some((l) => l.label === "Relationships"));
    const terminal = getInternalContextualNav("terminal", "/internal/terminal/investors");
    assert.ok(!terminal?.links.some((l) => /relationship/i.test(l.label)));
    assert.equal(resolveInternalRouteTitle("/internal/relationships"), "Relationships");
  });

  it("builds directory rows with score-drop attention without inventing thresholds", () => {
    const data: RelationshipIntelligenceDashboard = {
      totalProfiles: 2,
      preferredOrPremierCount: 1,
      topByAssets: [
        {
          userId: "u1",
          discordUsername: "carter",
          relationshipScore: 80,
          relationshipTier: "PREFERRED",
          totalAltaAssets: 1000,
          lastCalculatedAt: "2026-07-01T00:00:00.000Z",
        },
      ],
      recentlyChanged: [
        {
          userId: "u1",
          discordUsername: "carter",
          oldScore: 95,
          newScore: 80,
          oldTier: "PREMIER",
          newTier: "PREFERRED",
          calculatedAt: "2026-07-01T00:00:00.000Z",
        },
      ],
    };
    assert.ok(relationshipHasScoreDrop(data.recentlyChanged[0]!));
    const rows = buildRelationshipDirectoryRows(data);
    assert.equal(rows[0]?.needsAttention, true);
    assert.match(rows[0]?.attentionDetail ?? "", /score drop/i);
    const page = read("routes/internal/relationships/index.tsx");
    assert.match(page, /Review relationship/);
    assert.doesNotMatch(page, />\s*Open\s*</);
  });
});

describe("Phase 8 Communications progressive disclosure", () => {
  it("keeps a simple channel + text sender with UI Lab gating", () => {
    const src = read("components/internal/discord-embed-builder.tsx");
    assert.match(src, /Target channel/);
    assert.match(src, /EmbedFieldLabel[\s\S]*label="Text"|label="Text"/);
    assert.match(src, /useUiLabMutationGate/);
    assert.match(src, /dirty|window\.confirm/);
    assert.doesNotMatch(src, /bot token|DISCORD_BANK_BOT_TOKEN/i);
    const fns = read("lib/discord/discord-embed.functions.ts");
    assert.match(fns, /assertNotUiLabMutation\("Discord message send"\)/);
  });
});

describe("Phase 8 global search grouping", () => {
  it("groups Bank/Corporate results and keeps audit secondary", () => {
    const rows: GlobalSearchResult[] = [
      { id: "a1", type: "audit", label: "audit event", sublabel: "x", href: "/internal/audit" },
      { id: "u1", type: "user", label: "carter", sublabel: "Investor", href: "/internal/users/u1" },
      { id: "ac1", type: "account", label: "Checking", sublabel: "ƒ", href: "/internal/bank/accounts/ac1" },
      { id: "t1", type: "transaction", label: "Transfer", sublabel: "ƒ", href: "/internal/bank/transactions/t1" },
      { id: "r1", type: "relationship_profile", label: "carter", sublabel: "Preferred", href: "/internal/users/u1" },
    ];
    const groups = groupOpsSearchResults(rows, "carter");
    assert.equal(groups[0]?.id, "people");
    assert.ok(groups.some((g) => g.id === "audit"));
    assert.ok(groups.findIndex((g) => g.id === "people") < groups.findIndex((g) => g.id === "audit"));
    const audit = groups.find((g) => g.id === "audit")!;
    const collapsed = visibleGroupResults(audit, false);
    assert.ok(collapsed.visible.length <= 3);
  });

  it("prioritizes Terminal orders/portfolios before people", () => {
    const rows: GlobalSearchResult[] = [
      { id: "u1", type: "user", label: "carter", sublabel: "Investor", href: "/internal/users/u1" },
      { id: "o1", type: "terminal_order", label: "NPT", sublabel: "Buy", href: "/internal/terminal/orders/o1" },
      { id: "p1", type: "terminal_portfolio", label: "Core", sublabel: "Personal", href: "/internal/terminal/portfolios/p1" },
    ];
    const ranked = prioritizeTerminalSearchResults(rows, "NPT");
    assert.equal(ranked[0]?.type, "terminal_order");
  });

  it("wires grouped search UI without Bank products in Terminal placeholder", () => {
    const src = read("components/internal/internal-global-search.tsx");
    assert.match(src, /groupOpsSearchResults/);
    assert.match(src, /View more/);
    assert.match(src, /Escape/);
    assert.match(src, /Search investors, portfolios, orders/);
  });
});

describe("Phase 8 loan due-state precedence", () => {
  const overdueSchedule = [
    {
      id: "s1",
      installmentNumber: 1,
      dueDate: "2026-01-01T00:00:00.000Z",
      scheduledAmount: 100,
      paidAmount: 0,
      remainingAmount: 100,
      principalPortion: 100,
      interestPortion: 0,
      principalPercent: 10,
      status: "overdue" as const,
      statusLabel: "Overdue",
    },
  ];
  const pendingSchedule = [
    {
      ...overdueSchedule[0]!,
      status: "pending" as const,
      statusLabel: "Pending",
      dueDate: "2026-08-01T00:00:00.000Z",
    },
  ];

  it("suppresses overdue labels for paid-off loans despite schedule leftovers", () => {
    const paid = sampleLoan({ status: "paid_off", statusLabel: "Paid Off", paymentSchedule: overdueSchedule });
    assert.equal(nextLoanDueLabel(paid), "Paid off");
    assert.equal(loanNeedsDirectoryAttention(paid), false);

    const frozen = sampleLoan({ status: "frozen", statusLabel: "Frozen", paymentSchedule: overdueSchedule });
    assert.equal(nextLoanDueLabel(frozen), "Frozen");
    assert.equal(loanNeedsDirectoryAttention(frozen), true);

    const active = sampleLoan({ status: "active", statusLabel: "Active", paymentSchedule: overdueSchedule });
    assert.match(nextLoanDueLabel(active), /Overdue/);
    assert.equal(loanNeedsDirectoryAttention(active), true);

    const current = sampleLoan({
      status: "active",
      statusLabel: "Active",
      paymentSchedule: pendingSchedule,
    });
    assert.match(nextLoanDueLabel(current), /^Due /);
    assert.equal(loanNeedsDirectoryAttention(current), false);
  });
});

describe("Phase 8 filter chip semantics", () => {
  it("uses OpsFilterChip with aria-pressed (not aria-current) on filter directories", () => {
    for (const rel of [
      "routes/internal/terminal/investors/index.tsx",
      "routes/internal/terminal/portfolios/index.tsx",
      "routes/internal/terminal/orders/index.tsx",
      "routes/internal/bank/transfers/index.tsx",
    ]) {
      const src = read(rel);
      assert.match(src, /OpsFilterChip/);
      assert.match(src, /pressed=\{filter === id\}/);
      assert.doesNotMatch(src, /aria-current/);
    }
    const chip = read("components/internal/console/ops-filter-chip.tsx");
    assert.match(chip, /aria-pressed=\{pressed\}/);
    assert.doesNotMatch(chip, /aria-current=/);
  });
});

describe("Phase 8 route inventory", () => {
  it("classifies every internal route file exactly once", () => {
    const files = walkTsx(join(root, "routes/internal")).sort();
    const inv = INTERNAL_ROUTE_INVENTORY.map((e) => e.file).sort();
    assert.deepEqual(inv, files);
    assert.ok(CANONICAL_VISIBLE_PATHS.includes("/internal/relationships"));
    assert.ok(CANONICAL_VISIBLE_PATHS.includes("/internal/embeds"));
    const redirects = INTERNAL_ROUTE_INVENTORY.filter((e) => e.classification === "compatibility_redirect");
    assert.ok(redirects.some((e) => e.file.startsWith("queues/")));
    assert.ok(
      INTERNAL_ROUTE_INVENTORY.some(
        (e) => e.file === "listings.tsx" && e.classification === "intentionally_unavailable",
      ),
    );
  });

  it("keeps retired Exchange names out of primary nav", () => {
    const nav = read("components/internal/console/internal-nav-config.ts");
    assert.doesNotMatch(nav, /Private Banking|NCC|Deal Rooms|IPOs|Listings/);
    assert.match(nav, /Communications/);
    assert.match(nav, /label: "Relationships"/);
  });
});

describe("Phase 8 mobile list inventory", () => {
  it("requires mobile cards and desktop tables on canonical lists", () => {
    for (const entry of MOBILE_LIST_INVENTORY) {
      const src = read(entry.source);
      assert.match(src, entry.mobilePattern, entry.surface);
      assert.match(src, entry.desktopPattern, entry.surface);
    }
  });

  it("avoids generic Open/Manage/Queue/View CTAs on canonical lists", () => {
    for (const rel of CANONICAL_LIST_SOURCES_FOR_CTA_SWEEP) {
      const src = read(rel);
      assert.doesNotMatch(src, FORBIDDEN_GENERIC_CTA_PATTERN, rel);
    }
  });
});

describe("Phase 8 overlay and terminology contracts", () => {
  it("keeps RecordActionsSheet opaque surface patterns", () => {
    const sheet = read("components/internal/workspace/record-actions-sheet.tsx");
    assert.match(sheet, /bg-surface/);
    assert.match(sheet, /Sheet|Dialog|portal/i);
  });

  it("documents InternalPageShell usage on Relationships and Communications", () => {
    assert.match(read("routes/internal/relationships/index.tsx"), /InternalPageShell title=/);
    assert.match(read("routes/internal/embeds.tsx"), /InternalPageShell/);
    assert.match(read("routes/internal/embeds.tsx"), /Communications/);
  });
});
