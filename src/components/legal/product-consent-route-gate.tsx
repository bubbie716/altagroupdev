"use client";

import { useMemo, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { ProductConsentBoundary } from "@/components/legal/product-consent-boundary";
import {
  isProductConsentExemptPath,
  resolveProductConsentRequirements,
} from "@/lib/legal/product-consent-requirements";
import type { SiteKey } from "@/config/sites";
import { isUiLabMode } from "@/lib/auth/ui-lab";
import type { AccountCommercialLayoutData } from "@/lib/bank/account-commercial-loader.functions";

function useAuthoritativeCommercialCompany(): {
  companyId: string | null;
  companyName: string | null;
} {
  const matches = useRouterState({ select: (s) => s.matches });
  return useMemo(() => {
    for (const match of [...matches].reverse()) {
      const layout = (match.context as { commercialLayout?: AccountCommercialLayoutData } | undefined)
        ?.commercialLayout;
      if (layout?.context?.companyId) {
        return {
          companyId: layout.context.companyId,
          companyName: layout.context.companyName ?? null,
        };
      }
      const accountContext = layout?.accountContext as
        | { companyId?: string; companyName?: string }
        | null
        | undefined;
      if (accountContext?.companyId) {
        return {
          companyId: accountContext.companyId,
          companyName: accountContext.companyName ?? null,
        };
      }
    }
    return { companyId: null, companyName: null };
  }, [matches]);
}

/**
 * Route-aware progressive consent gate for authenticated Bank / Terminal shells.
 * Company subject comes from authoritative commercial layout context — never bare query IDs in production.
 */
export function ProductConsentRouteGate({
  sourceSite,
  theme,
  companyId: companyIdProp,
  companyName: companyNameProp,
  children,
}: {
  sourceSite: SiteKey;
  theme: "bank" | "terminal";
  companyId?: string | null;
  companyName?: string | null;
  children: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const search = useRouterState({
    select: (s) => s.location.search as Record<string, unknown>,
  });
  const searchCompanyId = typeof search.companyId === "string" ? search.companyId : null;
  const authoritative = useAuthoritativeCommercialCompany();

  // Production: prop → commercial layout context only.
  // UI Lab: allow query-string override for scenario demos (still verified server-side on accept).
  const companyId =
    companyIdProp ??
    authoritative.companyId ??
    (isUiLabMode() ? searchCompanyId : null);
  const companyName = companyNameProp ?? authoritative.companyName;

  const requirement = useMemo(() => {
    if (isProductConsentExemptPath(pathname)) return null;
    const base = resolveProductConsentRequirements(pathname);
    if (!base) return null;

    // Legacy apply/activate deep links redirect to search params on soft list routes.
    // Those workflows create new exposure and must remain hard-gated.
    const applyFlag = search.apply === "1" || search.apply === 1;
    const activateFlag = search.activate === "1" || search.activate === 1;
    if (
      base.softForExistingObligations &&
      pathname.startsWith("/bank/alta-card") &&
      (applyFlag || activateFlag)
    ) {
      return { ...base, softForExistingObligations: false };
    }
    if (
      base.softForExistingObligations &&
      pathname.startsWith("/bank/lending") &&
      (applyFlag || search.new === "1" || search.new === 1)
    ) {
      return { ...base, softForExistingObligations: false };
    }
    return base;
  }, [pathname, search.apply, search.activate, search.new]);

  if (!requirement || requirement.scopes.length === 0) {
    return <>{children}</>;
  }

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
