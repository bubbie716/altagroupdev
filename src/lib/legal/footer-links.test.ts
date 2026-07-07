import { describe, expect, it } from "vitest";
import {
  entityFooterDocuments,
  footerDocuments,
  getLegalDocument,
  groupEssentialLegalDocuments,
  groupFooterDocuments,
  legalDocLinkParams,
  resolveLegalDocIdFromSlug,
  siteEntitySectionDocuments,
} from "@/lib/legal/legal-document-registry";
import { getLegalDoc } from "@/lib/governance/legal-docs-catalog";
import {
  FOOTER_CORPORATE_SECTION_LINKS,
  FOOTER_SUPPORT_LINKS,
  getFooterCompanyLinks,
  getFooterCopyrightLines,
  getFooterEcosystemLinks,
  getFooterSupportLinks,
  SITE_FOOTER_EMPHASIS,
} from "@/lib/site/site-links";
import { NCC_LEGAL_DOCS } from "@/lib/ncc/ncc-tokens";

describe("footer links", () => {
  it("resolves every registered footer document to a catalog entry", () => {
    const docs = footerDocuments({ globalOnly: true });
    for (const doc of docs) {
      expect(getLegalDoc(doc.id), `missing catalog body for ${doc.id}`).not.toBeNull();
      expect(getLegalDocument(doc.id), `missing registry entry for ${doc.id}`).toBeDefined();
    }
  });

  it("builds router params that load the document", () => {
    for (const doc of groupFooterDocuments()) {
      const link = legalDocLinkParams(doc.id);
      expect(link.to).toBe("/legal/$docId");
      expect(getLegalDoc(link.params.docId)).not.toBeNull();
    }

    for (const entity of ["bank", "markets", "ncc"] as const) {
      for (const doc of entityFooterDocuments(entity)) {
        const link = legalDocLinkParams(doc.id);
        expect(getLegalDoc(link.params.docId)).not.toBeNull();
      }
    }
  });

  it("resolves pretty legal slugs used in paths", () => {
    for (const doc of footerDocuments()) {
      const resolved = resolveLegalDocIdFromSlug(doc.slug);
      expect(resolved).toBe(doc.id);
      expect(getLegalDoc(resolved!)).not.toBeNull();
    }
  });

  it("exposes valid NCC footer legal paths", () => {
    for (const doc of NCC_LEGAL_DOCS) {
      expect(doc.path.startsWith("/legal/")).toBe(true);
      const segment = doc.path.replace(/^\/legal\//, "");
      const id = resolveLegalDocIdFromSlug(segment) ?? segment;
      expect(getLegalDoc(id)).not.toBeNull();
    }
  });

  it("lists ecosystem destinations with one current site", () => {
    for (const siteKey of ["corporate", "bank", "exchange", "terminal"] as const) {
      const links = getFooterEcosystemLinks(siteKey);
      expect(links).toHaveLength(4);
      expect(links.filter((link) => link.current)).toHaveLength(1);
      expect(links.some((link) => link.label === "Newport Clearing Corporation")).toBe(false);

      for (const link of links) {
        if ("external" in link && link.external) {
          expect(link.href.startsWith("http")).toBe(true);
        } else {
          expect(link.to.startsWith("/")).toBe(true);
        }
      }
    }

    expect(getFooterCompanyLinks()).toEqual(getFooterEcosystemLinks("corporate"));
  });

  it("lists support destinations for every site", () => {
    for (const siteKey of ["corporate", "bank", "exchange", "terminal", "ncc"] as const) {
      const links = getFooterSupportLinks(siteKey);
      expect(links.map((link) => link.label)).toEqual(["Support Center", "System Status"]);

      const status = links.find((link) => link.label === "System Status");
      expect(status && "href" in status && status.href.startsWith("https://status.")).toBe(true);
    }

    expect(FOOTER_SUPPORT_LINKS[0]?.to).toBe("/support");
  });

  it("builds entity-specific copyright lines", () => {
    const bank = getFooterCopyrightLines("bank");
    expect(bank.copyright).toContain("Alta Bank N.V.");
    expect(bank.disclaimer).toContain("Alta Bank services are designed");
    expect(bank.disclaimer).toContain("District Roleplay");
  });

  it("maps entity footer sections to the spec documents", () => {
    expect(siteEntitySectionDocuments("bank").map((doc) => doc.label)).toEqual([
      "Deposit Agreement",
      "Business Banking",
      "Alta Card",
      "Alta Pay",
      "Fee Schedule",
    ]);
    expect(siteEntitySectionDocuments("exchange").map((doc) => doc.label)).toEqual([
      "Listing Agreement",
      "Trading Rules",
      "Market Data & API Terms",
      "Fee Schedule",
    ]);
    expect(siteEntitySectionDocuments("terminal").map((doc) => doc.label)).toEqual([
      "Customer Agreement",
      "Trading Rules",
      "Market Data & API Terms",
      "Fee Schedule",
    ]);
    expect(siteEntitySectionDocuments("ncc").map((doc) => doc.label)).toEqual([
      "Participation Agreement",
      "Operating Rules",
      "Fee Schedule",
    ]);
  });

  it("keeps global legal column to terms and privacy", () => {
    expect(groupEssentialLegalDocuments().map((doc) => doc.label)).toEqual(["Terms", "Privacy"]);
  });

  it("exposes corporate section links and site emphasis copy", () => {
    expect(FOOTER_CORPORATE_SECTION_LINKS.map((link) => link.label)).toEqual([
      "Leadership",
      "About",
      "Companies",
      "Governance",
    ]);
    expect(SITE_FOOTER_EMPHASIS.bank).toBe("Retail + Commercial Banking");
    expect(SITE_FOOTER_EMPHASIS.exchange).toBe("Capital Markets");
  });
});
