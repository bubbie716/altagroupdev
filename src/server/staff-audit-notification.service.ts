import { formatStaffAuditMessage } from "@/lib/staff-audit/staff-audit-format";
import type { SendStaffAuditMessageInput } from "@/lib/staff-audit/staff-audit-types";
import { prisma } from "@/server/db";
import { dispatchStaffAuditDiscordMessage } from "@/server/staff-audit-discord-dispatch.service";

const DEDUPE_TTL_MS = 10_000;
const recentDedupeKeys = new Map<string, number>();

function logStaffAudit(message: string, meta?: Record<string, unknown>): void {
  if (process.env.NODE_ENV === "test") return;
  console.info(`[staff-audit] ${message}`, meta ?? {});
}

function shouldSkipDuplicate(dedupeKey: string | undefined): boolean {
  if (!dedupeKey) return false;
  const now = Date.now();
  const last = recentDedupeKeys.get(dedupeKey);
  if (last && now - last < DEDUPE_TTL_MS) return true;
  recentDedupeKeys.set(dedupeKey, now);

  if (recentDedupeKeys.size > 200) {
    for (const [key, ts] of recentDedupeKeys) {
      if (now - ts > DEDUPE_TTL_MS) recentDedupeKeys.delete(key);
    }
  }

  return false;
}

export async function resolveStaffAuditActorName(
  actorUserId: string | undefined,
  actorName?: string,
): Promise<string> {
  const trimmed = actorName?.trim();
  if (trimmed) return trimmed.slice(0, 100);
  if (!actorUserId) return "System";

  const user = await prisma.user.findUnique({
    where: { id: actorUserId },
    select: { discordUsername: true, minecraftUsername: true },
  });
  if (!user) return "Unknown user";

  return (user.minecraftUsername?.trim() || user.discordUsername).slice(0, 100);
}

export async function sendStaffAuditMessageAsync(
  input: SendStaffAuditMessageInput,
): Promise<{ sent: boolean; reason?: string }> {
  if (shouldSkipDuplicate(input.dedupeKey)) {
    logStaffAudit("skipped duplicate", { dedupeKey: input.dedupeKey });
    return { sent: false, reason: "duplicate" };
  }

  const actorLabel = await resolveStaffAuditActorName(input.actorUserId, input.actorName);
  const content = formatStaffAuditMessage({ ...input, actorLabel });
  const result = await dispatchStaffAuditDiscordMessage(content);

  if (!result.sent) {
    logStaffAudit("Discord message not sent", {
      product: input.product,
      action: input.action,
      reason: result.reason,
    });
    return { sent: false, reason: result.reason };
  }

  logStaffAudit("Discord message sent", {
    product: input.product,
    action: input.action,
    via: result.via,
  });
  return { sent: true };
}

/** Fire-and-forget staff audit Discord message. Never throws. */
export function sendStaffAuditMessage(input: SendStaffAuditMessageInput): void {
  void sendStaffAuditMessageAsync(input).catch((error) => {
    console.error("[staff-audit] dispatch failed", error);
  });
}

/** Test helper — clears in-memory dedupe cache. */
export function resetStaffAuditDedupeCacheForTests(): void {
  recentDedupeKeys.clear();
}
