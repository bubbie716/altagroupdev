import assert from "node:assert/strict";
import { describe, it } from "node:test";
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
import { hasLegalDocBody } from "@/lib/governance/legal-docs-catalog";
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
  it("resolves every registered footer document to a catalog entry", async () => {
    const docs = footerDocuments({ globalOnly: true });
    for (const doc of docs) {
      assert.ok(await hasLegalDocBody(doc.id), `missing catalog body for ${doc.id}`);
      assert.ok(getLegalDocument(doc.id), `missing registry entry for ${doc.id}`);
    }
  });

  it("builds router params that load the document", async () => {
    for (const doc of groupFooterDocuments()) {
      const link = legalDocLinkParams(doc.id);
      assert.equal(link.to, "/legal/$docId");
      assert.ok(await hasLegalDocBody(link.params.docId));
    }

    for (const entity of ["bank", "markets", "ncc"] as const) {
      for (const doc of entityFooterDocuments(entity)) {
        const link = legalDocLinkParams(doc.id);
        assert.ok(await hasLegalDocBody(link.params.docId));
      }
    }
  });

  it("resolves pretty legal slugs used in paths", async () => {
    for (const doc of footerDocuments()) {
      const resolved = resolveLegalDocIdFromSlug(doc.slug);
      assert.equal(resolved, doc.id);
      assert.ok(await hasLegalDocBody(resolved!));
    }
  });

  it("exposes valid NCC footer legal paths", async () => {
    for (const doc of NCC_LEGAL_DOCS) {
      assert.ok(doc.path.startsWith("/legal/"));
      const segment = doc.path.replace(/^\/legal\//, "");
      const id = resolveLegalDocIdFromSlug(segment) ?? segment;
      assert.ok(await hasLegalDocBody(id));
    }
  });

  it("lists ecosystem destinations with one current site", () => {
    for (const siteKey of ["corporate", "bank", "exchange", "terminal"] as const) {
      const links = getFooterEcosystemLinks(siteKey);
      assert.equal(links.length, 3);
      assert.equal(
        links.some((link) => link.label === "Alta Exchange"),
        false,
      );
      // Legacy exchange host has no matching ecosystem entry marked current.
      const expectedCurrent = siteKey === "exchange" ? 0 : 1;
      assert.equal(links.filter((link) => link.current).length, expectedCurrent);
      assert.equal(
        links.some((link) => link.label === "Newport Clearing Corporation"),
        false,
      );

      for (const link of links) {
        if ("external" in link && link.external) {
          assert.ok(link.href.startsWith("http"));
        } else {
          assert.ok(link.to.startsWith("/"));
        }
      }
    }

    assert.deepEqual(getFooterCompanyLinks(), getFooterEcosystemLinks("corporate"));
  });

  it("lists support destinations for every site", () => {
    for (const siteKey of ["corporate", "bank", "exchange", "terminal", "ncc"] as const) {
      const links = getFooterSupportLinks(siteKey);
      assert.deepEqual(links.map((link) => link.label), ["Support Center", "System Status"]);

      const status = links.find((link) => link.label === "System Status");
      assert.ok(status && "href" in status && status.href.startsWith("https://status."));
    }

    assert.equal(FOOTER_SUPPORT_LINKS[0]?.to, "/support");
  });

  it("builds entity-specific copyright lines", () => {
    const bank = getFooterCopyrightLines("bank");
    assert.ok(bank.copyright.includes("Alta Bank N.V."));
    assert.ok(bank.disclaimer.includes("Alta Bank services are designed"));
    assert.ok(bank.disclaimer.includes("District Roleplay"));
  });

  it("maps entity footer sections to the spec documents", () => {
    assert.deepEqual(
      siteEntitySectionDocuments("bank").map((doc) => doc.label),
      [
        "Deposit Agreement",
        "Business Banking Agreement",
        "Alta Card Agreement",
        "Lending Agreement",
        "Alta Pay Terms",
        "Fee Schedule",
      ],
    );
    assert.deepEqual(
      siteEntitySectionDocuments("exchange").map((doc) => doc.label),
      ["Customer Agreement"],
    );
    assert.deepEqual(
      siteEntitySectionDocuments("terminal").map((doc) => doc.label),
      ["Customer Agreement"],
    );
    assert.deepEqual(
      siteEntitySectionDocuments("ncc").map((doc) => doc.label),
      ["Participation Agreement", "Operating Rules", "Fee Schedule"],
    );
  });

  it("keeps global legal column to terms and privacy", () => {
    assert.deepEqual(groupEssentialLegalDocuments().map((doc) => doc.label), ["Terms", "Privacy"]);
  });

  it("exposes corporate section links and site emphasis copy", () => {
    assert.deepEqual(FOOTER_CORPORATE_SECTION_LINKS.map((link) => link.label), [
      "Leadership",
      "About",
      "Companies",
      "Governance",
    ]);
    assert.equal(SITE_FOOTER_EMPHASIS.bank, "Retail + Commercial Banking");
    assert.equal(SITE_FOOTER_EMPHASIS.exchange, "Brokerage");
    assert.equal(SITE_FOOTER_EMPHASIS.terminal, "Brokerage");
  });
});
