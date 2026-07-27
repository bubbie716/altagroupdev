/**
 * Background relationship-intelligence scheduling boundary.
 *
 * Production: fire-and-forget (non-blocking money paths).
 * Tests: disable scheduling and/or drain pending work before fixture teardown.
 */
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

let backgroundRefreshDisabled = false;
const pendingRefreshTasks = new Set<Promise<void>>();

/** Test-only: skip scheduling nonessential relationship background work. */
export function disableRelationshipBackgroundRefresh(): void {
  backgroundRefreshDisabled = true;
}

/** Test-only: re-enable background scheduling after a suite. */
export function enableRelationshipBackgroundRefresh(): void {
  backgroundRefreshDisabled = false;
}

export function isRelationshipBackgroundRefreshDisabled(): boolean {
  return backgroundRefreshDisabled;
}

export function getPendingRelationshipRefreshTaskCount(): number {
  return pendingRefreshTasks.size;
}

/**
 * Await every relationship refresh scheduled since the last drain.
 * Call before deleting ephemeral integration fixtures.
 */
export async function drainRelationshipRefreshTasks(): Promise<void> {
  while (pendingRefreshTasks.size > 0) {
    const batch = [...pendingRefreshTasks];
    await Promise.allSettled(batch);
  }
}

/**
 * Schedule relationship work without blocking the caller.
 * Admin money-movement and ops mutations must not wait on scoring / recommendations.
 */
function scheduleRelationshipRefresh(
  scope: string,
  id: string,
  reason: string,
  work: () => Promise<void>,
): void {
  if (backgroundRefreshDisabled) return;

  const task = work()
    .catch((error) => logRefreshFailure(scope, id, reason, error))
    .finally(() => {
      pendingRefreshTasks.delete(task);
    });
  pendingRefreshTasks.add(task);
}

/** Best-effort user profile refresh. Returns immediately; work continues in the background. */
export async function refreshUserRelationshipProfileBestEffort(
  userId: string,
  reason: string,
): Promise<void> {
  if (!userId) return;
  scheduleRelationshipRefresh("user", userId, reason, async () => {
    const actor = await resolveSystemActorId();
    const { refreshRelationshipProfile } = await import("@/server/relationship-intelligence.service");
    await refreshRelationshipProfile(userId, actor);
  });
}

/** Best-effort company profile refresh. Returns immediately; work continues in the background. */
export async function refreshCompanyRelationshipProfileBestEffort(
  companyId: string,
  reason: string,
): Promise<void> {
  if (!companyId) return;
  scheduleRelationshipRefresh("company", companyId, reason, async () => {
    const actor = await resolveSystemActorId();
    const { refreshCompanyRelationshipProfile } = await import(
      "@/server/company-relationship-intelligence.service"
    );
    await refreshCompanyRelationshipProfile(companyId, actor, { allowSystemRefresh: true });
  });
}

/** Best-effort owner profile sync. Returns immediately; work continues in the background. */
export async function refreshCompanyOwnersPersonalProfilesBestEffort(
  companyId: string,
  reason: string,
): Promise<void> {
  if (!companyId) return;
  scheduleRelationshipRefresh("company-owners", companyId, reason, async () => {
    const owners = await prisma.companyMembership.findMany({
      where: { companyId, role: "OWNER" },
      select: { userId: true },
    });
    await Promise.all(
      owners.map(async (m) => {
        const actor = await resolveSystemActorId();
        const { refreshRelationshipProfile } = await import("@/server/relationship-intelligence.service");
        await refreshRelationshipProfile(m.userId, actor);
      }),
    );
  });
}

export async function refreshUserAndOwnedCompaniesBestEffort(
  userId: string,
  reason: string,
): Promise<void> {
  await refreshUserRelationshipProfileBestEffort(userId, reason);
}

/** Company profile + owner profiles. Returns immediately. */
export async function refreshCompanyRelationshipStackBestEffort(
  companyId: string,
  reason: string,
): Promise<void> {
  if (!companyId) return;
  scheduleRelationshipRefresh("company-stack", companyId, reason, async () => {
    const actor = await resolveSystemActorId();
    const { refreshCompanyRelationshipProfile } = await import(
      "@/server/company-relationship-intelligence.service"
    );
    await refreshCompanyRelationshipProfile(companyId, actor, { allowSystemRefresh: true });

    const owners = await prisma.companyMembership.findMany({
      where: { companyId, role: "OWNER" },
      select: { userId: true },
    });
    await Promise.all(
      owners.map(async (m) => {
        const { refreshRelationshipProfile } = await import("@/server/relationship-intelligence.service");
        await refreshRelationshipProfile(m.userId, actor);
      }),
    );
  });
}

