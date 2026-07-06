export type FooterVariant = "public" | "platform" | "minimal-auth" | "none";

export type PlatformFooterContext = "bank" | "exchange" | "general";

export type LegalFooterContext = "login" | "maintenance" | "access-restricted";

export function resolveFooterVariant(pathname: string): FooterVariant {
  if (pathname.startsWith("/internal")) return "none";
  if (
    pathname === "/login" ||
    pathname === "/maintenance" ||
    pathname === "/access-restricted"
  ) {
    return "minimal-auth";
  }
  if (pathname.startsWith("/pay/")) return "none";
  if (
    pathname === "/" ||
    pathname.startsWith("/governance") ||
    pathname.startsWith("/company") ||
    pathname.startsWith("/support") ||
    pathname.startsWith("/docs") ||
    pathname.startsWith("/status") ||
    pathname.startsWith("/contact") ||
    pathname === "/discord" ||
    pathname.startsWith("/discord/")
  ) {
    return "public";
  }
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
