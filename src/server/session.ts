import { resolveSiteKey } from "@/lib/site/site-context";
import { isPlainLocalDevHost } from "@/lib/site/local-dev-site";

const SESSION_COOKIE = "alta_session";
const OAUTH_STATE_COOKIE = "alta_oauth_state";
const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7; // 7 days
const OAUTH_STATE_MAX_AGE_SEC = 600; // 10 minutes

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function sessionCookieDomain(): string | null {
  if (!isProduction()) return null;
  const domain = process.env.ALTA_COOKIE_DOMAIN?.trim();
  return domain || null;
}

function cookieFlags(maxAge: number): string {
  const parts = ["HttpOnly", "SameSite=Lax", "Path=/", `Max-Age=${maxAge}`];
  if (isProduction()) parts.push("Secure");
  const domain = sessionCookieDomain();
  if (domain) parts.push(`Domain=${domain}`);
  return parts.join("; ");
}

function clearCookieFlags(): string {
  const parts = ["HttpOnly", "SameSite=Lax", "Path=/", "Max-Age=0"];
  if (isProduction()) parts.push("Secure");
  const domain = sessionCookieDomain();
  if (domain) parts.push(`Domain=${domain}`);
  return parts.join("; ");
}

function parseCookies(header: string | null | undefined): Record<string, string> {
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(/;\s*/)) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    out[part.slice(0, eq)] = decodeURIComponent(part.slice(eq + 1));
  }
  return out;
}

export function readCookie(name: string, cookieHeader: string | null | undefined): string | null {
  return parseCookies(cookieHeader)[name] ?? null;
}

export function buildSetCookie(name: string, value: string, maxAge: number): string {
  return `${name}=${encodeURIComponent(value)}; ${cookieFlags(maxAge)}`;
}

export function buildClearCookie(name: string): string {
  return `${name}=; ${clearCookieFlags()}`;
}

export function getSessionCookieName(): string {
  return SESSION_COOKIE;
}

export function getOAuthStateCookieName(): string {
  return OAUTH_STATE_COOKIE;
}

export function sessionMaxAgeSec(): number {
  return SESSION_MAX_AGE_SEC;
}

export function oauthStateMaxAgeSec(): number {
  return OAUTH_STATE_MAX_AGE_SEC;
}

/** Node requires absolute URLs for Response.redirect(). */
export function loginErrorRedirect(request: Request, error: string): Response {
  const reqUrl = new URL(request.url);
  const siteKey = resolveSiteKey({
    host: reqUrl.host,
    search: Object.fromEntries(reqUrl.searchParams),
    pathname: reqUrl.pathname,
    allowDevOverride: true,
  });
  const path = "/";
  const url = new URL(path, request.url);
  url.searchParams.set("error", error);
  if (siteKey !== "corporate" && isPlainLocalDevHost(reqUrl.host)) {
    url.searchParams.set("site", siteKey);
  }
  return Response.redirect(url.toString(), 302);
}

/** Set-Cookie must be sent as separate headers — never comma-joined. */
export function redirectWithSetCookies(location: string, cookies: string[]): Response {
  const headers = new Headers();
  headers.set("Location", location);
  for (const cookie of cookies) {
    headers.append("Set-Cookie", cookie);
  }
  return new Response(null, { status: 302, headers });
}