/** Post bank-account mutation refresh. Returns immediately. */
export async function refreshFromBankAccountContextBestEffort(
  account: { userId: string | null; companyId: string | null },
  reason: string,
): Promise<void> {
  const id = account.userId ?? account.companyId ?? "unknown";
  scheduleRelationshipRefresh("bank-account", id, reason, async () => {
    if (account.userId) {
      const actor = await resolveSystemActorId();
      const { refreshRelationshipProfile } = await import("@/server/relationship-intelligence.service");
      await refreshRelationshipProfile(account.userId, actor);
    }
    if (account.companyId) {
      const actor = await resolveSystemActorId();
      const { refreshCompanyRelationshipProfile } = await import(
        "@/server/company-relationship-intelligence.service"
      );
      await refreshCompanyRelationshipProfile(account.companyId, actor, { allowSystemRefresh: true });
      const owners = await prisma.companyMembership.findMany({
        where: { companyId: account.companyId, role: "OWNER" },
        select: { userId: true },
      });
      await Promise.all(
        owners.map(async (m) => {
          const { refreshRelationshipProfile } = await import("@/server/relationship-intelligence.service");
          await refreshRelationshipProfile(m.userId, actor);
        }),
      );
    }
  });
}

/** Post loan mutation refresh. Returns immediately. */
export async function refreshFromLoanContextBestEffort(
  loan: { borrowerUserId: string | null; companyId: string | null },
  reason: string,
): Promise<void> {
  const id = loan.borrowerUserId ?? loan.companyId ?? "unknown";
  scheduleRelationshipRefresh("loan", id, reason, async () => {
    if (loan.borrowerUserId) {
      const actor = await resolveSystemActorId();
      const { refreshRelationshipProfile } = await import("@/server/relationship-intelligence.service");
      await refreshRelationshipProfile(loan.borrowerUserId, actor);
    }
    if (loan.companyId) {
      const actor = await resolveSystemActorId();
      const { refreshCompanyRelationshipProfile } = await import(
        "@/server/company-relationship-intelligence.service"
      );
      await refreshCompanyRelationshipProfile(loan.companyId, actor, { allowSystemRefresh: true });
      const owners = await prisma.companyMembership.findMany({
        where: { companyId: loan.companyId, role: "OWNER" },
        select: { userId: true },
      });
      await Promise.all(
        owners.map(async (m) => {
          const { refreshRelationshipProfile } = await import("@/server/relationship-intelligence.service");
          await refreshRelationshipProfile(m.userId, actor);
        }),
      );
    }
  });
}

/** Post Alta Card mutation refresh. Returns immediately. */
export async function refreshFromAltaCardContextBestEffort(
  card: { ownerUserId: string | null; companyId: string | null },
  reason: string,
): Promise<void> {
  const id = card.ownerUserId ?? card.companyId ?? "unknown";
  scheduleRelationshipRefresh("alta-card", id, reason, async () => {
    if (card.ownerUserId) {
      const actor = await resolveSystemActorId();
      const { refreshRelationshipProfile } = await import("@/server/relationship-intelligence.service");
      await refreshRelationshipProfile(card.ownerUserId, actor);
    }
    if (card.companyId) {
      const actor = await resolveSystemActorId();
      const { refreshCompanyRelationshipProfile } = await import(
        "@/server/company-relationship-intelligence.service"
      );
      await refreshCompanyRelationshipProfile(card.companyId, actor, { allowSystemRefresh: true });
      const owners = await prisma.companyMembership.findMany({
        where: { companyId: card.companyId, role: "OWNER" },
        select: { userId: true },
      });
      await Promise.all(
        owners.map(async (m) => {
          const { refreshRelationshipProfile } = await import("@/server/relationship-intelligence.service");
          await refreshRelationshipProfile(m.userId, actor);
        }),
      );
    }
  });
}
