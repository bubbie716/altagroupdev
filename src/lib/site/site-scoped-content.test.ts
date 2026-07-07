import { describe, expect, it } from "vitest";
import {
  getDiscordCommunitiesForSite,
  getLegalDocCategoriesForSite,
  getLegalDocsForSite,
} from "@/lib/site/site-scoped-content";

describe("site-scoped-content", () => {
  it("shows only Alta Group legal docs on corporate site", () => {
    const docs = getLegalDocsForSite("corporate");
    expect(docs.every((doc) => doc.id.startsWith("AG-"))).toBe(true);
    expect(docs.some((doc) => doc.id.startsWith("AB-"))).toBe(false);
  });

  it("shows Alta Group and bank docs on bank site", () => {
    const docs = getLegalDocsForSite("bank");
    expect(docs.some((doc) => doc.id.startsWith("AG-"))).toBe(true);
    expect(docs.some((doc) => doc.id.startsWith("AB-"))).toBe(true);
    expect(docs.some((doc) => doc.id.startsWith("AE-"))).toBe(false);
  });

  it("shows Alta Group and markets docs on exchange and terminal sites", () => {
    for (const siteKey of ["exchange", "terminal"] as const) {
      const docs = getLegalDocsForSite(siteKey);
      expect(docs.some((doc) => doc.id.startsWith("AG-"))).toBe(true);
      expect(docs.some((doc) => doc.id.startsWith("AE-"))).toBe(true);
      expect(docs.some((doc) => doc.id.startsWith("AB-"))).toBe(false);
    }
  });

  it("shows Alta Group and NCC docs on ncc site", () => {
    const categories = getLegalDocCategoriesForSite("ncc");
    expect(categories.some((category) => category.startsWith("Alta Group"))).toBe(true);
    expect(categories.some((category) => category.startsWith("NCC"))).toBe(true);
    expect(categories.some((category) => category.startsWith("Alta Bank"))).toBe(false);
  });

  it("shows Alta Group discord only on corporate support", () => {
    const communities = getDiscordCommunitiesForSite("corporate");
    expect(communities.map((c) => c.entity)).toEqual(["group"]);
  });

  it("shows Alta Group and sub discord on entity sites", () => {
    expect(getDiscordCommunitiesForSite("bank").map((c) => c.entity)).toEqual(["group", "bank"]);
    expect(getDiscordCommunitiesForSite("exchange").map((c) => c.entity)).toEqual(["group", "markets"]);
    expect(getDiscordCommunitiesForSite("terminal").map((c) => c.entity)).toEqual(["group", "markets"]);
    expect(getDiscordCommunitiesForSite("ncc").map((c) => c.entity)).toEqual(["group", "ncc"]);
  });
});
