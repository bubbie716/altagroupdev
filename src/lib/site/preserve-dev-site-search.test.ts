import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  preserveDevSiteSearch,
  readDevSiteFromSearch,
  siteSearchPatch,
  validateDevSiteSearch,
} from "@/lib/site/preserve-dev-site-search";

describe("preserve-dev-site-search", () => {
  it("reads site from search objects", () => {
    assert.equal(readDevSiteFromSearch(undefined), undefined);
    assert.equal(readDevSiteFromSearch({ site: "  " }), undefined);
    assert.equal(readDevSiteFromSearch({ site: "bank" }), "bank");
  });

  it("preserves site across search updates", () => {
    assert.deepEqual(preserveDevSiteSearch({ site: "bank" }, { tab: "overview" }), {
      site: "bank",
      tab: "overview",
    });
    assert.deepEqual(preserveDevSiteSearch({ site: "bank" }, { tab: "activity" }, "terminal"), {
      site: "terminal",
      tab: "activity",
    });
    assert.deepEqual(preserveDevSiteSearch(null, { tab: "overview" }), { tab: "overview" });
  });

  it("normalizes insertion order so tab/site and site/tab serialize identically", () => {
    const a = preserveDevSiteSearch(null, { tab: "overview", site: "bank" });
    const b = preserveDevSiteSearch(null, { site: "bank", tab: "overview" });
    assert.deepEqual(Object.keys(a), ["site", "tab"]);
    assert.deepEqual(a, b);
  });

  it("normalizes redirect search patches", () => {
    assert.deepEqual(siteSearchPatch(" bank "), { site: "bank" });
    assert.deepEqual(siteSearchPatch(undefined), {});
    assert.deepEqual(siteSearchPatch(""), {});
  });

  it("validates dev site search for legacy redirects", () => {
    assert.deepEqual(validateDevSiteSearch({}), {});
    assert.deepEqual(validateDevSiteSearch({ site: "bank" }), { site: "bank" });
  });
});
