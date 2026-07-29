import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseAltaCardWorkspaceSearch,
  INTERNAL_ALTA_CARD_WORKSPACE_SEARCH,
  withInternalSiteSearch,
} from "@/lib/internal/internal-route-search";

describe("parseAltaCardWorkspaceSearch", () => {
  it("handles undefined and empty search without throwing", () => {
    assert.deepEqual(parseAltaCardWorkspaceSearch(undefined), { tab: "overview" });
    assert.deepEqual(parseAltaCardWorkspaceSearch(null), { tab: "overview" });
    assert.deepEqual(parseAltaCardWorkspaceSearch({}), { tab: "overview" });
  });

  it("preserves optional recommendation fields when present", () => {
    const parsed = parseAltaCardWorkspaceSearch({
      tab: "overview",
      suggestedTier: "GOLD",
      suggestedLimit: "5000",
      suggestedRate: "0.12",
      recommendationId: "rec_lab_1",
    });
    assert.equal(parsed.tab, "overview");
    assert.equal(parsed.suggestedTier, "GOLD");
    assert.equal(parsed.suggestedLimit, 5000);
    assert.equal(parsed.suggestedRate, 0.12);
    assert.equal(parsed.recommendationId, "rec_lab_1");
  });

  it("normalizes legacy tabs and omits empty optional recommendation keys", () => {
    const parsed = parseAltaCardWorkspaceSearch({
      tab: "payments",
      suggestedTier: "",
      recommendationId: "",
      suggestedLimit: "",
    });
    assert.equal(parsed.tab, "activity");
    assert.equal(parsed.filter, "payments");
    assert.equal(parsed.suggestedTier, undefined);
    assert.equal(parsed.recommendationId, undefined);
    assert.equal(parsed.suggestedLimit, undefined);
  });

  it("keeps default Alta Card workspace search free of undefined keys", () => {
    assert.deepEqual(INTERNAL_ALTA_CARD_WORKSPACE_SEARCH, { tab: "overview" });
    assert.equal("recommendationId" in INTERNAL_ALTA_CARD_WORKSPACE_SEARCH, false);
  });

  it("merges localhost site into internal link search helpers", () => {
    assert.deepEqual(withInternalSiteSearch(INTERNAL_ALTA_CARD_WORKSPACE_SEARCH, "bank"), {
      tab: "overview",
      site: "bank",
    });
    assert.deepEqual(withInternalSiteSearch(INTERNAL_ALTA_CARD_WORKSPACE_SEARCH, undefined), {
      tab: "overview",
    });
  });
});
