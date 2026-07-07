import { describe, expect, it } from "vitest";
import {
  entityFooterDocuments,
  footerDocuments,
  getLegalDocument,
  groupFooterDocuments,
  legalDocLinkParams,
  resolveLegalDocIdFromSlug,
} from "@/lib/legal/legal-document-registry";
import { getLegalDoc } from "@/lib/governance/legal-docs-catalog";
import { getFooterCompanyLinks, FOOTER_SUPPORT_LINKS } from "@/lib/site/site-links";
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

  it("lists internal company and support footer destinations", () => {
    for (const link of getFooterCompanyLinks()) {
      if ("external" in link && link.external) {
        expect(link.href.startsWith("http")).toBe(true);
      } else {
        expect(link.to.startsWith("/")).toBe(true);
      }
    }

    for (const link of FOOTER_SUPPORT_LINKS) {
      expect(link.to).toBe("/support");
    }
  });
});
