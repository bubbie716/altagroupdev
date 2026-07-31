import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildInboxSummary,
  dedupeInboxItems,
  inboxItemFromDeposit,
  inboxItemFromException,
  inboxItemFromWithdrawal,
  inboxPrimaryActionLabel,
} from "@/lib/internal/inbox-normalize";
import type { InboxItem } from "@/lib/internal/inbox-types";
import type { InternalBankTransactionRow } from "@/lib/bank/backend-types";
import {
  formatOpsAuditActionTitle,
  isPassiveHomeActivityAction,
} from "@/lib/internal/ops-activity-title";
import {
  homeAttentionTotal,
  rankHomeAttention,
  selectHomePlatformStatus,
  selectHomeRecentActivity,
} from "@/lib/internal/home-attention";
import type { ActivityFeedItem, OpsHealthItem } from "@/lib/internal/ops-types";

const root = join(import.meta.dirname, "../..");

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

function tx(
  partial: Partial<InternalBankTransactionRow> & Pick<InternalBankTransactionRow, "id">,
): InternalBankTransactionRow {
  return {
    referenceCode: "DEP-1",
    type: "DEPOSIT",
    account: "10000001",
    holder: "Ada Lovelace",
    amount: "ƒ100.00",
    method: "CHEST",
    status: "PENDING",
    submitted: "2026-07-20T10:00:00.000Z",
    proofImageUrl: null,
    proofFileName: null,
    proofUploadedAt: null,
    hasProof: true,
    description: "Chest deposit",
    memo: null,
    ...partial,
  };
}

function exceptionItem(id: string, title: string): InboxItem {
  return inboxItemFromException({
    id,
    category: id.startsWith("queue-") ? "pending_review" : "negative_balance",
    severity: "medium",
    title,
    detail: "detail",
    createdAt: "2026-07-21T00:00:00.000Z",
    href: id.startsWith("queue-") ? "/internal/bank/deposits" : "/internal/bank/accounts/a1",
    dispositionStatus: "OPEN",
  })!;
}

describe("phase2: Inbox deduplication", () => {
  it("one pending deposit creates one item, not deposit plus aggregate", () => {
    const deposit = inboxItemFromDeposit(tx({ id: "d1" }));
    const aggregate = exceptionItem("queue-deposits", "1 pending deposits");
    const items = dedupeInboxItems([deposit, aggregate]);
    assert.equal(items.length, 1);
    assert.equal(items[0]!.caseType, "deposit");
    assert.equal(items.some((i) => i.id === "exception:queue-deposits"), false);
  });

  it("two pending withdrawals create two items, not three", () => {
    const w1 = inboxItemFromWithdrawal(tx({ id: "w1", referenceCode: "WD-1", type: "WITHDRAWAL" }));
    const w2 = inboxItemFromWithdrawal(tx({ id: "w2", referenceCode: "WD-2", type: "WITHDRAWAL" }));
    const aggregate = exceptionItem("queue-withdrawals", "2 pending withdrawals");
    const items = dedupeInboxItems([w1, w2, aggregate]);
    assert.equal(items.length, 2);
    assert.equal(items.every((i) => i.caseType === "withdrawal"), true);
  });

  it("standalone exception without matching money case still appears", () => {
    const standalone = exceptionItem("neg-acct-1", "Negative balance · 10000001");
    const aggregate = exceptionItem("queue-deposits", "1 pending deposits");
    const items = dedupeInboxItems([standalone, aggregate]);
    assert.equal(items.length, 2);
    assert.ok(items.some((i) => i.id === "exception:neg-acct-1"));
    assert.ok(items.some((i) => i.id === "exception:queue-deposits"));
  });

  it("does not combine unrelated cases merely because category matches", () => {
    const deposit = inboxItemFromDeposit(tx({ id: "d1" }));
    const failed = inboxItemFromException({
      id: "stf-1",
      category: "failed_transfer",
      severity: "high",
      title: "Payroll transfer",
      detail: "Failed",
      createdAt: "2026-07-21T00:00:00.000Z",
      href: "/internal/bank/transfers/stf-1",
      dispositionStatus: "OPEN",
    })!;
    const items = dedupeInboxItems([deposit, failed]);
    assert.equal(items.length, 2);
    assert.ok(items.some((i) => i.caseType === "deposit"));
    assert.ok(items.some((i) => i.caseType === "exception"));
  });

  it("counts and age metrics are calculated after deduplication", () => {
    const deposit = inboxItemFromDeposit(tx({ id: "d1" }));
    deposit.ageMs = 30 * 3_600_000;
    const withdrawal = inboxItemFromWithdrawal(tx({ id: "w1", referenceCode: "WD-1" }));
    withdrawal.ageMs = 80 * 3_600_000;
    const aggregateDep = exceptionItem("queue-deposits", "1 pending deposits");
    const aggregateWdr = exceptionItem("queue-withdrawals", "1 pending withdrawals");
    const deduped = dedupeInboxItems([deposit, withdrawal, aggregateDep, aggregateWdr]);
    assert.equal(deduped.length, 2);
    const summary = buildInboxSummary(deduped);
    assert.equal(summary.total, 2);
    assert.equal(summary.byCategory.money, 2);
    assert.equal(summary.byCategory.risk, 0);
    assert.equal(summary.olderThan24Hours, 2);
    assert.equal(summary.olderThan72Hours, 1);
    assert.equal(summary.oldestAgeMs, 80 * 3_600_000);
  });
});

