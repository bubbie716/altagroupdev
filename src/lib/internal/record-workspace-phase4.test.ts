import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ACCOUNT_LEGACY_TAB_MAP,
  TRANSACTION_LEGACY_TAB_MAP,
  parseAccountWorkspaceSearch,
  parseTransactionRecordSearch,
  buildListReturnPath,
  toTransactionRecordSearchParams,
} from "@/lib/internal/record-workspace-search";
import {
  ACCOUNT_ACTIVITY_FILTERS,
  eventMatchesActivityFilter,
  filterTimelineEvents,
} from "@/lib/internal/record-activity-filters";
import {
  buildTransactionLifecycle,
  plainTransactionTypeTitle,
  transactionDirectionLabel,
} from "@/lib/internal/transaction-record-copy";
import type { TimelineEvent } from "@/lib/internal/ops-types";

describe("parseAccountWorkspaceSearch", () => {
  it("defaults to overview", () => {
    assert.deepEqual(parseAccountWorkspaceSearch({}), { tab: "overview" });
  });

  it("maps legacy account tabs", () => {
    assert.deepEqual(parseAccountWorkspaceSearch({ tab: "transactions" }), {
      tab: "activity",
      filter: "money",
    });
    assert.deepEqual(parseAccountWorkspaceSearch({ tab: "statements" }), {
      tab: "more",
      section: "statements",
    });
    assert.deepEqual(parseAccountWorkspaceSearch({ tab: "holds" }), {
      tab: "more",
      section: "holds",
    });
    assert.deepEqual(parseAccountWorkspaceSearch({ tab: "holds-restrictions" }), {
      tab: "more",
      section: "holds",
    });
    assert.deepEqual(parseAccountWorkspaceSearch({ tab: "audit" }), {
      tab: "more",
      section: "audit",
    });
    assert.deepEqual(parseAccountWorkspaceSearch({ tab: "notes" }), {
      tab: "more",
      section: "notes",
    });
    assert.deepEqual(parseAccountWorkspaceSearch({ tab: "activity" }), { tab: "activity" });
  });

  it("covers all specified legacy keys", () => {
    for (const key of [
      "overview",
      "transactions",
      "activity",
      "statements",
      "holds",
      "holds-restrictions",
      "audit",
      "notes",
    ]) {
      assert.ok(ACCOUNT_LEGACY_TAB_MAP[key], key);
    }
  });
});

describe("parseTransactionRecordSearch", () => {
  it("defaults to empty canonical search", () => {
    assert.deepEqual(parseTransactionRecordSearch({}), {});
    assert.deepEqual(parseTransactionRecordSearch({ tab: "overview" }), {});
  });

  it("maps legacy transaction tabs to sections", () => {
    assert.deepEqual(parseTransactionRecordSearch({ tab: "related" }), { section: "related" });
    assert.deepEqual(parseTransactionRecordSearch({ tab: "related-records" }), {
      section: "related",
    });
    assert.deepEqual(parseTransactionRecordSearch({ tab: "flags" }), {
      section: "review-flags",
    });
    assert.deepEqual(parseTransactionRecordSearch({ tab: "notes" }), { section: "notes" });
    assert.deepEqual(parseTransactionRecordSearch({ tab: "audit" }), { section: "audit" });
  });

  it("preserves safe from", () => {
    assert.deepEqual(
      parseTransactionRecordSearch({
        from: "/internal/inbox?category=money",
      }),
      { from: "/internal/inbox?category=money" },
    );
  });

  it("covers legacy keys", () => {
    for (const key of ["overview", "related", "related-records", "review-flags", "flags", "audit", "notes"]) {
      assert.ok(TRANSACTION_LEGACY_TAB_MAP[key], key);
    }
  });
});

describe("toTransactionRecordSearchParams", () => {
  it("omits overview/summary sections", () => {
    assert.deepEqual(toTransactionRecordSearchParams({ section: "overview" }), {});
    assert.deepEqual(toTransactionRecordSearchParams({ section: "notes" }), { section: "notes" });
  });
});

