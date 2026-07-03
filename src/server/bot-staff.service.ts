import { canAccessInternal } from "@/lib/auth/permissions";
import { mapDbUserToAltaUser, userWithMembershipsInclude } from "@/server/user-mapper";
import { prisma } from "@/server/db";

function dealRoomStaffRoleIds(): string[] {
  return (process.env.DISCORD_DEAL_ROOM_STAFF_ROLE_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

export function hasDealRoomStaffDiscordRole(memberRoleIds: string[]): boolean {
  const staffRoles = dealRoomStaffRoleIds();
  if (staffRoles.length === 0) return false;
  return memberRoleIds.some((id) => staffRoles.includes(id));
}

/** Staff = Deal Room staff Discord role and/or linked Alta admin/operator. */
export async function isBotStaffDiscordUser(
  discordUserId: string,
  memberRoleIds: string[] = [],
): Promise<boolean> {
  if (hasDealRoomStaffDiscordRole(memberRoleIds)) {
    return true;
  }

  const userRecord = await prisma.user.findUnique({
    where: { discordId: discordUserId },
    include: userWithMembershipsInclude,
  });
  if (!userRecord) return false;

  return canAccessInternal(mapDbUserToAltaUser(userRecord));
}
