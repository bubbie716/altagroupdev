"use client";

import { useRouterState } from "@tanstack/react-router";
import { SiteFooter } from "@/components/footers";
import { useFooterContext } from "@/lib/platform/footer-context";
import {
  extractLegalDocIdFromPath,
  resolveFooterVariant,
} from "@/lib/platform/footer-variant";
import { getLegalDocument } from "@/lib/legal/legal-document-registry";
import { getLegalDoc } from "@/lib/governance/legal-docs-catalog";

function resolveLegalDocFooter(pathname: string) {
  const docId = extractLegalDocIdFromPath(pathname);
  if (!docId) return undefined;

  const registry = getLegalDocument(docId);
  const catalog = getLegalDoc(docId);
  if (!registry && !catalog) return undefined;

  return {
    docId,
    title: catalog?.meta.title ?? registry?.title ?? docId,
    version: registry?.version ?? "1.0",
    lastUpdated: registry?.lastUpdated ?? "March 2026",
  };
}

/**
 * Single site-wide footer mount point. Do not render footer components elsewhere.
 */
export function SiteFooterGate() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { suppressSiteFooter, variantOverride } = useFooterContext();

  if (suppressSiteFooter) return null;

  const variant = variantOverride ?? resolveFooterVariant(pathname);
  if (variant === "none") return null;

  const legalDoc = variant === "legal" ? resolveLegalDocFooter(pathname) : undefined;

  return <SiteFooter variant={variant} legalDoc={legalDoc} />;
}