describe("account activity filters", () => {
  const events: TimelineEvent[] = [
    {
      id: "1",
      kind: "DEPOSIT",
      title: "Deposit",
      detail: "",
      actorLabel: null,
      createdAt: "2026-01-01",
      href: null,
      accountLabel: null,
      accountId: null,
    },
    {
      id: "2",
      kind: "ALTA_PAY",
      title: "Alta Pay",
      detail: "",
      actorLabel: null,
      createdAt: "2026-01-02",
      href: null,
      accountLabel: null,
      accountId: null,
    },
    {
      id: "3",
      kind: "INTEREST_CREDIT",
      title: "Interest",
      detail: "",
      actorLabel: null,
      createdAt: "2026-01-03",
      href: null,
      accountLabel: null,
      accountId: null,
    },
    {
      id: "4",
      kind: "HOLD_APPLIED",
      title: "Hold",
      detail: "",
      actorLabel: null,
      createdAt: "2026-01-04",
      href: null,
      accountLabel: null,
      accountId: null,
    },
    {
      id: "5",
      kind: "STATUS_CHANGE",
      title: "Frozen",
      detail: "",
      actorLabel: "ops",
      createdAt: "2026-01-05",
      href: null,
      accountLabel: null,
      accountId: null,
    },
  ];

  it("exposes account filter set", () => {
    assert.deepEqual([...ACCOUNT_ACTIVITY_FILTERS], [
      "all",
      "money",
      "payments",
      "interest",
      "holds",
      "operator",
    ]);
  });

  it("filters account buckets", () => {
    assert.equal(filterTimelineEvents(events, "money", "account").length, 1);
    assert.equal(filterTimelineEvents(events, "payments", "account").length, 1);
    assert.equal(filterTimelineEvents(events, "interest", "account").length, 1);
    assert.equal(filterTimelineEvents(events, "holds", "account").length, 1);
    assert.equal(filterTimelineEvents(events, "operator", "account").length, 1);
    assert.ok(eventMatchesActivityFilter(events[3]!, "holds", "account"));
  });
});

describe("transaction record copy", () => {
  it("uses plain-language titles", () => {
    assert.equal(plainTransactionTypeTitle("DEPOSIT"), "Deposit");
    assert.equal(plainTransactionTypeTitle("WITHDRAWAL", "Alta Pay merchant"), "Alta Pay sent");
    assert.equal(plainTransactionTypeTitle("INTEREST_CREDIT"), "Interest credit");
  });

  it("labels direction", () => {
    assert.equal(transactionDirectionLabel("DEPOSIT"), "Incoming");
    assert.equal(transactionDirectionLabel("WITHDRAWAL"), "Outgoing");
  });

  it("builds lifecycle for pending and approved", () => {
    const pending = buildTransactionLifecycle({
      createdAt: "2026-01-01T00:00:00.000Z",
      status: "PENDING",
    });
    assert.ok(pending.some((e) => e.title === "Pending review"));

    const approved = buildTransactionLifecycle({
      createdAt: "2026-01-01T00:00:00.000Z",
      status: "APPROVED",
      reviewedAt: "2026-01-02T00:00:00.000Z",
      reviewedByLabel: "ops",
      reviewNote: "ok",
    });
    assert.ok(approved.some((e) => e.title === "Approved"));
    assert.ok(approved.some((e) => e.title === "Completed"));
  });
});

describe("ops activity titles", () => {
  it("uses plain-language titles", async () => {
    const { formatOpsAuditActionTitle } = await import("./ops-activity-title");
    assert.equal(formatOpsAuditActionTitle("BANK_INTERNAL_TRANSFER_COMPLETED"), "Transfer completed");
    assert.equal(formatOpsAuditActionTitle("DEPOSIT_APPROVED"), "Deposit approved");
    assert.equal(formatOpsAuditActionTitle("BANK_DEPOSIT_REQUEST_SUBMITTED"), "Deposit submitted");
    assert.match(formatOpsAuditActionTitle("SOME_CUSTOM_ACTION"), /Some Custom Action/);
  });
});

describe("list return paths", () => {
  it("preserves filters", () => {
    assert.equal(
      buildListReturnPath("/internal/bank/accounts", { status: "frozen", q: "treasury" }),
      "/internal/bank/accounts?status=frozen&q=treasury",
    );
    assert.equal(buildListReturnPath("/internal/bank/transactions", {}), "/internal/bank/transactions");
  });
});
