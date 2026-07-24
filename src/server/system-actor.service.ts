import { prisma } from "@/server/db";

/**
 * Sentinel excluded from recipient searches when no dedicated system user exists yet.
 * Prefer a real User row looked up via SYSTEM_ACTOR_USER_ID / SYSTEM_ACTOR_DISCORD_ID.
 */
export const SYSTEM_ACTOR_USER_ID = "SYSTEM_ACTOR_SENTINEL";

const SYSTEM_ACTOR_DISCORD_ID =
  process.env.SYSTEM_ACTOR_DISCORD_ID?.trim() || "000000000000000000";

async function findConfiguredSystemActor(): Promise<{ id: string } | null> {
  const configuredId = process.env.SYSTEM_ACTOR_USER_ID?.trim();
  if (configuredId && configuredId !== SYSTEM_ACTOR_USER_ID) {
    const byId = await prisma.user.findUnique({
      where: { id: configuredId },
      select: { id: true },
    });
    if (byId) return byId;
  }

  return prisma.user.findUnique({
    where: { discordId: SYSTEM_ACTOR_DISCORD_ID },
    select: { id: true },
  });
}

export async function isSystemActorUserId(userId: string): Promise<boolean> {
  if (userId === SYSTEM_ACTOR_USER_ID) return true;
  const configured = await findConfiguredSystemActor();
  return configured?.id === userId;
}

/** Best-effort system actor for cron / automated audit rows. */
export async function resolveSystemActorUserId(): Promise<string> {
  const configured = await findConfiguredSystemActor();
  if (configured) return configured.id;

  const admin = await prisma.user.findFirst({
    where: { tags: { some: { tag: "CORPORATE_ADMIN" } } },
    select: { id: true },
  });
  if (admin) return admin.id;

  const anyUser = await prisma.user.findFirst({ select: { id: true }, orderBy: { createdAt: "asc" } });
  if (anyUser) return anyUser.id;

  throw new Error("No user available for system audit actor");
}
