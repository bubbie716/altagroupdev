import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildInboxSummary,
  filterAndSortInboxItems,
  inboxItemFromDeposit,
  inboxItemFromException,
  inboxItemFromWithdrawal,
} from "@/lib/internal/inbox-normalize";
import {
  LEGACY_QUEUE_TO_INBOX,
  inboxSearchToParams,
  parseInboxSearch,
  type InboxItem,
} from "@/lib/internal/inbox-types";
import type { InternalBankTransactionRow } from "@/lib/bank/backend-types";

function tx(partial: Partial<InternalBankTransactionRow> & Pick<InternalBankTransactionRow, "id">): InternalBankTransactionRow {
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

function baseItem(overrides: Partial<InboxItem>): InboxItem {
  return {
    id: "deposit:1",
    category: "money",
    caseType: "deposit",
    title: "DEP-1",
    description: "Chest deposit",
    partyLabel: "Ada",
    amount: 100,
    amountLabel: "ƒ100.00",
    status: "PENDING",
    statusLabel: "Needs review",
    statusTone: "needs_review",
    priority: "normal",
    createdAt: "2026-07-20T10:00:00.000Z",
    ageMs: 48 * 3_600_000,
    referenceLabel: "10000001",
    destination: { to: "/internal/bank/transactions/$transactionId", params: { transactionId: "1" } },
    actions: ["approve", "deny", "open"],
    hasProof: true,
    assignee: null,
    actionTargetId: "1",
    ...overrides,
  };
}

describe("inbox normalization and filtering", () => {
  it("maps deposits and withdrawals into Money with operator status labels", () => {
    const deposit = inboxItemFromDeposit(tx({ id: "d1" }));
    assert.equal(deposit.category, "money");
    assert.equal(deposit.caseType, "deposit");
    assert.equal(deposit.title, "Review deposit");
    assert.equal(deposit.referenceLabel, "DEP-1");
    assert.equal(deposit.statusLabel, "Needs review");
    assert.equal(deposit.hasProof, true);
    assert.ok(deposit.actions.includes("approve"));

    const withdrawal = inboxItemFromWithdrawal(tx({ id: "w1", referenceCode: "WD-1" }));
    assert.equal(withdrawal.category, "money");
    assert.equal(withdrawal.caseType, "withdrawal");
    assert.equal(withdrawal.title, "Review withdrawal");
    assert.equal(withdrawal.referenceLabel, "WD-1");
  });

  it("maps open exceptions into Risk", () => {
    const item = inboxItemFromException({
      id: "neg:acct-1",
      category: "balance",
      severity: "critical",
      title: "Negative balance",
      detail: "Account below zero",
      createdAt: "2026-07-21T00:00:00.000Z",
      href: "/internal/bank/accounts/acct-1",
      dispositionStatus: "OPEN",
    });
    assert.ok(item);
    assert.equal(item!.category, "risk");
    assert.equal(item!.caseType, "exception");
  });

  it("builds aging summary counts", () => {
    const items = [
      baseItem({ id: "a", ageMs: 2 * 3_600_000 }),
      baseItem({ id: "b", ageMs: 30 * 3_600_000, category: "lending", caseType: "lending_application" }),
      baseItem({ id: "c", ageMs: 80 * 3_600_000, category: "risk", caseType: "exception" }),
    ];
    const summary = buildInboxSummary(items);
    assert.equal(summary.total, 3);
    assert.equal(summary.olderThan24Hours, 2);
    assert.equal(summary.olderThan72Hours, 1);
    assert.equal(summary.byCategory.money, 1);
    assert.equal(summary.byCategory.lending, 1);
    assert.equal(summary.byCategory.risk, 1);
    assert.equal(summary.oldestAgeMs, 80 * 3_600_000);
  });

  it("filters by category/type/status/search and defaults to oldest first", () => {
    const items = [
      baseItem({ id: "new", createdAt: "2026-07-27T10:00:00.000Z", ageMs: 1 * 3_600_000, title: "NEW" }),
      baseItem({
        id: "old",
        createdAt: "2026-07-20T10:00:00.000Z",
        ageMs: 170 * 3_600_000,
        title: "OLD",
        partyLabel: "Grace Hopper",
      }),
      baseItem({
        id: "loan",
        category: "lending",
        caseType: "lending_application",
        title: "APP-9",
        ageMs: 10 * 3_600_000,
      }),
    ];

    const money = filterAndSortInboxItems(items, { category: "money", sort: "oldest" });
    assert.equal(money.length, 2);
    assert.equal(money[0]!.id, "old");

    const depositType = filterAndSortInboxItems(items, { type: "deposit" });
    assert.equal(depositType.every((i) => i.caseType === "deposit"), true);

    const searched = filterAndSortInboxItems(items, { q: "hopper" });
    assert.equal(searched.length, 1);
    assert.equal(searched[0]!.id, "old");

    const newest = filterAndSortInboxItems(items, { category: "money", sort: "newest" });
    assert.equal(newest[0]!.id, "new");
  });

  it("parses shareable Inbox search params and maps legacy queues", () => {
    assert.deepEqual(parseInboxSearch({ category: "money", type: "deposit", sort: "newest" }), {
      category: "money",
      type: "deposit",
      status: undefined,
      q: undefined,
      sort: "newest",
      caseId: undefined,
      site: undefined,
    });
    assert.deepEqual(LEGACY_QUEUE_TO_INBOX.deposits, { category: "money", type: "deposit" });
    assert.deepEqual(LEGACY_QUEUE_TO_INBOX.exceptions, { category: "risk", type: "exception" });
    assert.deepEqual(LEGACY_QUEUE_TO_INBOX["deal-rooms"], { type: "deal_room" });

    const params = inboxSearchToParams({
      category: "lending",
      type: "lending_application",
      sort: "oldest",
      q: "smith",
    });
    assert.equal(params.category, "lending");
    assert.equal(params.type, "lending_application");
    assert.equal(params.sort, undefined);
    assert.equal(params.q, "smith");
  });
});
