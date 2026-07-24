import type { Prisma } from "@prisma/client";
import type { AltaUser, DiscordProfile, EnrichedCompanyMembership, UserTag } from "@/lib/auth/types";
import {
  developerAccessGranted,
  formatDbCompanyStatus,
  formatDbCompanyType,
  formatDbVerificationStatus,
  fromDbAccountStatus,
  fromDbCompanyRole,
  fromDbDeveloperAccessStatus,
  fromDbUserTag,
} from "@/server/enum-map";

type UserWithRelations = Prisma.UserGetPayload<{
  include: typeof userWithMembershipsInclude;
}>;

function discordAvatarUrl(discordId: string, avatar: string | null | undefined): string | null {
  if (!avatar) return null;
  return `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.png?size=128`;
}

function mapTags(user: UserWithRelations): UserTag[] {
  return user.tags.map((assignment) => fromDbUserTag(assignment.tag));
}

function mapMemberships(user: UserWithRelations): EnrichedCompanyMembership[] {
  return user.companyMemberships.map((membership) => ({
    userId: user.id,
    companyId: membership.companyId,
    role: fromDbCompanyRole(membership.role),
    companyName: membership.company.name,
    companyType: formatDbCompanyType(membership.company.type),
    companyTicker: membership.company.ticker,
    companyStatus: formatDbCompanyStatus(membership.company.status),
    companyVerificationStatus: formatDbVerificationStatus(membership.company.verificationStatus),
  }));
}

export function mapDbUserToAltaUser(user: UserWithRelations): AltaUser {
  const tags = mapTags(user);
  const developerAccessStatus = fromDbDeveloperAccessStatus(user.developerAccessStatus);

  return {
    id: user.id,
    discordId: user.discordId,
    discordUsername: user.discordUsername,
    avatarUrl: discordAvatarUrl(user.discordId, user.discordAvatar),
    email: user.email,
    minecraftUsername: user.minecraftUsername,
    tags,
    accountStatus: fromDbAccountStatus(user.accountStatus),
    developerAccessStatus,
    developerAccess: developerAccessGranted(developerAccessStatus),
    internalAccess: tags.includes("corporate_admin") || tags.includes("bank_admin") || tags.includes("terminal_admin"),
    companyMemberships: mapMemberships(user),
    createdAt: user.createdAt.toISOString(),
    lastLoginAt: user.lastLoginAt.toISOString(),
  };
}

export function discordDisplayName(profile: DiscordProfile): string {
  return profile.global_name?.trim() || profile.username;
}

export const userWithMembershipsInclude = {
  tags: true,
  companyMemberships: {
    include: { company: true },
  },
} as const;
