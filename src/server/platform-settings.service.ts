import type { AltaUser } from "@/lib/auth/types";
import { canBypassMaintenanceMode } from "@/lib/auth/permissions";
import {
  DEFAULT_MAINTENANCE_MESSAGE,
  PLATFORM_SETTING_KEYS,
  type MaintenanceModeSettings,
  type MaintenanceModeState,
} from "@/lib/platform/maintenance-types";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/permissions.service";

const MAINTENANCE_ENTITY_ID = "platform-maintenance";

function badRequest(msg: string): never {
  throw new Error(`BAD_REQUEST:${msg}`);
}

function parseBoolean(value: unknown): boolean {
  return value === true || value === "true";
}

function parseString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function parseIsoDate(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function readSetting(key: string): Promise<unknown> {
  const row = await prisma.platformSetting.findUnique({ where: { key } });
  return row?.value ?? null;
}

async function writeSetting(key: string, value: unknown, actorUserId: string): Promise<void> {
  await prisma.platformSetting.upsert({
    where: { key },
    create: { key, value: value as object, updatedById: actorUserId },
    update: { value: value as object, updatedById: actorUserId },
  });
}

/** Admins and operators bypass maintenance mode entirely. */
export function isMaintenanceBypassUser(user: AltaUser | null | undefined): boolean {
  return canBypassMaintenanceMode(user);
}

/**
 * Read maintenance mode from the database.
 * On read failure, defaults to disabled so admins are not locked out accidentally.
 */
export async function getMaintenanceMode(): Promise<MaintenanceModeState> {
  try {
    const [enabledRaw, messageRaw, startedAtRaw, updatedByIdRaw] = await Promise.all([
      readSetting(PLATFORM_SETTING_KEYS.maintenanceModeEnabled),
      readSetting(PLATFORM_SETTING_KEYS.maintenanceModeMessage),
      readSetting(PLATFORM_SETTING_KEYS.maintenanceModeStartedAt),
      readSetting(PLATFORM_SETTING_KEYS.maintenanceModeUpdatedById),
    ]);

    const updatedById = parseString(updatedByIdRaw) || null;
    let updatedByUsername: string | null = null;
    let updatedAt: string | null = null;

    if (updatedById) {
      const updater = await prisma.user.findUnique({
        where: { id: updatedById },
        select: { discordUsername: true },
      });
      updatedByUsername = updater?.discordUsername ?? null;
    }

    const rows = await prisma.platformSetting.findMany({
      where: {
        key: {
          in: [
            PLATFORM_SETTING_KEYS.maintenanceModeEnabled,
            PLATFORM_SETTING_KEYS.maintenanceModeMessage,
            PLATFORM_SETTING_KEYS.maintenanceModeStartedAt,
            PLATFORM_SETTING_KEYS.maintenanceModeUpdatedById,
          ],
        },
      },
      select: { key: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 1,
    });
    updatedAt = rows[0]?.updatedAt.toISOString() ?? null;

    return {
      enabled: parseBoolean(enabledRaw),
      message: parseString(messageRaw) || DEFAULT_MAINTENANCE_MESSAGE,
      startedAt: parseIsoDate(startedAtRaw),
      updatedAt,
      updatedById,
      updatedByUsername,
    };
  } catch (error) {
    console.error("[maintenance] Failed to read maintenance mode; defaulting to OFF", error);
    return {
      enabled: false,
      message: DEFAULT_MAINTENANCE_MESSAGE,
      startedAt: null,
      updatedAt: null,
      updatedById: null,
      updatedByUsername: null,
    };
  }
}

export async function getMaintenanceModeSettings(): Promise<MaintenanceModeSettings> {
  const { requireOperator } = await import("@/server/permissions.service");
  const { isAdmin } = await import("@/lib/auth/permissions");
  const actor = await requireOperator();
  const state = await getMaintenanceMode();
  return { ...state, canEdit: isAdmin(actor) };
}

export async function setMaintenanceMode(
  actorUserId: string,
  input: { enabled: boolean; message: string; reason: string },
): Promise<MaintenanceModeState> {
  await requireAdmin();
  const trimmedReason = input.reason.trim();
  if (!trimmedReason) badRequest("Reason is required");

  const previous = await getMaintenanceMode();
  const message = input.message.trim() || DEFAULT_MAINTENANCE_MESSAGE;
  const nowIso = new Date().toISOString();
  const startedAt =
    input.enabled ? (previous.enabled && previous.startedAt ? previous.startedAt : nowIso) : null;

  await Promise.all([
    writeSetting(PLATFORM_SETTING_KEYS.maintenanceModeEnabled, input.enabled, actorUserId),
    writeSetting(PLATFORM_SETTING_KEYS.maintenanceModeMessage, message, actorUserId),
    writeSetting(PLATFORM_SETTING_KEYS.maintenanceModeStartedAt, startedAt, actorUserId),
    writeSetting(PLATFORM_SETTING_KEYS.maintenanceModeUpdatedById, actorUserId, actorUserId),
  ]);

  const { writeAuditLog } = await import("@/server/audit.service");
  const metadata = {
    reason: trimmedReason,
    previousEnabled: previous.enabled,
    newEnabled: input.enabled,
    previousMessage: previous.message,
    newMessage: message,
    actorUserId,
  };

  if (input.enabled && !previous.enabled) {
    await writeAuditLog({
      actorUserId,
      action: "MAINTENANCE_MODE_ENABLED",
      entityType: "PLATFORM",
      entityId: MAINTENANCE_ENTITY_ID,
      description: "Enabled platform maintenance mode",
      metadata,
    });
  } else if (!input.enabled && previous.enabled) {
    await writeAuditLog({
      actorUserId,
      action: "MAINTENANCE_MODE_DISABLED",
      entityType: "PLATFORM",
      entityId: MAINTENANCE_ENTITY_ID,
      description: "Disabled platform maintenance mode",
      metadata,
    });
  } else if (message !== previous.message) {
    await writeAuditLog({
      actorUserId,
      action: "MAINTENANCE_MESSAGE_UPDATED",
      entityType: "PLATFORM",
      entityId: MAINTENANCE_ENTITY_ID,
      description: "Updated platform maintenance message",
      metadata,
    });
  }

  return getMaintenanceMode();
}
