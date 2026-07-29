import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CUSTOMER_LEGACY_TAB_MAP,
  COMPANY_LEGACY_TAB_MAP,
  customerRelationshipSearch,
  companyRelationshipSearch,
  isSafeInternalFrom,
  parseCompanyWorkspaceSearch,
  parseCustomerWorkspaceSearch,
  toRecordWorkspaceSearchParams,
} from "@/lib/internal/record-workspace-search";
import {
  activityCategoryLabel,
  eventMatchesActivityFilter,
  filterTimelineEvents,
} from "@/lib/internal/record-activity-filters";
import { buildInboxReturnPath, parseReturnPath } from "@/lib/internal/record-return-context";
import type { TimelineEvent } from "@/lib/internal/ops-types";

describe("parseCustomerWorkspaceSearch", () => {
  it("defaults to overview", () => {
    assert.deepEqual(parseCustomerWorkspaceSearch({}), { tab: "overview" });
    assert.deepEqual(parseCustomerWorkspaceSearch(undefined), { tab: "overview" });
  });

  it("maps legacy tabs into overview sections", () => {
    assert.deepEqual(parseCustomerWorkspaceSearch({ tab: "accounts" }), {
      tab: "overview",
      section: "accounts",
    });
    assert.deepEqual(parseCustomerWorkspaceSearch({ tab: "alta-card" }), {
      tab: "overview",
      section: "cards",
    });
    assert.deepEqual(parseCustomerWorkspaceSearch({ tab: "lending" }), {
      tab: "overview",
      section: "lending",
    });
    assert.deepEqual(parseCustomerWorkspaceSearch({ tab: "relationship" }), {
      tab: "overview",
      section: "relationship",
    });
    assert.deepEqual(parseCustomerWorkspaceSearch({ tab: "companies" }), {
      tab: "overview",
      section: "companies",
    });
  });

  it("maps timeline and audit into activity", () => {
    assert.deepEqual(parseCustomerWorkspaceSearch({ tab: "timeline" }), { tab: "activity" });
    assert.deepEqual(parseCustomerWorkspaceSearch({ tab: "activity" }), { tab: "activity" });
    assert.deepEqual(parseCustomerWorkspaceSearch({ tab: "audit" }), {
      tab: "activity",
      filter: "operator",
    });
  });

  it("maps flags and notes into more", () => {
    assert.deepEqual(parseCustomerWorkspaceSearch({ tab: "flags" }), {
      tab: "more",
      section: "review-flags",
    });
    assert.deepEqual(parseCustomerWorkspaceSearch({ tab: "review-flags" }), {
      tab: "more",
      section: "review-flags",
    });
    assert.deepEqual(parseCustomerWorkspaceSearch({ tab: "notes" }), {
      tab: "more",
      section: "notes",
    });
  });

  it("preserves canonical tab/section/filter and safe from", () => {
    assert.deepEqual(
      parseCustomerWorkspaceSearch({
        tab: "activity",
        filter: "money",
        from: "/internal/inbox?category=lending",
      }),
      {
        tab: "activity",
        filter: "money",
        from: "/internal/inbox?category=lending",
      },
    );
    assert.deepEqual(
      parseCustomerWorkspaceSearch({
        tab: "overview",
        section: "accounts",
      }),
      { tab: "overview", section: "accounts" },
    );
  });

  it("rejects unsafe from values", () => {
    assert.equal(
      parseCustomerWorkspaceSearch({ tab: "overview", from: "https://evil.example" }).from,
      undefined,
    );
    assert.equal(
      parseCustomerWorkspaceSearch({ tab: "overview", from: "//evil.example" }).from,
      undefined,
    );
  });
});

describe("parseCompanyWorkspaceSearch", () => {
  it("maps company legacy tabs", () => {
    assert.deepEqual(parseCompanyWorkspaceSearch({ tab: "members" }), {
      tab: "overview",
      section: "people",
    });
    assert.deepEqual(parseCompanyWorkspaceSearch({ tab: "alta-pay" }), {
      tab: "overview",
      section: "commercial",
    });
    assert.deepEqual(parseCompanyWorkspaceSearch({ tab: "relationship" }), {
      tab: "overview",
      section: "relationship",
    });
  });
});

