import type { RootSession } from "@/lib/auth/root-session.functions";

const ROOT_SESSION_CACHE_TTL_MS = 30_000;

let rootSessionCache: { session: RootSession; expiresAt: number } | null = null;

export function invalidateRootSessionCache(): void {
  rootSessionCache = null;
}

/** Client-side TTL cache — avoids a server round-trip on every in-app navigation. */
export async function fetchRootSessionCached(
  fetchSession: () => Promise<RootSession>,
): Promise<RootSession> {
  if (typeof window === "undefined") {
    return fetchSession();
  }

  const now = Date.now();
  if (rootSessionCache && rootSessionCache.expiresAt > now) {
    return rootSessionCache.session;
  }

  const session = await fetchSession();
  rootSessionCache = { session, expiresAt: now + ROOT_SESSION_CACHE_TTL_MS };
  return session;
}
