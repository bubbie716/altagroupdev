import { prisma } from "@/server/db";

/** Sentinel excluded from recipient searches — real system users are tagged SYSTEM. */
export const SYSTEM_ACTOR_USER_ID = "SYSTEM_ACTOR_SENTINEL";

export async function isSystemActorUserId(userId: string): Promise<boolean> {
  if (userId === SYSTEM_ACTOR_USER_ID) return true;
  const tagged = await prisma.userTagAssignment.findFirst({
    where: { userId, tag: "SYSTEM" },
    select: { userId: true },
  });
  return !!tagged;
}

/** Best-effort system actor for cron / automated audit rows. */
export async function resolveSystemActorUserId(): Promise<string> {
  const tagged = await prisma.user.findFirst({
    where: { tags: { some: { tag: "SYSTEM" } } },
    select: { id: true },
  });
  if (tagged) return tagged.id;

  const admin = await prisma.user.findFirst({
    where: { tags: { some: { tag: "ADMIN" } } },
    select: { id: true },
  });
  if (admin) return admin.id;

  const anyUser = await prisma.user.findFirst({ select: { id: true }, orderBy: { createdAt: "asc" } });
  if (anyUser) return anyUser.id;

  throw new Error("No user available for system audit actor");
}
