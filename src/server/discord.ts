const DISCORD_API = "https://discord.com/api";

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

/** Use request origin in dev so localhost and LAN URLs both work when registered in Discord. */
export function resolveDiscordRedirectUri(request?: Request): string | null {
  const config = getDiscordConfig();
  if (!config) return null;

  const allowed = parseRedirectUriList(process.env.DISCORD_REDIRECT_URI);
  const fallback = allowed[0] ?? config.redirectUri;

  if (process.env.NODE_ENV === "production" || !request) {
    return fallback;
  }

  const callback = `${new URL(request.url).origin}/api/auth/discord/callback`;
  if (allowed.includes(callback)) return callback;
  if (isDevOAuthOrigin(new URL(request.url).origin)) return callback;
  return fallback;
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
