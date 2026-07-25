import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ECOSYSTEM_ENTRIES,
  getCurrentEcosystemEntry,
  getEcosystemSwitcherLinks,
} from "@/lib/site/ecosystem-config";
import { resolveEntitySiteUrl } from "@/lib/site/entity-site-url";

describe("ecosystem config", () => {
  it("lists Alta Group, Alta Bank, and Alta Terminal only", () => {
    assert.deepEqual(
      ECOSYSTEM_ENTRIES.map((entry) => entry.key),
      ["corporate", "bank", "terminal"],
    );
  });

  it("marks exactly one current site per listed property", () => {
    for (const siteKey of ["corporate", "bank", "terminal"] as const) {
      const links = getEcosystemSwitcherLinks(siteKey);
      assert.equal(links.length, 3);
      assert.equal(links.filter((link) => link.current).length, 1);
      assert.equal(links.find((link) => link.current)?.key, siteKey);
    }
  });

  it("does not include Exchange in the ecosystem switcher", () => {
    const links = getEcosystemSwitcherLinks("bank");
    assert.equal(
      links.some((link) => link.key === "exchange"),
      false,
    );
  });

  it("resolves absolute hrefs for cross-site navigation", () => {
    const links = getEcosystemSwitcherLinks("bank", "localhost:3000");
    for (const link of links) {
      assert.ok(link.href.startsWith("http"));
      assert.ok(link.href.includes("localhost:3000"));
    }
  });

  it("resolves production domains from a production request host", () => {
    const requestHost = "bank.altagroup.dev";
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      assert.ok(resolveEntitySiteUrl("corporate", "/home", requestHost).includes("altagroup.dev"));
      assert.ok(
        resolveEntitySiteUrl("terminal", "/", requestHost).includes("terminal.altagroup.dev"),
      );
      const links = getEcosystemSwitcherLinks("bank", requestHost);
      assert.ok(links.every((link) => link.href.startsWith("https://") || link.current));
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it("exposes display metadata for the header trigger", () => {
    assert.equal(getCurrentEcosystemEntry("bank").name, "Alta Bank");
    assert.equal(getCurrentEcosystemEntry("terminal").name, "Alta Terminal");
  });
});
