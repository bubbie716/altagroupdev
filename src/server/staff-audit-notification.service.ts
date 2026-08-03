import { staffAuditProductToSource } from "@/lib/discord/discord-event-envelope";
import {
  isDiscordProductAwareRoutingEnabled,
  resolveDiscordEventDefinition,
} from "@/lib/discord/discord-event-registry";
import { buildEventPremiumEmbed } from "@/lib/discord/discord-premium-embed";
import {
  buildProductPremiumNotification,
  isDiscordProductPremiumEmbedsEnabled,
} from "@/lib/discord/discord-product-notification-templates";
import {
  formatStaffAuditAction,
  formatStaffAuditMessage,
} from "@/lib/staff-audit/staff-audit-format";
import { sanitizeStaffAuditDetails } from "@/lib/staff-audit/staff-audit-privacy";
import type { SendStaffAuditMessageInput } from "@/lib/staff-audit/staff-audit-types";
import { formatAltaUserHandle } from "@/lib/auth/user-display";
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

  return formatAltaUserHandle(user).slice(0, 100);
}

/** Build premium staff embed + plain-text fallback (single delivery payload). */
export function buildStaffAuditPremiumPayload(
  input: SendStaffAuditMessageInput & { actorLabel: string },
): {
  content: string;
  embed: Record<string, unknown>;
  components: Record<string, unknown>[];
} {
  const content = formatStaffAuditMessage(input);
  const productSource = staffAuditProductToSource(input.product);
  const details = sanitizeStaffAuditDetails(input.details);
  const eventType = input.eventType?.trim() || input.action;

  // Phase 7B — prefer typed Bank/Terminal product templates when flag is on.
  if (
    isDiscordProductPremiumEmbedsEnabled() &&
    (productSource === "bank" || productSource === "terminal")
  ) {
    const premium = buildProductPremiumNotification({
      eventType,
      audience: "staff",
      title: formatStaffAuditAction(input.action, input.source),
      body: details ?? content,
      linkUrl: input.internalUrl,
      correlationId: input.dedupeKey,
      severity: input.severity,
      metadata: {
        status: input.severity ?? undefined,
      },
    });
    if (premium) {
      // Keep Actor field for staff operational context.
      const fields = Array.isArray(premium.embed.fields)
        ? [...(premium.embed.fields as Array<Record<string, unknown>>)]
        : [];
      fields.unshift(
        { name: "Actor", value: input.actorLabel, inline: true },
        { name: "Product", value: input.product, inline: true },
      );
      return {
        content: premium.plainText.slice(0, 2000) || content,
        embed: { ...premium.embed, fields: fields.slice(0, 25) },
        components: premium.components,
      };
    }
  }

  try {
    const built = buildEventPremiumEmbed({
      eventType,
      product: productSource,
      severity: input.severity,
      title: formatStaffAuditAction(input.action, input.source),
      description: details ?? undefined,
      fields: [
        { name: "Actor", value: input.actorLabel, inline: true },
        { name: "Product", value: input.product, inline: true },
      ],
      linkUrl: input.internalUrl,
      correlationId: input.dedupeKey,
    });
    return {
      // Plain-text fallback for legacy paths; same message — never a second send.
      content: built.plainText.slice(0, 2000) || content,
      embed: built.embed,
      components: built.components,
    };
  } catch {
    return { content, embed: {}, components: [] };
  }
}

export async function sendStaffAuditMessageAsync(
  input: SendStaffAuditMessageInput,
): Promise<{ sent: boolean; reason?: string }> {
  if (shouldSkipDuplicate(input.dedupeKey)) {
    logStaffAudit("skipped duplicate", { dedupeKey: input.dedupeKey });
    return { sent: false, reason: "duplicate" };
  }

  const actorLabel = await resolveStaffAuditActorName(input.actorUserId, input.actorName);
  const premium = buildStaffAuditPremiumPayload({ ...input, actorLabel });
  const content = premium.content;
  const hasEmbed = Boolean(premium.embed && Object.keys(premium.embed).length > 0);

  const {
    enqueueStaffAuditOutbox,
    markDiscordOutboxSent,
    markDiscordOutboxDead,
    resolveProductOutboxIdempotencyKey,
  } = await import("@/server/discord-outbox.service");
  const {
    buildStaffAuditIdempotencyKey,
    resolveOutboxTargetBot,
    staffAuditProductToSource,
  } = await import("@/lib/discord/discord-event-envelope");
  const baseOutboxIdempotencyKey = buildStaffAuditIdempotencyKey(
    input.dedupeKey,
    `${input.action}:${input.actorUserId ?? "system"}`,
  );
  const productSourceEarly = staffAuditProductToSource(input.product);
  let earlyChannel: "staff_ops" | "security_audit" | "delivery_alert" = "staff_ops";
  if (isDiscordProductAwareRoutingEnabled() && input.eventType) {
    try {
      const def = resolveDiscordEventDefinition(input.eventType);
      if (
        def.channelClass === "security_audit" ||
        def.channelClass === "delivery_alert" ||
        def.channelClass === "staff_ops"
      ) {
        earlyChannel = def.channelClass;
      }
    } catch {
      /* keep staff_ops */
    }
  }
  const productTargetBot = resolveOutboxTargetBot({
    product: productSourceEarly,
    channelClass: earlyChannel,
    eventType: input.eventType?.trim() || input.action,
  });
  const outboxIdempotencyKey = resolveProductOutboxIdempotencyKey(
    baseOutboxIdempotencyKey,
    productTargetBot,
  );
  // Dual-write (feature-flagged): durable outbox beside unchanged Bank dispatch.
  // Phase 7A may also enqueue a Secretary audit destination (separate idempotency key).
  void enqueueStaffAuditOutbox({
    product: input.product,
    action: input.action,
    eventType: input.eventType,
    content,
    embed: hasEmbed ? premium.embed : undefined,
    components: hasEmbed ? premium.components : undefined,
    actorUserId: input.actorUserId,
    severity: input.severity,
    dedupeKey: input.dedupeKey,
    correlationId: input.dedupeKey,
    actorLabel,
    internalUrl: input.internalUrl,
  }).catch(() => {});

  const productSource = productSourceEarly;
  const channelClass = earlyChannel;

  const result = await dispatchStaffAuditDiscordMessage(content, {
    product: productSource,
    channelClass,
    embed: hasEmbed ? premium.embed : undefined,
    components: hasEmbed ? premium.components : undefined,
  });

  if (!result.sent) {
    logStaffAudit("Discord message not sent", {
      product: input.product,
      action: input.action,
      reason: result.reason,
    });
    const { recordStaffAuditMessageFailure } = await import(
      "@/server/notification-delivery-audit.service"
    );
    void recordStaffAuditMessageFailure({
      actorUserId: input.actorUserId,
      product: input.product,
      action: input.action,
      reason: result.reason ?? "not_sent",
      metadata: { dedupeKey: input.dedupeKey ?? null },
    });
    // Leave PENDING for outbox worker when channel/config may recover; permanent local skips go DEAD.
    if (
      result.reason === "duplicate" ||
      result.reason === "disabled" ||
      result.reason === "disabled_in_test"
    ) {
      void markDiscordOutboxDead(outboxIdempotencyKey, result.reason).catch(() => {});
    }
    return { sent: false, reason: result.reason };
  }

  void markDiscordOutboxSent(outboxIdempotencyKey).catch(() => {});
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
