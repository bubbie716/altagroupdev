export type FooterVariant = "public" | "platform" | "legal" | "none";

export type PlatformFooterContext = "bank" | "exchange" | "general";

export type LegalFooterContext = "login" | "maintenance" | "access-restricted";

export function resolveFooterVariant(pathname: string): FooterVariant {
  if (pathname.startsWith("/internal")) return "none";
  if (
    pathname === "/login" ||
    pathname === "/maintenance" ||
    pathname === "/access-restricted"
  ) {
    return "legal";
  }
  if (pathname === "/" || pathname.startsWith("/governance")) return "public";
  if (
    pathname.startsWith("/bank") ||
    pathname.startsWith("/exchange") ||
    pathname.startsWith("/terminal") ||
    pathname.startsWith("/companies") ||
    pathname === "/profile"
  ) {
    return "platform";
  }
  return "public";
}

export function resolvePlatformFooterContext(pathname: string): PlatformFooterContext {
  if (pathname.startsWith("/bank")) return "bank";
  if (pathname.startsWith("/exchange") || pathname.startsWith("/terminal")) return "exchange";
  return "general";
}

export function resolveLegalFooterContext(pathname: string): LegalFooterContext {
  if (pathname === "/maintenance") return "maintenance";
  if (pathname === "/access-restricted") return "access-restricted";
  return "login";
}
