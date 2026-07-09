import type { SiteKey } from "@/config/sites";

/**
 * Path prefixes owned by a single Alta site. Longer prefixes are listed first so
 * `/company/ncc` wins over `/company`.
 */
const SITE_PATH_ROUTES: ReadonlyArray<{ prefix: string; siteKey: SiteKey }> = [
  { prefix: "/company/ncc", siteKey: "ncc" },
  { prefix: "/institutions", siteKey: "ncc" },
  { prefix: "/network", siteKey: "ncc" },
  { prefix: "/participation", siteKey: "ncc" },
  { prefix: "/bank", siteKey: "bank" },
  { prefix: "/exchange", siteKey: "exchange" },
  { prefix: "/terminal", siteKey: "terminal" },
  { prefix: "/governance", siteKey: "corporate" },
  { prefix: "/structure", siteKey: "corporate" },
  { prefix: "/leadership", siteKey: "corporate" },
  { prefix: "/home", siteKey: "corporate" },
  { prefix: "/company", siteKey: "corporate" },
  { prefix: "/contact", siteKey: "corporate" },
  { prefix: "/docs", siteKey: "corporate" },
];

/** Paths available on every site (content may vary by site context). */
const SHARED_PATH_PREFIXES = [
  "/legal",
  "/support",
  "/maintenance",
  "/access-restricted",
  "/pay",
  "/discord",
  "/status",
  "/profile",
  "/companies",
  "/internal",
  "/dashboard",
  "/login",
  "/admin",
  "/markets",
] as const;

function normalizePathname(pathname: string): string {
  const trimmed = pathname.replace(/\/$/, "");
  return trimmed || "/";
}

function isSharedPath(pathname: string): boolean {
  const path = normalizePathname(pathname);
  if (path === "/") return true;
  return SHARED_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

/** Which Alta site owns this path, or null when shared across sites. */
export function siteKeyForOwnedPath(pathname: string): SiteKey | null {
  if (isSharedPath(pathname)) return null;

  const path = normalizePathname(pathname);
  for (const route of SITE_PATH_ROUTES) {
    if (path === route.prefix || path.startsWith(`${route.prefix}/`)) {
      return route.siteKey;
    }
  }

  return null;
}

/** Entity app prefixes (excludes corporate-only marketing / ops paths). */
export function siteKeyForEntityPath(pathname: string): SiteKey | null {
  const owner = siteKeyForOwnedPath(pathname);
  if (!owner || owner === "corporate") return null;
  return owner;
}
