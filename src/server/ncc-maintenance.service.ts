import { isAdmin } from "@/lib/auth/permissions";
import {
  DEFAULT_NCC_MAINTENANCE_MESSAGE,
  NCC_MAINTENANCE_SETTING_KEYS,
  type NccMaintenanceModeSettings,
  type NccMaintenanceModeState,
} from "@/lib/ncc/ncc-maintenance-types";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/permissions.service";

const NCC_MAINTENANCE_ENTITY_ID = "ncc-maintenance";
const NCC_MAINTENANCE_KEYS = Object.values(NCC_MAINTENANCE_SETTING_KEYS);

const GATE_CACHE_TTL_MS = 15_000;
const FULL_CACHE_TTL_MS = 10_000;

let nccGateCache: { enabled: boolean; expiresAt: number } | null = null;
let nccFullCache: { value: NccMaintenanceModeState; expiresAt: number } | null = null;

export function clearNccMaintenanceModeCache(): void {
  nccGateCache = null;
  nccFullCache = null;
}

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

async function readNccMaintenanceSettings(): Promise<
  Map<string, { value: unknown; updatedAt: Date }>
> {
  const rows = await prisma.platformSetting.findMany({
    where: { key: { in: NCC_MAINTENANCE_KEYS } },
    select: { key: true, value: true, updatedAt: true },
  });
  return new Map(rows.map((row) => [row.key, { value: row.value, updatedAt: row.updatedAt }]));
}

async function writeSetting(key: string, value: unknown, actorUserId: string): Promise<void> {
  await prisma.platformSetting.upsert({
    where: { key },
    create: { key, value: value as object, updatedById: actorUserId },
    update: { value: value as object, updatedById: actorUserId },
  });
}

/** Lightweight gate for NCC root routing. */
export async function getNccMaintenanceModeGate(): Promise<boolean> {
  if (nccGateCache && Date.now() < nccGateCache.expiresAt) {
    return nccGateCache.enabled;
  }
  try {
    const settings = await readNccMaintenanceSettings();
    const enabled = parseBoolean(settings.get(NCC_MAINTENANCE_SETTING_KEYS.enabled)?.value);
    nccGateCache = { enabled, expiresAt: Date.now() + GATE_CACHE_TTL_MS };
    return enabled;
  } catch (error) {
    console.error("[ncc-maintenance] Failed to read gate; defaulting to OFF", error);
    return false;
  }
}

export async function getNccMaintenanceMode(): Promise<NccMaintenanceModeState> {
  if (nccFullCache && Date.now() < nccFullCache.expiresAt) {
    return nccFullCache.value;
  }

  try {
    const settings = await readNccMaintenanceSettings();
    const updatedById = parseString(settings.get(NCC_MAINTENANCE_SETTING_KEYS.updatedById)?.value) || null;
    let updatedByUsername: string | null = null;

    if (updatedById) {
      const updater = await prisma.user.findUnique({
        where: { id: updatedById },
        select: { discordUsername: true },
      });
      updatedByUsername = updater?.discordUsername ?? null;
    }

    const latestRow = [...settings.values()].sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
    )[0];

    const value: NccMaintenanceModeState = {
      enabled: parseBoolean(settings.get(NCC_MAINTENANCE_SETTING_KEYS.enabled)?.value),
      message:
        parseString(settings.get(NCC_MAINTENANCE_SETTING_KEYS.message)?.value) ||
        DEFAULT_NCC_MAINTENANCE_MESSAGE,
      startedAt: parseIsoDate(settings.get(NCC_MAINTENANCE_SETTING_KEYS.startedAt)?.value),
      updatedAt: latestRow?.updatedAt.toISOString() ?? null,
      updatedById,
      updatedByUsername,
    };

    nccFullCache = { value, expiresAt: Date.now() + FULL_CACHE_TTL_MS };
    nccGateCache = { enabled: value.enabled, expiresAt: Date.now() + GATE_CACHE_TTL_MS };
    return value;
  } catch (error) {
    console.error("[ncc-maintenance] Failed to read maintenance mode; defaulting to OFF", error);
    return {
      enabled: false,
      message: DEFAULT_NCC_MAINTENANCE_MESSAGE,
      startedAt: null,
      updatedAt: null,
      updatedById: null,
      updatedByUsername: null,
    };
  }
}

export async function getNccMaintenanceModeSettings(): Promise<NccMaintenanceModeSettings> {
  const { requireAuth } = await import("@/server/auth.service");
  const actor = await requireAuth();
  const state = await getNccMaintenanceMode();
  return { ...state, canEdit: isAdmin(actor) };
}

export async function setNccMaintenanceMode(
  actorUserId: string,
  input: { enabled: boolean; message: string; reason: string },
): Promise<NccMaintenanceModeState> {
  await requireAdmin();
  const trimmedReason = input.reason.trim();
  if (!trimmedReason) badRequest("Reason is required");

  const previous = await getNccMaintenanceMode();
  const message = input.message.trim() || DEFAULT_NCC_MAINTENANCE_MESSAGE;
  const nowIso = new Date().toISOString();
  const startedAt =
    input.enabled
      ? previous.enabled && previous.startedAt
        ? previous.startedAt
        : nowIso
      : null;

  await Promise.all([
    writeSetting(NCC_MAINTENANCE_SETTING_KEYS.enabled, input.enabled, actorUserId),
    writeSetting(NCC_MAINTENANCE_SETTING_KEYS.message, message, actorUserId),
    writeSetting(NCC_MAINTENANCE_SETTING_KEYS.startedAt, startedAt, actorUserId),
    writeSetting(NCC_MAINTENANCE_SETTING_KEYS.updatedById, actorUserId, actorUserId),
  ]);

  clearNccMaintenanceModeCache();

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
      entityId: NCC_MAINTENANCE_ENTITY_ID,
      description: "Enabled NCC maintenance mode",
      metadata,
    });
  } else if (!input.enabled && previous.enabled) {
    await writeAuditLog({
      actorUserId,
      action: "MAINTENANCE_MODE_DISABLED",
      entityType: "PLATFORM",
      entityId: NCC_MAINTENANCE_ENTITY_ID,
      description: "Disabled NCC maintenance mode",
      metadata,
    });
  } else if (message !== previous.message) {
    await writeAuditLog({
      actorUserId,
      action: "MAINTENANCE_MESSAGE_UPDATED",
      entityType: "PLATFORM",
      entityId: NCC_MAINTENANCE_ENTITY_ID,
      description: "Updated NCC maintenance message",
      metadata,
    });
  }

  return getNccMaintenanceMode();
}
