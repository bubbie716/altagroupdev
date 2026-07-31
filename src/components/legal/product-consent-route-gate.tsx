"use client";

import { useMemo, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { ProductConsentBoundary } from "@/components/legal/product-consent-boundary";
import {
  isProductConsentExemptPath,
  resolveProductConsentRequirements,
} from "@/lib/legal/product-consent-requirements";
import type { SiteKey } from "@/config/sites";

/**
 * Route-aware progressive consent gate for authenticated Bank / Terminal shells.
 */
export function ProductConsentRouteGate({
  sourceSite,
  theme,
  companyId: companyIdProp,
  companyName,
  children,
}: {
  sourceSite: SiteKey;
  theme: "bank" | "terminal";
  companyId?: string | null;
  companyName?: string | null;
  children: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const searchCompanyId = useRouterState({
    select: (s) => {
      const search = s.location.search as Record<string, unknown>;
      return typeof search.companyId === "string" ? search.companyId : null;
    },
  });

  const companyId = companyIdProp ?? searchCompanyId;

  const requirement = useMemo(() => {
    if (isProductConsentExemptPath(pathname)) return null;
    return resolveProductConsentRequirements(pathname);
  }, [pathname]);

  if (!requirement || requirement.scopes.length === 0) {
    return <>{children}</>;
  }

  // Soft for existing obligation views (card/loan detail) — mutations still enforce.
  const soft = Boolean(requirement.softForExistingObligations);

  // Commercial without a selected company: require BANK only at the shell;
  // company-scoped COMMERCIAL consent is enforced when companyId is present / on mutations.
  const scopes =
    requirement.companyScoped && !companyId
      ? requirement.scopes.filter((scope) => scope !== "COMMERCIAL")
      : requirement.scopes;

  if (scopes.length === 0) {
    return <>{children}</>;
  }

  return (
    <ProductConsentBoundary
      scopes={[...scopes]}
      sourceSite={sourceSite}
      companyId={requirement.companyScoped ? companyId : undefined}
      companyName={requirement.companyScoped ? companyName : undefined}
      soft={soft}
      theme={theme}
      safeExitHref="/home"
      safeExitLabel="Back to Alta"
    >
      {children}
    </ProductConsentBoundary>
  );
}
