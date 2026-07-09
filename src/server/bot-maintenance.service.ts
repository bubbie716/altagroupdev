import {
  getMaintenanceMode,
  getMaintenanceScopeFlags,
  isMaintenanceBypassUser,
} from "@/server/platform-settings.service";
import { isMaintenanceActiveForSite } from "@/lib/platform/maintenance-types";
import { mapDbUserToAltaUser, userWithMembershipsInclude } from "@/server/user-mapper";
import { prisma } from "@/server/db";
import { DEFAULT_MAINTENANCE_MESSAGE } from "@/lib/platform/maintenance-types";

export type BotMaintenanceBlock = {
  blocked: boolean;
  message: string;
};

/** Pure gate used by the Discord bot and unit tests. */
export function shouldBlockBotUserDuringMaintenance(
  maintenanceEnabled: boolean,
  canBypass: boolean,
): boolean {
  return maintenanceEnabled && !canBypass;
}

/** Whether a linked Discord user may use the bot during platform maintenance. */
export async function canBotDiscordUserBypassMaintenance(discordId: string): Promise<boolean> {
  const userRecord = await prisma.user.findUnique({
    where: { discordId },
    include: userWithMembershipsInclude,
  });
  if (!userRecord) return false;
  return isMaintenanceBypassUser(mapDbUserToAltaUser(userRecord));
}

/**
 * Resolve whether a Discord user should be blocked by platform maintenance mode.
 * Unlinked users are blocked when maintenance is on (same as anonymous web visitors).
 */
export async function getBotMaintenanceBlock(discordId: string): Promise<BotMaintenanceBlock> {
  const scopes = await getMaintenanceScopeFlags();
  const bankMaintenanceActive = isMaintenanceActiveForSite("bank", scopes);
  if (!bankMaintenanceActive) {
    return { blocked: false, message: "" };
  }

  if (await canBotDiscordUserBypassMaintenance(discordId)) {
    return { blocked: false, message: "" };
  }

  try {
    const state = await getMaintenanceMode();
    return { blocked: true, message: state.message || DEFAULT_MAINTENANCE_MESSAGE };
  } catch (error) {
    console.error("[bot-maintenance] Failed to read maintenance message; using default", error);
    return { blocked: true, message: DEFAULT_MAINTENANCE_MESSAGE };
  }
}
