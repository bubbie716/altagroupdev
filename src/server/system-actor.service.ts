import { UserTag } from "@prisma/client";
import { prisma } from "@/server/db";

/** Stable id for the platform cron / scheduler service account. */
export const SYSTEM_ACTOR_USER_ID = "alta-system-cron";

export const SYSTEM_ACTOR_USERNAME = "Alta System (Cron)";

let cachedSystemActorId: string | null = null;

/**
 * Resolves the user id used for scheduled jobs and system-initiated audit events.
 * Never falls back to a human admin account.
 */
export async function resolveSystemActorUserId(): Promise<string> {
  const envId = process.env.SYSTEM_ACTOR_USER_ID?.trim();
  if (envId) {
    const user = await prisma.user.findUnique({ where: { id: envId }, select: { id: true } });
    if (user) return user.id;
  }

  if (cachedSystemActorId) return cachedSystemActorId;

  const tagged = await prisma.userTagAssignment.findFirst({
    where: { tag: UserTag.SYSTEM },
    select: { userId: true },
  });
  if (tagged) {
    cachedSystemActorId = tagged.userId;
    return tagged.userId;
  }

  const byId = await prisma.user.findUnique({
    where: { id: SYSTEM_ACTOR_USER_ID },
    select: { id: true },
  });
  if (byId) {
    cachedSystemActorId = byId.id;
    return byId.id;
  }

  return ensureSystemActorUser();
}

/** Creates or updates the dedicated SYSTEM service account. */
export async function ensureSystemActorUser(): Promise<string> {
  await prisma.user.upsert({
    where: { id: SYSTEM_ACTOR_USER_ID },
    create: {
      id: SYSTEM_ACTOR_USER_ID,
      discordId: "000000000000000099",
      discordUsername: SYSTEM_ACTOR_USERNAME,
      email: "system-cron@alta.internal",
      accountStatus: "ACTIVE",
      developerAccessStatus: "NONE",
    },
    update: {
      discordUsername: SYSTEM_ACTOR_USERNAME,
      accountStatus: "ACTIVE",
    },
  });

  await prisma.userTagAssignment.upsert({
    where: { userId_tag: { userId: SYSTEM_ACTOR_USER_ID, tag: UserTag.SYSTEM } },
    create: { userId: SYSTEM_ACTOR_USER_ID, tag: UserTag.SYSTEM },
    update: {},
  });

  cachedSystemActorId = SYSTEM_ACTOR_USER_ID;
  return SYSTEM_ACTOR_USER_ID;
}
