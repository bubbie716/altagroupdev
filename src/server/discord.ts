import { SITE_CONFIGS, SITE_KEYS } from "@/config/sites";

const DISCORD_API = "https://discord.com/api";

function hostnameFromHost(host: string): string {
  return host.split(":")[0].trim().toLowerCase();
}

function stripWwwHost(host: string): string {
  const normalized = host.toLowerCase();
  return normalized.startsWith("www.") ? normalized.slice(4) : normalized;
}

function isKnownSiteOrigin(origin: string): boolean {
  try {
    const hostname = stripWwwHost(new URL(origin).hostname);
    for (const key of SITE_KEYS) {
      for (const host of SITE_CONFIGS[key].productionHosts) {
        if (stripWwwHost(hostnameFromHost(host)) === hostname) return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

function normalizeRedirectUri(value: string): string {
  const trimmed = value.trim();
  const typo = trimmed.match(/^DISCORD_REDIRECT_URI=(.+)$/i);
  return (typo?.[1] ?? trimmed).trim();
}

function parseRedirectUriList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map(normalizeRedirectUri)
    .filter(Boolean);
}

export function parseRedirectUriListForOAuth(): string[] {
  return parseRedirectUriList(process.env.DISCORD_REDIRECT_URI);
}

function isDevOAuthOrigin(origin: string): boolean {
  try {
    const { hostname, protocol } = new URL(origin);
    if (protocol !== "http:" && protocol !== "https:") return false;
    if (hostname === "localhost" || hostname === "127.0.0.1") return true;
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
    return false;
  } catch {
    return false;
  }
}

export function getDiscordConfig() {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    return null;
  }
  return { clientId, clientSecret, redirectUri: normalizeRedirectUri(redirectUri) };
}

/** Resolve OAuth callback URL for a site origin (canonical host in production). */
export function resolveOAuthCallbackUri(origin: string): string | null {
  const allowed = parseRedirectUriList(process.env.DISCORD_REDIRECT_URI);
  const callback = `${origin.replace(/\/$/, "")}/api/auth/discord/callback`;
  if (allowed.includes(callback)) return callback;
  if (process.env.NODE_ENV !== "production" && isDevOAuthOrigin(origin)) return callback;
  return null;
}

/** Shared Alta callback used when an entity domain has no dedicated OAuth redirect registered. */
export function resolveSharedOAuthCallbackUri(): string | null {
  const allowed = parseRedirectUriList(process.env.DISCORD_REDIRECT_URI);
  return allowed[0] ?? null;
}

export function resolveOAuthCallbackUriForSite(returnOrigin: string): string | null {
  return resolveOAuthCallbackUri(returnOrigin) ?? resolveSharedOAuthCallbackUri();
}

/** Use request origin when its callback is registered in Discord (dev and production). */
export function resolveDiscordRedirectUri(request?: Request): string | null {
  const config = getDiscordConfig();
  if (!config) return null;

  if (!request) {
    const allowed = parseRedirectUriList(process.env.DISCORD_REDIRECT_URI);
    return allowed[0] ?? config.redirectUri;
  }

  const origin = new URL(request.url).origin;
  return resolveOAuthCallbackUri(origin) ?? resolveOAuthCallbackUri(new URL(config.redirectUri).origin);
}

export function isAllowedReturnOrigin(origin: string, allowedCallbacks: string[]): boolean {
  try {
    const url = new URL(origin);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    const callback = `${url.origin}/api/auth/discord/callback`;
    if (allowedCallbacks.includes(callback)) return true;
    if (process.env.NODE_ENV !== "production" && isDevOAuthOrigin(url.origin)) return true;
    if (process.env.NODE_ENV === "production" && allowedCallbacks.length > 0 && isKnownSiteOrigin(origin)) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function resolveOAuthReturnUrl(
  request: Request,
  parsed: { returnTo: string; returnOrigin?: string },
  fallbackRoute: string,
): string {
  const allowed = parseRedirectUriList(process.env.DISCORD_REDIRECT_URI);
  const safePath =
    parsed.returnTo.startsWith("/") && !parsed.returnTo.startsWith("//")
      ? parsed.returnTo
      : fallbackRoute;

  const requestOrigin = new URL(request.url).origin;
  const origin =
    parsed.returnOrigin && isAllowedReturnOrigin(parsed.returnOrigin, allowed)
      ? parsed.returnOrigin
      : requestOrigin;

  return new URL(safePath, origin).toString();
}

export function oauthCallbackMatchesReturnOrigin(
  request: Request,
  returnOrigin?: string,
): boolean {
  if (!returnOrigin) return true;
  try {
    const callbackHost = new URL(request.url).hostname.toLowerCase();
    const returnHost = new URL(returnOrigin).hostname.toLowerCase();
    if (callbackHost === returnHost) return true;
    const stripWww = (host: string) => (host.startsWith("www.") ? host.slice(4) : host);
    return stripWww(callbackHost) === stripWww(returnHost);
  } catch {
    return false;
  }
}

export function buildDiscordAuthorizeUrl(state: string, redirectUri: string, clientId: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "identify",
    state,
    prompt: "consent",
  });
  return `${DISCORD_API}/oauth2/authorize?${params.toString()}`;
}

export async function exchangeDiscordCode(
  code: string,
  redirectUri?: string,
): Promise<{ access_token: string } | null> {
  const config = getDiscordConfig();
  if (!config) return null;

  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri ?? config.redirectUri,
  });

  const res = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) return null;
  return res.json() as Promise<{ access_token: string }>;
}

export async function fetchDiscordProfile(accessToken: string) {
  const res = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  return res.json() as Promise<{
    id: string;
    username: string;
    global_name?: string | null;
    avatar: string | null;
  }>;
}
