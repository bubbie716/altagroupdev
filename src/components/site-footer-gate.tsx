"use client";

import { useRouterState } from "@tanstack/react-router";
import { SiteFooter } from "@/components/footers";
import { useFooterContext } from "@/lib/platform/footer-context";
import {
  extractLegalDocIdFromPath,
  resolveFooterVariant,
} from "@/lib/platform/footer-variant";
import { getLegalDocument } from "@/lib/legal/legal-document-registry";
import { useSiteContext } from "@/hooks/use-site-context";

function resolveLegalDocFooter(pathname: string) {
  const docId = extractLegalDocIdFromPath(pathname);
  if (!docId) return undefined;

  const registry = getLegalDocument(docId);
  if (!registry) return undefined;

  return {
    docId,
    title: registry.title,
    version: registry.version ?? "1.0",
    lastUpdated: registry.lastUpdated ?? "March 2026",
  };
}

/**
 * Single site-wide footer mount point. Do not render footer components elsewhere.
 */
export function SiteFooterGate() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { suppressSiteFooter, variantOverride } = useFooterContext();

  const site = useSiteContext();

  if (suppressSiteFooter) return null;

  const variant = variantOverride ?? resolveFooterVariant(pathname);
  if (variant === "none") return null;

  const legalDoc = variant === "legal" ? resolveLegalDocFooter(pathname) : undefined;

  // Customer app chrome uses a fixed mobile bottom nav — hide the dashboard footer on small screens.
  const customerAppChrome =
    pathname === "/bank" ||
    (pathname.startsWith("/bank/") && !pathname.includes("/thread")) ||
    pathname === "/terminal" ||
    pathname.startsWith("/terminal/");

  return (
    <div className={customerAppChrome ? "hidden md:block" : undefined}>
      <SiteFooter variant={variant} legalDoc={legalDoc} siteKey={site.key} />
    </div>
  );
}
