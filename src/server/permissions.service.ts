import type { AltaUser } from "@/lib/auth/types";
import {
  canAccessBankInternal,
  isAdmin,
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

/** Terminal ops / settings — corporate or terminal admin. */
export async function requireTerminalAdmin(): Promise<AltaUser> {
  const { getUiLabUserIfEnabled } = await import("@/lib/auth/ui-lab");
  const labUser = getUiLabUserIfEnabled();
  if (labUser) return labUser;
  const user = await requireAuth();
  if (!isCorporateAdmin(user) && !isTerminalAdmin(user)) forbid();
  return user;
}
