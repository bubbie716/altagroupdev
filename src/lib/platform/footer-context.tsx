"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { FooterVariant } from "@/lib/platform/footer-variant";

type FooterContextValue = {
  /** When true, the root SiteFooterGate will not render (e.g. custom full-page shells). */
  suppressSiteFooter: boolean;
  /** Optional override for the resolved route variant. */
  variantOverride?: FooterVariant | null;
};

const FooterContext = createContext<FooterContextValue>({
  suppressSiteFooter: false,
  variantOverride: undefined,
});

export function FooterProvider({
  suppressSiteFooter = false,
  variantOverride,
  children,
}: {
  suppressSiteFooter?: boolean;
  variantOverride?: FooterVariant | null;
  children: ReactNode;
}) {
  return (
    <FooterContext.Provider value={{ suppressSiteFooter, variantOverride }}>
      {children}
    </FooterContext.Provider>
  );
}

export function useFooterContext() {
  return useContext(FooterContext);
}
