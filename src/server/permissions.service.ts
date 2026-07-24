import type { AltaUser } from "@/lib/auth/types";
import {
  canAccessBankInternal,
  canAccessIssuerPortal,
  isAdmin,
  isDeveloper,
  isPrivateClient,
  isCorporateAdmin,
  isTerminalAdmin,
} from "@/lib/auth/permissions";
import { requireAuth } from "@/server/auth.service";

function forbid(): never {
  throw new Error("FORBIDDEN");
}

/** Corporate admin only — group-wide destructive / settings actions. */
export async function requireAdmin(): Promise<AltaUser> {
  const user = await requireAuth();
  if (!isAdmin(user)) forbid();
  return user;
}

/** Bank ops console — corporate or bank admin. */
export async function requireOperator(): Promise<AltaUser> {
  const user = await requireAuth();
  if (!canAccessBankInternal(user)) forbid();
  return user;
}

/** Terminal settings — corporate or terminal admin. */
export async function requireTerminalAdmin(): Promise<AltaUser> {
  const user = await requireAuth();
  if (!isCorporateAdmin(user) && !isTerminalAdmin(user)) forbid();
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
