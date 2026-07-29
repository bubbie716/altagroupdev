import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CASE_RECORD_LEGACY_TAB_MAP,
  CARD_LEGACY_TAB_MAP,
  LOAN_LEGACY_TAB_MAP,
  parseCardApplicationSearch,
  parseCardReviewSearch,
  parseCardWorkspaceSearch,
  parseLendingApplicationSearch,
  parseLoanWorkspaceSearch,
} from "@/lib/internal/record-workspace-search";
import {
  CARD_ACTIVITY_FILTERS,
  LOAN_ACTIVITY_FILTERS,
  eventMatchesActivityFilter,
  filterTimelineEvents,
} from "@/lib/internal/record-activity-filters";
import { formatOpsAuditActionTitle } from "@/lib/internal/ops-activity-title";
import { buildInboxReturnPath, parseReturnPath } from "@/lib/internal/record-return-context";
import type { TimelineEvent } from "@/lib/internal/ops-types";

const root = join(import.meta.dirname, "../..");

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

describe("parseCardWorkspaceSearch", () => {
  it("defaults to overview", () => {
    assert.deepEqual(parseCardWorkspaceSearch({}), { tab: "overview" });
  });

  it("maps legacy card tabs", () => {
    assert.deepEqual(parseCardWorkspaceSearch({ tab: "payments" }), {
      tab: "activity",
      filter: "payments",
    });
    assert.deepEqual(parseCardWorkspaceSearch({ tab: "statements" }), {
      tab: "more",
      section: "statements",
    });
    assert.deepEqual(parseCardWorkspaceSearch({ tab: "notes" }), {
      tab: "more",
      section: "notes",
    });
    assert.deepEqual(parseCardWorkspaceSearch({ tab: "transactions" }), {
      tab: "activity",
      filter: "purchases",
    });
  });

  it("covers specified legacy keys", () => {
    for (const key of [
      "overview",
      "transactions",
      "statements",
      "payments",
      "autopay",
      "employees",
      "activity",
      "audit",
      "notes",
    ]) {
      assert.ok(CARD_LEGACY_TAB_MAP[key], key);
    }
  });

  it("rejects unsafe from", () => {
    assert.equal(parseCardWorkspaceSearch({ from: "https://evil.example" }).from, undefined);
  });
});

describe("parseLoanWorkspaceSearch", () => {
  it("maps legacy loan tabs", () => {
    assert.deepEqual(parseLoanWorkspaceSearch({ tab: "payments" }), {
      tab: "overview",
      section: "payments",
    });
    assert.deepEqual(parseLoanWorkspaceSearch({ tab: "schedule" }), {
      tab: "more",
      section: "schedule",
    });
    assert.deepEqual(parseLoanWorkspaceSearch({ tab: "deal-room" }), {
      tab: "more",
      section: "evidence",
    });
  });

  it("covers specified legacy keys", () => {
    for (const key of Object.keys(LOAN_LEGACY_TAB_MAP)) {
      assert.ok(LOAN_LEGACY_TAB_MAP[key]);
    }
  });
});

describe("case record search (applications/reviews)", () => {
  it("maps thread/decision into sections", () => {
    assert.deepEqual(parseLendingApplicationSearch({ tab: "thread" }), { section: "evidence" });
    assert.deepEqual(parseLendingApplicationSearch({ tab: "decision" }), { section: "decision" });
    assert.deepEqual(parseCardApplicationSearch({ tab: "notes" }), { section: "notes" });
    assert.deepEqual(parseCardReviewSearch({ tab: "audit" }), { section: "audit" });
    assert.deepEqual(parseLendingApplicationSearch({ tab: "overview" }), {});
  });

  it("covers case legacy keys", () => {
    for (const key of ["thread", "deal-room", "decision", "evidence", "audit", "notes"]) {
      assert.ok(CASE_RECORD_LEGACY_TAB_MAP[key], key);
    }
  });
});

describe("card and loan activity filters", () => {
  const events: TimelineEvent[] = [
    {
      id: "1",
      kind: "ALTA_CARD_PURCHASE",
      title: "Purchase",
      detail: "",
      actorLabel: null,
      createdAt: "2026-01-01",
      href: null,
      accountLabel: null,
      accountId: null,
    },
    {
      id: "2",
      kind: "ALTA_CARD_PAYMENT_MADE",
      title: "Payment",
      detail: "",
      actorLabel: null,
      createdAt: "2026-01-01",
      href: null,
      accountLabel: null,
      accountId: null,
    },
    {
      id: "3",
      kind: "ALTA_CARD_FROZEN",
      title: "Frozen",
      detail: "",
      actorLabel: null,
      createdAt: "2026-01-01",
      href: null,
      accountLabel: null,
      accountId: null,
    },
    {
      id: "4",
      kind: "LOAN_PAYMENT",
      title: "Loan payment",
      detail: "",
      actorLabel: null,
      createdAt: "2026-01-01",
      href: null,
      accountLabel: null,
      accountId: null,
    },
  ];

  it("exposes card and loan filter sets", () => {
    assert.ok(CARD_ACTIVITY_FILTERS.includes("purchases"));
    assert.ok(LOAN_ACTIVITY_FILTERS.includes("payments"));
  });

  it("filters card buckets", () => {
    assert.equal(filterTimelineEvents(events, "purchases", "card").length, 1);
    assert.equal(filterTimelineEvents(events, "payments", "card").length, 2);
    assert.ok(eventMatchesActivityFilter(events[2]!, "status", "card"));
  });
});

describe("ops activity titles for card/loan", () => {
  it("uses plain-language titles", () => {
    assert.equal(formatOpsAuditActionTitle("ALTA_CARD_FROZEN"), "Card frozen");
    assert.equal(formatOpsAuditActionTitle("ALTA_CARD_PAYMENT_MADE"), "Card payment posted");
    assert.equal(formatOpsAuditActionTitle("LOAN_PAID_OFF"), "Loan paid off");
  });
});

describe("return context for products", () => {
  it("labels alta-card and lending paths", () => {
    assert.equal(parseReturnPath("/internal/alta-card/cards")?.label, "Alta Card");
    assert.equal(parseReturnPath("/internal/lending")?.label, "Lending");
  });

  it("preserves inbox filters", () => {
    const path = buildInboxReturnPath({
      category: "cards",
      type: "alta_card_application",
      status: undefined,
      q: undefined,
      sort: "oldest",
    });
    assert.match(path, /category=cards/);
    assert.match(path, /type=alta_card_application/);
  });
});
