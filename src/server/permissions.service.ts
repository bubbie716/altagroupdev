import type { AltaUser } from "@/lib/auth/types";
import {
  canAccessInternal,
  canAccessIssuerPortal,
  isAdmin,
  isDeveloper,
  isPrivateClient,
} from "@/lib/auth/permissions";
import { requireAuth } from "@/server/auth.service";

function forbid(): never {
  throw new Error("FORBIDDEN");
}

export async function requireAdmin(): Promise<AltaUser> {
  const user = await requireAuth();
  if (!isAdmin(user)) forbid();
  return user;
}

/** Internal console access — admin or operator. */
export async function requireOperator(): Promise<AltaUser> {
  const user = await requireAuth();
  if (!canAccessInternal(user)) forbid();
  return user;
}

export async function requirePrivateClient(): Promise<AltaUser> {
  const user = await requireAuth();
  if (!isPrivateClient(user)) forbid();
  return user;
}

export async function requireDeveloper(): Promise<AltaUser> {
  const user = await requireAuth();
  if (!isDeveloper(user)) forbid();
  return user;
}

export async function requireIssuerPortalAccess(ticker: string): Promise<AltaUser> {
  const user = await requireAuth();
  if (!canAccessIssuerPortal(user, { ticker })) forbid();
  return user;
}
