export type FooterVariant = "marketing" | "dashboard" | "auth" | "legal" | "none";

/** @deprecated Use FooterVariant */
export type PlatformFooterContext = "bank" | "exchange" | "general";

/** @deprecated Auth footers no longer use per-page context copy. */
export type LegalFooterContext = "login" | "maintenance" | "access-restricted";

const AUTH_PATHS = new Set(["/login", "/maintenance", "/access-restricted"]);

const MARKETING_PREFIXES = [
  "/company",
  "/support",
  "/docs",
  "/contact",
  "/discord",
] as const;

function isStatementPrintPath(pathname: string): boolean {
  return /\/statements\/[^/]+$/.test(pathname);
}

function isLegalDocumentPath(pathname: string): boolean {
  return /^\/governance\/legaldocs\/[^/]+$/.test(pathname);
}

export function extractLegalDocIdFromPath(pathname: string): string | undefined {
  const match = pathname.match(/^\/governance\/legaldocs\/([^/]+)$/);
  return match?.[1];
}

export function resolveFooterVariant(pathname: string): FooterVariant {
  if (pathname.startsWith("/internal")) return "none";
  if (pathname.startsWith("/pay/")) return "none";
  if (isStatementPrintPath(pathname)) return "none";

  if (AUTH_PATHS.has(pathname)) return "auth";
  if (isLegalDocumentPath(pathname)) return "legal";

  if (
    pathname === "/" ||
    pathname.startsWith("/governance") ||
    MARKETING_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  ) {
    return "marketing";
  }

  if (
    pathname.startsWith("/bank") ||
    pathname.startsWith("/exchange") ||
    pathname.startsWith("/terminal") ||
    pathname.startsWith("/companies") ||
    pathname === "/profile"
  ) {
    return "dashboard";
  }

  return "marketing";
}

/** @deprecated Footer variant is resolved globally; context is no longer used. */
export function resolvePlatformFooterContext(pathname: string): PlatformFooterContext {
  if (pathname.startsWith("/bank")) return "bank";
  if (pathname.startsWith("/exchange") || pathname.startsWith("/terminal")) return "exchange";
  return "general";
}

/** @deprecated Auth footers no longer use per-page context copy. */
export function resolveLegalFooterContext(pathname: string): LegalFooterContext {
  if (pathname === "/maintenance") return "maintenance";
  if (pathname === "/access-restricted") return "access-restricted";
  return "login";
}
