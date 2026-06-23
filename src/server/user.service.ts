import type { DiscordProfile } from "@/lib/auth/types";
import { getMockUserOverride } from "@/config/mock-users";
import { prisma } from "@/server/db";
import { discordDisplayName, mapDbUserToAltaUser, userWithMembershipsInclude } from "@/server/user-mapper";
import {
  toDbCompanyRole,
  toDbDeveloperAccessStatus,
  toDbUserTag,
} from "@/server/enum-map";
import type { AltaUser } from "@/lib/auth/types";

export async function upsertUserFromDiscord(profile: DiscordProfile): Promise<AltaUser> {
  const existing = await prisma.user.findUnique({
    where: { discordId: profile.id },
    include: userWithMembershipsInclude,
  });

  const now = new Date();
  const mockOverride = getMockUserOverride(profile.id);
  const displayName = discordDisplayName(profile);

  if (existing) {
    const user = await prisma.user.update({
      where: { discordId: profile.id },
      data: {
        discordUsername: displayName,
        discordAvatar: profile.avatar,
        email: profile.email ?? undefined,
        lastLoginAt: now,
        ...(mockOverride?.minecraftUsername !== undefined && {
          minecraftUsername: mockOverride.minecraftUsername,
        }),
        ...(mockOverride?.developerAccess === true && {
          developerAccessStatus: toDbDeveloperAccessStatus("approved"),
        }),
        ...(mockOverride?.developerAccess === false && {
          developerAccessStatus: toDbDeveloperAccessStatus("none"),
        }),
      },
      include: userWithMembershipsInclude,
    });

    await syncDevMemberships(user.id, profile.id);
    await syncDevTags(user.id, profile.id);

    const refreshed = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: userWithMembershipsInclude,
    });

    return mapDbUserToAltaUser(refreshed);
  }

  const user = await prisma.user.create({
    data: {
      discordId: profile.id,
      discordUsername: displayName,
      discordAvatar: profile.avatar,
      email: profile.email ?? null,
      minecraftUsername: mockOverride?.minecraftUsername ?? null,
      developerAccessStatus:
        mockOverride?.developerAccess === true
          ? toDbDeveloperAccessStatus("approved")
          : toDbDeveloperAccessStatus("none"),
      lastLoginAt: now,
      tags: mockOverride?.tags?.length
        ? {
            create: mockOverride.tags.map((tag) => ({ tag: toDbUserTag(tag) })),
          }
        : undefined,
    },
    include: userWithMembershipsInclude,
  });

  await syncDevMemberships(user.id, profile.id);
  await syncDevTags(user.id, profile.id);

  return mapDbUserToAltaUser(user);
}

async function syncDevTags(userId: string, discordId: string): Promise<void> {
  const override = getMockUserOverride(discordId);
  if (!override?.tags?.length) return;

  for (const tag of override.tags) {
    await prisma.userTagAssignment.upsert({
      where: { userId_tag: { userId, tag: toDbUserTag(tag) } },
      create: { userId, tag: toDbUserTag(tag) },
      update: {},
    });
  }
}

async function syncDevMemberships(userId: string, discordId: string): Promise<void> {
  const override = getMockUserOverride(discordId);
  if (!override?.companyMemberships?.length) return;

  for (const membership of override.companyMemberships) {
    const company = await prisma.company.findUnique({ where: { id: membership.companyId } });
    if (!company) continue;

    await prisma.companyMembership.upsert({
      where: {
        userId_companyId: { userId, companyId: membership.companyId },
      },
      create: {
        userId,
        companyId: membership.companyId,
        role: toDbCompanyRole(membership.role),
      },
      update: {
        role: toDbCompanyRole(membership.role),
      },
    });
  }
}