describe("phase2: Home attention and copy", () => {
  it("hides zero-count attention categories via rankHomeAttention", () => {
    const ranked = rankHomeAttention([
      {
        id: "deposits",
        label: "Pending deposits",
        count: 1,
        to: "/internal/inbox",
        search: { category: "money" },
        urgency: 90,
        tone: "alert",
      },
      {
        id: "openings",
        label: "Account openings",
        count: 0,
        to: "/internal/inbox",
        search: { category: "account_opening" },
        urgency: 65,
        tone: "warn",
      },
    ]);
    assert.equal(ranked.length, 1);
    assert.equal(ranked[0]!.id, "deposits");
    assert.equal(homeAttentionTotal(ranked), 1);
  });

  it("Corporate and Bank Home source only render nonzero attention via helpers", () => {
    assert.match(read("routes/internal/index.tsx"), /rankHomeAttention/);
    assert.match(read("routes/internal/bank/index.tsx"), /rankHomeAttention/);
    assert.match(read("routes/internal/index.tsx"), /withInternalSiteSearch/);
    assert.match(read("routes/internal/bank/index.tsx"), /site\.key/);
    assert.doesNotMatch(read("routes/internal/index.tsx"), /Platform vitals/);
    assert.doesNotMatch(read("routes/internal/bank/index.tsx"), /Product work lives in/);
  });

  it("nonzero categories link to canonical filtered Inbox destinations", () => {
    const corporate = read("routes/internal/index.tsx");
    assert.match(corporate, /type: "deposit"/);
    assert.match(corporate, /type: "withdrawal"/);
    assert.match(corporate, /to: "\/internal\/inbox"/);
    const bank = read("routes/internal/bank/index.tsx");
    assert.match(bank, /type: "deposit"/);
    assert.match(bank, /category: "lending"/);
  });

  it("humanizes Home event titles and excludes passive recommendation views", () => {
    assert.equal(
      formatOpsAuditActionTitle("BANK_BALANCE_RECONCILIATION_MISMATCH"),
      "Balance reconciliation mismatch",
    );
    assert.equal(formatOpsAuditActionTitle("STAFF_AUDIT_MESSAGE_FAILED"), "Staff alert delivery failed");
    assert.equal(
      formatOpsAuditActionTitle("ALTA_CARD_RELATIONSHIP_RECOMMENDATION_VIEWED"),
      "Relationship recommendation viewed",
    );
    assert.equal(isPassiveHomeActivityAction("ALTA_CARD_RELATIONSHIP_RECOMMENDATION_VIEWED"), true);
    assert.equal(isPassiveHomeActivityAction("DEPOSIT_APPROVED"), false);
    assert.match(read("server/ops-platform.service.ts"), /formatOpsAuditActionTitle/);
    assert.match(read("server/ops-platform.service.ts"), /isPassiveHomeActivityAction/);
  });

  it("selects compact platform status and recent activity", () => {
    const health: OpsHealthItem[] = [
      { key: "maintenance", label: "Maintenance", status: "operational", detail: "ok", lastSuccessAt: null },
      { key: "scheduled_transfers", label: "Transfers", status: "degraded", detail: "fail", lastSuccessAt: null },
      { key: "deposit_interest", label: "Interest", status: "operational", detail: "ok", lastSuccessAt: null },
      { key: "platform", label: "Platform", status: "operational", detail: "ok", lastSuccessAt: null },
      { key: "audit", label: "Audit", status: "operational", detail: "ok", lastSuccessAt: null },
    ];
    const selected = selectHomePlatformStatus(health);
    assert.ok(selected.length <= 4);
    assert.equal(selected[0]!.key, "scheduled_transfers");

    const activity: ActivityFeedItem[] = Array.from({ length: 12 }, (_, i) => ({
      id: `a${i}`,
      category: "audit",
      title: i % 2 === 0 ? "Deposit approved" : `Event ${i}`,
      detail: "d",
      accountLabel: null,
      accountId: null,
      href: null,
      actorLabel: "ops",
      createdAt: new Date(Date.now() - i * 60_000).toISOString(),
    }));
    const recent = selectHomeRecentActivity(activity, 6);
    assert.ok(recent.length <= 6);
  });
});

