import { getRequestHeader, setResponseHeader } from "@tanstack/react-start/server";
import type { AltaUser, UserTag } from "@/lib/auth/types";
import { hasTag } from "@/lib/auth/tags";
import {
  buildClearCookie,
  buildSetCookie,
  getSessionCookieName,
  readCookie,
  sessionMaxAgeSec,
} from "@/server/session";
import { loadUserBySessionToken, deleteSessionByToken, createUserSession } from "@/server/session.service";
import { upsertUserFromDiscord } from "@/server/user.service";
import type { DiscordProfile } from "@/lib/auth/types";
import { isDatabaseConfigured } from "@/server/db";

const SESSION_USER_CACHE_TTL_MS = 30_000;
const sessionUserCache = new Map<string, { user: AltaUser; expiresAt: number }>();

function getCachedSessionUser(token: string): AltaUser | null {
  const entry = sessionUserCache.get(token);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    sessionUserCache.delete(token);
    return null;
  }
  return entry.user;
}

function setCachedSessionUser(token: string, user: AltaUser): void {
  sessionUserCache.set(token, { user, expiresAt: Date.now() + SESSION_USER_CACHE_TTL_MS });
}

export function invalidateSessionUserCache(token?: string): void {
  if (token) sessionUserCache.delete(token);
}

export async function readCurrentUser(): Promise<AltaUser | null> {
  if (!isDatabaseConfigured()) return null;

  const cookieHeader = getRequestHeader("cookie");
  const token = readCookie(getSessionCookieName(), cookieHeader);
  if (!token) return null;

  const cached = getCachedSessionUser(token);
  if (cached) return cached;

  const user = await loadUserBySessionToken(token);
  if (user) setCachedSessionUser(token, user);
  return user;
}

export function clearUserSession(): void {
  setResponseHeader("Set-Cookie", buildClearCookie(getSessionCookieName()));
}

export async function issueUserSession(user: AltaUser): Promise<string | null> {
  const token = await createUserSession(user.id);
  if (!token) return null;
  setResponseHeader("Set-Cookie", buildSetCookie(getSessionCookieName(), token, sessionMaxAgeSec()));
  return token;
}

export async function logoutCurrentUser(): Promise<void> {
  const cookieHeader = getRequestHeader("cookie");
  const token = readCookie(getSessionCookieName(), cookieHeader);
  if (token) {
    invalidateSessionUserCache(token);
    await deleteSessionByToken(token);
  }
  clearUserSession();
}

export async function loginWithDiscordProfile(
  profile: DiscordProfile,
): Promise<{ user: AltaUser; sessionToken: string } | null> {
  if (!isDatabaseConfigured()) return null;

  const user = await upsertUserFromDiscord(profile);
  const sessionToken = await createUserSession(user.id);
  if (!sessionToken) return null;

  return { user, sessionToken };
}

export async function getCurrentUser(): Promise<AltaUser | null> {
  return readCurrentUser();
}

export async function requireAuth(): Promise<AltaUser> {
  const user = await readCurrentUser();
  if (!user) throw new Error("UNAUTHORIZED");
  if (user.accountStatus === "frozen" || user.accountStatus === "restricted") {
    throw new Error("ACCOUNT_RESTRICTED");
  }
  return user;
}

export async function requireTag(tag: UserTag | UserTag[]): Promise<AltaUser> {
  const user = await requireAuth();
  const tags = Array.isArray(tag) ? tag : [tag];
  if (!tags.some((t) => hasTag(user, t))) throw new Error("FORBIDDEN");
  return user;
}

export async function requireInternalRole(): Promise<AltaUser> {
  const { requireOperator } = await import("@/server/permissions.service");
  return requireOperator();
}
