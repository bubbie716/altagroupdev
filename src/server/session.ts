const SESSION_COOKIE = "alta_session";
const OAUTH_STATE_COOKIE = "alta_oauth_state";
const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7; // 7 days
const OAUTH_STATE_MAX_AGE_SEC = 600; // 10 minutes

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function cookieFlags(maxAge: number): string {
  const parts = ["HttpOnly", "SameSite=Lax", "Path=/", `Max-Age=${maxAge}`];
  if (isProduction()) parts.push("Secure");
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
  const parts = ["HttpOnly", "SameSite=Lax", "Path=/", "Max-Age=0"];
  if (isProduction()) parts.push("Secure");
  return `${name}=; ${parts.join("; ")}`;
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
  const url = new URL("/login", request.url);
  url.searchParams.set("error", error);
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
