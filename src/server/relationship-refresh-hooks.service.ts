import { prisma } from "@/server/db";

async function resolveSystemActorId(): Promise<string | undefined> {
  try {
    const { resolveSystemActorUserId } = await import("@/server/system-actor.service");
    return await resolveSystemActorUserId();
  } catch {
    return undefined;
  }
}

function logRefreshFailure(scope: string, id: string, reason: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[relationship-intelligence] ${scope} refresh failed (${reason})`, { id, message });
}

export async function refreshUserRelationshipProfileBestEffort(
  userId: string,
  reason: string,
): Promise<void> {
  if (!userId) return;
  try {
    const actor = await resolveSystemActorId();
    const { refreshRelationshipProfile } = await import("@/server/relationship-intelligence.service");
    await refreshRelationshipProfile(userId, actor);
  } catch (error) {
    logRefreshFailure("user", userId, reason, error);
  }
}

export async function refreshCompanyRelationshipProfileBestEffort(
  companyId: string,
  reason: string,
): Promise<void> {
  if (!companyId) return;
  try {
    const actor = await resolveSystemActorId();
    const { refreshCompanyRelationshipProfile } = await import(
      "@/server/company-relationship-intelligence.service"
    );
    await refreshCompanyRelationshipProfile(companyId, actor, { allowSystemRefresh: true });
  } catch (error) {
    logRefreshFailure("company", companyId, reason, error);
  }
}

export async function refreshCompanyOwnersPersonalProfilesBestEffort(
  companyId: string,
  reason: string,
): Promise<void> {
  if (!companyId) return;
  const owners = await prisma.companyMembership.findMany({
    where: { companyId, role: "OWNER" },
    select: { userId: true },
  });
  await Promise.all(
    owners.map((m) => refreshUserRelationshipProfileBestEffort(m.userId, `${reason}:owner-sync`)),
  );
}

export async function refreshUserAndOwnedCompaniesBestEffort(
  userId: string,
  reason: string,
): Promise<void> {
  await refreshUserRelationshipProfileBestEffort(userId, reason);
}

export async function refreshCompanyRelationshipStackBestEffort(
  companyId: string,
  reason: string,
): Promise<void> {
  await refreshCompanyRelationshipProfileBestEffort(companyId, reason);
  await refreshCompanyOwnersPersonalProfilesBestEffort(companyId, reason);
}

export async function refreshFromBankAccountContextBestEffort(
  account: { userId: string | null; companyId: string | null },
  reason: string,
): Promise<void> {
  if (account.userId) {
    await refreshUserRelationshipProfileBestEffort(account.userId, reason);
  }
  if (account.companyId) {
    await refreshCompanyRelationshipStackBestEffort(account.companyId, reason);
  }
}

export async function refreshFromLoanContextBestEffort(
  loan: { borrowerUserId: string | null; companyId: string | null },
  reason: string,
): Promise<void> {
  if (loan.borrowerUserId) {
    await refreshUserRelationshipProfileBestEffort(loan.borrowerUserId, reason);
  }
  if (loan.companyId) {
    await refreshCompanyRelationshipStackBestEffort(loan.companyId, reason);
  }
}

export async function refreshFromAltaCardContextBestEffort(
  card: { ownerUserId: string | null; companyId: string | null },
  reason: string,
): Promise<void> {
  if (card.ownerUserId) {
    await refreshUserRelationshipProfileBestEffort(card.ownerUserId, reason);
  }
  if (card.companyId) {
    await refreshCompanyRelationshipStackBestEffort(card.companyId, reason);
  }
}