describe("relationship search helpers", () => {
  it("emits canonical overview+relationship", () => {
    assert.deepEqual(customerRelationshipSearch(), {
      tab: "overview",
      section: "relationship",
    });
    assert.deepEqual(companyRelationshipSearch(), {
      tab: "overview",
      section: "relationship",
    });
  });
});

describe("toRecordWorkspaceSearchParams", () => {
  it("omits default filter all", () => {
    assert.deepEqual(toRecordWorkspaceSearchParams({ tab: "activity", filter: "all" }), {
      tab: "activity",
    });
  });
});

describe("legacy maps cover phase-3 tab ids", () => {
  it("includes all specified customer legacy keys", () => {
    for (const key of [
      "overview",
      "accounts",
      "alta-card",
      "lending",
      "relationship",
      "companies",
      "timeline",
      "audit",
      "review-flags",
      "notes",
    ]) {
      assert.ok(CUSTOMER_LEGACY_TAB_MAP[key], key);
    }
  });

  it("includes all specified company legacy keys", () => {
    for (const key of [
      "overview",
      "members",
      "accounts",
      "alta-card",
      "lending",
      "relationship",
      "alta-pay",
      "timeline",
      "audit",
      "review-flags",
      "notes",
    ]) {
      assert.ok(COMPANY_LEGACY_TAB_MAP[key], key);
    }
  });
});

describe("activity filters", () => {
  const events: TimelineEvent[] = [
    {
      id: "1",
      kind: "DEPOSIT",
      title: "Deposit",
      detail: "100",
      actorLabel: null,
      createdAt: "2026-01-01",
      href: null,
      accountLabel: null,
      accountId: null,
    },
    {
      id: "2",
      kind: "LOAN_APPLICATION",
      title: "Loan application",
      detail: "",
      actorLabel: null,
      createdAt: "2026-01-02",
      href: null,
      accountLabel: null,
      accountId: null,
    },
    {
      id: "3",
      kind: "ALTA_CARD_REVIEW",
      title: "Card review",
      detail: "",
      actorLabel: null,
      createdAt: "2026-01-03",
      href: null,
      accountLabel: null,
      accountId: null,
    },
    {
      id: "4",
      kind: "RELATIONSHIP_TIER_CHANGED",
      title: "Tier changed",
      detail: "",
      actorLabel: null,
      createdAt: "2026-01-04",
      href: null,
      accountLabel: null,
      accountId: null,
    },
    {
      id: "5",
      kind: "OPS_REVIEW_FLAG",
      title: "Flag opened",
      detail: "",
      actorLabel: "ops",
      createdAt: "2026-01-05",
      href: null,
      accountLabel: null,
      accountId: null,
    },
  ];

  it("filters by product category", () => {
    assert.equal(filterTimelineEvents(events, "money").length, 1);
    assert.equal(filterTimelineEvents(events, "lending").length, 1);
    assert.equal(filterTimelineEvents(events, "cards").length, 1);
    assert.equal(filterTimelineEvents(events, "relationship").length, 1);
    assert.equal(filterTimelineEvents(events, "operator").length, 1);
    assert.equal(filterTimelineEvents(events, "all").length, 5);
  });

  it("labels categories in plain language", () => {
    assert.equal(activityCategoryLabel("DEPOSIT"), "Money");
    assert.equal(activityCategoryLabel("LOAN_APPROVED"), "Lending");
    assert.ok(eventMatchesActivityFilter(events[0]!, "money"));
  });
});

describe("return context", () => {
  it("builds inbox return paths with filters", () => {
    assert.equal(buildInboxReturnPath({ category: "companies", sort: "oldest" }), "/internal/inbox?category=companies");
    assert.equal(buildInboxReturnPath({ category: "all", sort: "oldest" }), "/internal/inbox");
  });

  it("parses safe return paths", () => {
    const parsed = parseReturnPath("/internal/inbox?category=lending&sort=newest");
    assert.ok(parsed);
    assert.equal(parsed!.pathname, "/internal/inbox");
    assert.equal(parsed!.label, "Inbox");
    assert.equal(parsed!.search.category, "lending");
  });

  it("rejects non-internal from", () => {
    assert.equal(isSafeInternalFrom("/bank/accounts"), false);
    assert.equal(isSafeInternalFrom("/internal/users/abc"), true);
  });
});
