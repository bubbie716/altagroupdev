import { describe, expect, it } from "vitest";
import {
  ECOSYSTEM_ENTRIES,
  getCurrentEcosystemEntry,
  getEcosystemSwitcherLinks,
} from "@/lib/site/ecosystem-config";
import { resolveEntitySiteUrl } from "@/lib/site/entity-site-url";

describe("ecosystem config", () => {
  it("lists all Alta properties in a stable order", () => {
    expect(ECOSYSTEM_ENTRIES.map((entry) => entry.key)).toEqual([
      "corporate",
      "bank",
      "exchange",
      "terminal",
      "ncc",
    ]);
  });

  it("marks exactly one current site per property", () => {
    for (const siteKey of ["corporate", "bank", "exchange", "terminal", "ncc"] as const) {
      const links = getEcosystemSwitcherLinks(siteKey);
      expect(links).toHaveLength(5);
      expect(links.filter((link) => link.current)).toHaveLength(1);
      expect(links.find((link) => link.current)?.key).toBe(siteKey);
    }
  });

  it("resolves absolute hrefs for cross-site navigation", () => {
    const links = getEcosystemSwitcherLinks("bank");
    for (const link of links) {
      expect(link.href.startsWith("http")).toBe(true);
    }
  });

  it("resolves production domains from a production request host", () => {
    const requestHost = "bank.altagroup.dev";
    expect(resolveEntitySiteUrl("corporate", "/home", requestHost)).toContain("altagroup.dev");
    expect(resolveEntitySiteUrl("exchange", "/", requestHost)).toContain("exchange.altagroup.dev");
    expect(resolveEntitySiteUrl("ncc", "/", requestHost)).toContain("newportclearingcorporation.com");
  });

  it("exposes display metadata for the header trigger", () => {
    expect(getCurrentEcosystemEntry("bank").name).toBe("Alta Bank");
    expect(getCurrentEcosystemEntry("ncc").shortName).toBe("NCC");
    expect(getCurrentEcosystemEntry("ncc").name).toBe("Newport Clearing Corporation");
  });
});
