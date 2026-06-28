const STORAGE_KEY = "alta.siteReturnPath";

const EXCLUDED_PREFIXES = ["/internal", "/login", "/maintenance", "/api"] as const;

export function isSiteReturnPathAllowed(pathname: string): boolean {
  if (!pathname.startsWith("/") || pathname.startsWith("//")) return false;
  return !EXCLUDED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Persists the latest public-site location before entering internal tools. */
export function rememberSiteReturnPath(pathname: string, searchStr = ""): void {
  if (typeof sessionStorage === "undefined") return;
  if (!isSiteReturnPathAllowed(pathname)) return;
  sessionStorage.setItem(STORAGE_KEY, `${pathname}${searchStr}`);
}

export function getSiteReturnPath(): string {
  if (typeof sessionStorage === "undefined") return "/";
  const stored = sessionStorage.getItem(STORAGE_KEY);
  if (!stored) return "/";
  const pathname = stored.split("?")[0] ?? stored;
  if (!isSiteReturnPathAllowed(pathname)) return "/";
  return stored;
}

export function parseSiteReturnPath(stored: string): {
  to: string;
  search?: Record<string, unknown>;
} {
  const url = new URL(stored, "http://localhost");
  const search: Record<string, unknown> = {};
  url.searchParams.forEach((value, key) => {
    search[key] = value;
  });
  return {
    to: url.pathname,
    search: Object.keys(search).length > 0 ? search : undefined,
  };
}
