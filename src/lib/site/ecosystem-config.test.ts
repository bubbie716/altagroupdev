import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ECOSYSTEM_ENTRIES,
  getCurrentEcosystemEntry,
  getEcosystemSwitcherLinks,
} from "@/lib/site/ecosystem-config";
import { resolveEntitySiteUrl } from "@/lib/site/entity-site-url";

describe("ecosystem config", () => {
  it("lists Alta ecosystem properties in a stable order", () => {
    assert.deepEqual(
      ECOSYSTEM_ENTRIES.map((entry) => entry.key),
      ["corporate", "bank", "exchange", "terminal"],
    );
  });

  it("marks exactly one current site per listed property", () => {
    for (const siteKey of ["corporate", "bank", "exchange", "terminal"] as const) {
      const links = getEcosystemSwitcherLinks(siteKey);
      assert.equal(links.length, 4);
      assert.equal(links.filter((link) => link.current).length, 1);
      assert.equal(links.find((link) => link.current)?.key, siteKey);
    }
  });

  it("does not include NCC in the ecosystem switcher", () => {
    const links = getEcosystemSwitcherLinks("bank");
    assert.equal(
      links.some((link) => link.key === "ncc"),
      false,
    );
  });

  it("resolves absolute hrefs for cross-site navigation", () => {
    const links = getEcosystemSwitcherLinks("bank");
    for (const link of links) {
      assert.ok(link.href.startsWith("http"));
    }
  });

  it("resolves production domains from a production request host", () => {
    const requestHost = "bank.altagroup.dev";
    assert.ok(resolveEntitySiteUrl("corporate", "/home", requestHost).includes("altagroup.dev"));
    assert.ok(
      resolveEntitySiteUrl("exchange", "/", requestHost).includes("exchange.altagroup.dev"),
    );
    assert.ok(
      resolveEntitySiteUrl("ncc", "/", requestHost).includes("newportclearingcorporation.com"),
    );
  });

  it("exposes display metadata for the header trigger", () => {
    assert.equal(getCurrentEcosystemEntry("bank").name, "Alta Bank");
    assert.equal(getCurrentEcosystemEntry("exchange").name, "Alta Exchange");
  });
});