describe("phase2: Inbox UI contracts", () => {
  it("uses Review verbs and quieter reference labels", () => {
    const deposit = inboxItemFromDeposit(tx({ id: "d1" }));
    assert.equal(inboxPrimaryActionLabel(deposit), "Review deposit");
    assert.equal(deposit.referenceLabel, "DEP-1");
    const page = read("components/internal/inbox/inbox-page.tsx");
    assert.match(page, /Over 24h/);
    assert.match(page, /More filters/);
    assert.match(page, /filtersActive/);
    assert.match(page, /INBOX_CATEGORY_LABELS/);
    assert.match(read("lib/internal/inbox-types.ts"), /account_opening: "Openings"/);
  });

  it("shows Clear only when filters are active", () => {
    const page = read("components/internal/inbox/inbox-page.tsx");
    assert.match(page, /filtersActive \? \(/);
    assert.match(page, /Clear/);
  });

  it("keeps Phase 1 header inbox shortcut and site helpers", () => {
    assert.match(read("components/internal/console/internal-header.tsx"), /InternalInboxShortcut/);
    assert.doesNotMatch(read("components/internal/console/internal-header.tsx"), /InternalNotificationsBell/);
    assert.match(read("components/internal/terminal-internal-home.tsx"), /new Map\(attention/);
  });

  it("mobile structural contracts for Home and Inbox", () => {
    const page = read("components/internal/inbox/inbox-page.tsx");
    assert.match(page, /lg:hidden/);
    assert.match(page, /SheetContent/);
    assert.match(page, /overlayClassName="lg:hidden"/);
    assert.match(page, /open=\{Boolean\(selected\) && isMobileSheet\}/);
    assert.match(page, /useMediaQueryMax\(INBOX_MOBILE_SHEET_MAX_PX\)/);
    assert.match(page, /grid-cols-2 gap-2 sm:grid-cols-4/);
    assert.doesNotMatch(read("routes/internal/index.tsx"), /OpsTable/);
    assert.doesNotMatch(read("routes/internal/index.tsx"), /ActivityFeedTable/);
  });
});
