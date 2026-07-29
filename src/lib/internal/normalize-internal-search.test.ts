import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeInternalSearch,
  serializeInternalSearch,
} from "@/lib/internal/normalize-internal-search";
import { withInternalSiteSearch } from "@/lib/internal/internal-route-search";
import { toRecordWorkspaceSearchParams } from "@/lib/internal/record-workspace-search";
import { relatedRecordTarget, relatedRecordHref } from "@/components/internal/workspace/related-records";

describe("normalizeInternalSearch", () => {
  it("produces identical ordering regardless of input insertion order", () => {
    const a = normalizeInternalSearch({ tab: "overview", site: "bank" });
    const b = normalizeInternalSearch({ site: "bank", tab: "overview" });
    assert.deepEqual(Object.keys(a), Object.keys(b));
    assert.deepEqual(a, b);
    assert.equal(serializeInternalSearch(a), "site=bank&tab=overview");
    assert.equal(serializeInternalSearch(b), "site=bank&tab=overview");
  });

  it("keeps unknown valid keys in stable alphabetical order after priority keys", () => {
    const normalized = normalizeInternalSearch({
      zebra: "1",
      site: "terminal",
      alpha: "2",
      tab: "overview",
    });
    assert.deepEqual(Object.keys(normalized), ["site", "tab", "alpha", "zebra"]);
    assert.equal(serializeInternalSearch(normalized), "site=terminal&tab=overview&alpha=2&zebra=1");
  });

  it("omits undefined, null, and empty string values", () => {
    const normalized = normalizeInternalSearch({
      site: "bank",
      tab: "overview",
      from: undefined,
      section: null,
      filter: "",
    });
    assert.deepEqual(normalized, { site: "bank", tab: "overview" });
  });

  it("does not duplicate site", () => {
    const normalized = normalizeInternalSearch({ site: "bank", tab: "overview" });
    assert.equal(Object.keys(normalized).filter((k) => k === "site").length, 1);
    assert.equal(serializeInternalSearch(normalized).split("site=").length - 1, 1);
  });
});

describe("withInternalSiteSearch canonical order", () => {
  it("always emits site before tab", () => {
    assert.equal(
      serializeInternalSearch(withInternalSiteSearch({ tab: "overview" }, "bank")),
      "site=bank&tab=overview",
    );
    assert.equal(
      serializeInternalSearch(withInternalSiteSearch({ site: "bank", tab: "overview" }, "bank")),
      "site=bank&tab=overview",
    );
  });
});

describe("toRecordWorkspaceSearchParams canonical order", () => {
  it("places site before tab for workspace links", () => {
    assert.equal(
      serializeInternalSearch(
        toRecordWorkspaceSearchParams({ tab: "overview", site: "bank" }),
      ),
      "site=bank&tab=overview",
    );
    assert.equal(
      serializeInternalSearch(
        toRecordWorkspaceSearchParams({ site: "bank", tab: "overview", from: "/internal/inbox?site=bank" }),
      ),
      "site=bank&tab=overview&from=%2Finternal%2Finbox%3Fsite%3Dbank",
    );
  });
});

describe("related-record link canonical order", () => {
  it("Customer, Alta Card, Lending, and Loan targets use site-first hrefs", () => {
    const user = relatedRecordHref({ kind: "user", id: "ui-lab-user", label: "carter" }, "bank");
    const card = relatedRecordHref({ kind: "alta_card", id: "AC-LAB-GOLD", label: "Gold" }, "bank");
    const loan = relatedRecordHref({ kind: "loan", id: "LN-LAB-ACTIVE", label: "Loan" }, "bank");
    const app = relatedRecordHref(
      { kind: "lending_application", id: "app-1", label: "App" },
      "bank",
    );

    assert.match(user, /\?site=bank&tab=overview$/);
    assert.match(card, /\?site=bank&tab=overview$/);
    assert.match(loan, /\?site=bank&tab=overview$/);
    assert.ok(app.includes("site=bank"));
    assert.ok(!app.includes("tab=overview&site=bank"));

    const target = relatedRecordTarget({ kind: "user", id: "u1", label: "Ada" }, "bank");
    assert.deepEqual(Object.keys(target.search ?? {}), ["site", "tab"]);
  });
});
