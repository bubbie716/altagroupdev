import { randomUUID } from "node:crypto";
import type { DiscordOutbox, DiscordOutboxStatus, Prisma } from "@prisma/client";
import {
  buildCustomerDmIdempotencyKey,
  buildStaffAuditIdempotencyKey,
  resolveDiscordProductSource,
  resolveOutboxTargetBot,
  staffAuditProductToSource,
  type DiscordCustomerDmDisplayPayload,
  type DiscordEventEnvelope,
  type DiscordEventSeverity,
  type DiscordSafeDisplayPayload,
  type DiscordStaffAuditDisplayPayload,
  type DiscordTargetBot,
} from "@/lib/discord/discord-event-envelope";
import {
  isDiscordProductAwareRoutingEnabled,
  resolveDiscordEventDefinition,
} from "@/lib/discord/discord-event-registry";
import {
  buildDestinationIdempotencyKey,
  buildSecretaryCentralAuditDisplayPayload,
  isDiscordSecretaryAuditFanoutEnabled,
  planDiscordFanoutDestinations,
  type FanoutDestinationPlan,
} from "@/lib/discord/discord-secretary-audit-fanout";
import { prisma } from "@/server/db";

const DEFAULT_MAX_ATTEMPTS = 5;
/** Grace period so the primary Bank/Secretary dispatch path can finish before the worker claims the row. */
const PRIMARY_PATH_GRACE_MS = 2 * 60_000;
const RETRY_DELAYS_MS = [5 * 60_000, 15 * 60_000, 60 * 60_000, 4 * 60 * 60_000, 24 * 60 * 60_000];
const WORKER_BATCH_SIZE = 50;

const VALID_TARGET_BOTS = new Set<DiscordTargetBot>(["bank", "secretary", "terminal"]);

type OutboxHealthState = {
  lastSuccessfulPollAt: string | null;
  lastSuccessfulDeliveryAt: string | null;
  lastPollTargetBot: DiscordTargetBot | null;
  lastDeliveryLatencyMs: number | null;
  lastError: string | null;
  rateLimitHits: number;
};

const healthByBot: Record<DiscordTargetBot, OutboxHealthState> = {
  bank: {
    lastSuccessfulPollAt: null,
    lastSuccessfulDeliveryAt: null,
    lastPollTargetBot: null,
    lastDeliveryLatencyMs: null,
    lastError: null,
    rateLimitHits: 0,
  },
  secretary: {
    lastSuccessfulPollAt: null,
    lastSuccessfulDeliveryAt: null,
    lastPollTargetBot: null,
    lastDeliveryLatencyMs: null,
    lastError: null,
    rateLimitHits: 0,
  },
  terminal: {
    lastSuccessfulPollAt: null,
    lastSuccessfulDeliveryAt: null,
    lastPollTargetBot: null,
    lastDeliveryLatencyMs: null,
    lastError: null,
    rateLimitHits: 0,
  },
};

export function isDiscordOutboxDualWriteEnabled(): boolean {
  const raw = process.env.DISCORD_OUTBOX_DUAL_WRITE?.trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}

function logOutbox(message: string, meta?: Record<string, unknown>): void {
  if (process.env.NODE_ENV === "test") return;
  console.info(`[discord-outbox] ${message}`, meta ?? {});
}

function nextAttemptAt(attempts: number): Date {
  const delay = RETRY_DELAYS_MS[Math.min(attempts, RETRY_DELAYS_MS.length - 1)] ?? RETRY_DELAYS_MS.at(-1)!;
  return new Date(Date.now() + delay);
}

function truncateError(reason: string | undefined): string | null {
  if (!reason) return null;
  return reason.slice(0, 500);
}

export function assertValidTargetBot(targetBot: string): DiscordTargetBot {
  if (!VALID_TARGET_BOTS.has(targetBot as DiscordTargetBot)) {
    throw new Error(`invalid_target_bot:${targetBot}`);
  }
  return targetBot as DiscordTargetBot;
}

/** Prisma where-clause for due rows owned by a single target bot. */
export function buildDueOutboxWhere(
  targetBot: DiscordTargetBot,
  now: Date,
): Prisma.DiscordOutboxWhereInput {
  return {
    status: "PENDING",
    targetBot,
    OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
  };
}

/** Secretary must never deliver customer DM payloads. */
export function secretaryMayDeliverPayload(
  targetBot: DiscordTargetBot,
  payload: DiscordSafeDisplayPayload,
): { ok: true } | { ok: false; reason: string } {
  if (targetBot === "secretary" && payload.kind === "customer_dm") {
    return { ok: false, reason: "secretary_refuses_customer_dm" };
  }
  return { ok: true };
}

/** Terminal must never deliver customer DM payloads. */
export function terminalMayDeliverPayload(
  targetBot: DiscordTargetBot,
  payload: DiscordSafeDisplayPayload,
): { ok: true } | { ok: false; reason: string } {
  if (targetBot === "terminal" && payload.kind === "customer_dm") {
    return { ok: false, reason: "terminal_refuses_customer_dm" };
  }
  return { ok: true };
}

/** Shared staff-bot payload guard (Secretary + Terminal). */
export function staffBotMayDeliverPayload(
  targetBot: DiscordTargetBot,
  payload: DiscordSafeDisplayPayload,
): { ok: true } | { ok: false; reason: string } {
  const secretary = secretaryMayDeliverPayload(targetBot, payload);
  if (!secretary.ok) return secretary;
  const terminal = terminalMayDeliverPayload(targetBot, payload);
  if (!terminal.ok) return terminal;

  // Role management: each bot only processes its own product roles.
  if (payload.kind === "role_mgmt") {
    if (targetBot === "bank" && payload.productRole !== "bank_client") {
      return { ok: false, reason: "bank_refuses_foreign_role" };
    }
    if (targetBot === "terminal" && payload.productRole !== "terminal_investor") {
      return { ok: false, reason: "terminal_refuses_foreign_role" };
    }
    if (targetBot === "secretary" && payload.productRole !== "secretary_staff") {
      return { ok: false, reason: "secretary_refuses_foreign_role" };
    }
  }
  return { ok: true };
}

export type EnqueueDiscordOutboxInput = {
  envelope: Omit<DiscordEventEnvelope, "eventId" | "occurredAt" | "deliveryPolicy"> & {
    eventId?: string;
    occurredAt?: string;
    deliveryPolicy?: DiscordEventEnvelope["deliveryPolicy"];
  };
  /** When set, overrides the default primary-path grace for nextAttemptAt. */
  nextAttemptAt?: Date;
};

/**
 * Insert a durable outbox row when DISCORD_OUTBOX_DUAL_WRITE is enabled.
 * Never throws to callers — failures are logged and swallowed.
 */
export async function enqueueDiscordOutboxEvent(
  input: EnqueueDiscordOutboxInput,
): Promise<string | null> {
  if (!isDiscordOutboxDualWriteEnabled()) return null;

  const eventId = input.envelope.eventId?.trim() || randomUUID();
  const occurredAt = input.envelope.occurredAt ?? new Date().toISOString();
  const graceAt = input.nextAttemptAt ?? new Date(Date.now() + PRIMARY_PATH_GRACE_MS);

  try {
    const row = await prisma.discordOutbox.upsert({
      where: { idempotencyKey: input.envelope.idempotencyKey },
      create: {
        eventId,
        idempotencyKey: input.envelope.idempotencyKey,
        product: input.envelope.product,
        eventType: input.envelope.eventType,
        targetBot: input.envelope.targetBot,
        channelClass: input.envelope.channelClass,
        severity: input.envelope.severity ?? null,
        correlationId: input.envelope.correlationId ?? null,
        actorJson: (input.envelope.actor ?? undefined) as Prisma.InputJsonValue | undefined,
        subjectJson: (input.envelope.subject ?? undefined) as Prisma.InputJsonValue | undefined,
        displayPayload: input.envelope.displayPayload as Prisma.InputJsonValue,
        internalRef: (input.envelope.internalRef ?? undefined) as Prisma.InputJsonValue | undefined,
        deliveryPolicy: input.envelope.deliveryPolicy ?? "queued",
        status: "PENDING",
        maxAttempts: DEFAULT_MAX_ATTEMPTS,
        nextAttemptAt: graceAt,
      },
      update: {},
      select: { id: true, status: true },
    });
    return row.id;
  } catch (error) {
    logOutbox("enqueue failed", {
      idempotencyKey: input.envelope.idempotencyKey,
      eventType: input.envelope.eventType,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export type EnqueueDiscordFanoutInput = {
  baseIdempotencyKey: string;
  product: DiscordEventEnvelope["product"];
  eventType: string;
  channelClass: DiscordEventEnvelope["channelClass"];
  productTargetBot: DiscordTargetBot;
  displayPayload: DiscordSafeDisplayPayload;
  severity?: DiscordEventSeverity;
  correlationId?: string;
  actor?: DiscordEventEnvelope["actor"];
  subject?: DiscordEventEnvelope["subject"];
  internalRef?: DiscordEventEnvelope["internalRef"];
  deliveryPolicy?: DiscordEventEnvelope["deliveryPolicy"];
  /** Optional prebuilt Secretary audit payload (staff_audit only). */
  secretaryAuditPayload?: DiscordStaffAuditDisplayPayload;
  nextAttemptAt?: Date;
  eventId?: string;
};

export type EnqueueDiscordFanoutResult = {
  destinations: Array<{
    targetBot: DiscordTargetBot;
    role: FanoutDestinationPlan["role"];
    idempotencyKey: string;
    outboxId: string | null;
  }>;
};

/**
 * Phase 7A — enqueue one outbox row per destination bot.
 * Destination failures are independent; never throws.
 * When DISCORD_SECRETARY_AUDIT_FANOUT is off, creates a single legacy-keyed row.
 */
export async function enqueueDiscordFanout(
  input: EnqueueDiscordFanoutInput,
): Promise<EnqueueDiscordFanoutResult> {
  const plans = planDiscordFanoutDestinations({
    baseIdempotencyKey: input.baseIdempotencyKey,
    product: input.product,
    eventType: input.eventType,
    channelClass: input.channelClass,
    productTargetBot: input.productTargetBot,
    displayPayload: input.displayPayload,
    secretaryAuditPayload: input.secretaryAuditPayload,
  });

  const destinations: EnqueueDiscordFanoutResult["destinations"] = [];
  const sharedEventId = input.eventId?.trim() || randomUUID();

  for (const plan of plans) {
    // Independent try — one destination failure must not block others.
    let outboxId: string | null = null;
    try {
      outboxId = await enqueueDiscordOutboxEvent({
        envelope: {
          eventId:
            plan.role === "product"
              ? sharedEventId
              : `${sharedEventId}:secretary-audit`,
          idempotencyKey: plan.idempotencyKey,
          product: plan.product,
          eventType: input.eventType,
          actor: input.actor,
          subject: input.subject,
          severity: input.severity,
          correlationId: input.correlationId,
          displayPayload: plan.displayPayload,
          internalRef: input.internalRef,
          targetBot: plan.targetBot,
          channelClass: plan.channelClass,
          deliveryPolicy: input.deliveryPolicy ?? "queued",
        },
        nextAttemptAt: input.nextAttemptAt,
      });
    } catch (error) {
      logOutbox("fanout destination enqueue failed", {
        targetBot: plan.targetBot,
        idempotencyKey: plan.idempotencyKey,
        error: error instanceof Error ? error.message : String(error),
      });
      outboxId = null;
    }
    destinations.push({
      targetBot: plan.targetBot,
      role: plan.role,
      idempotencyKey: plan.idempotencyKey,
      outboxId,
    });
  }

  return { destinations };
}

/** Product-destination idempotency key for primary-path mark SENT/DEAD. */
export function resolveProductOutboxIdempotencyKey(
  baseIdempotencyKey: string,
  productTargetBot: DiscordTargetBot,
): string {
  if (!isDiscordSecretaryAuditFanoutEnabled()) return baseIdempotencyKey;
  return buildDestinationIdempotencyKey(baseIdempotencyKey, productTargetBot);
}

export async function markDiscordOutboxSent(idempotencyKey: string): Promise<void> {
  if (!isDiscordOutboxDualWriteEnabled()) return;
  const key = idempotencyKey.trim();
  if (!key) return;

  try {
    await prisma.discordOutbox.updateMany({
      where: {
        idempotencyKey: key,
        status: { in: ["PENDING", "PROCESSING", "FAILED"] },
      },
      data: {
        status: "SENT",
        deliveredAt: new Date(),
        lastError: null,
        nextAttemptAt: null,
      },
    });
  } catch (error) {
    logOutbox("mark SENT failed", {
      idempotencyKey: key,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/** Primary path handed retry to NotificationDeliveryQueue — worker must not deliver. */
export async function markDiscordOutboxHandedOff(
  idempotencyKey: string,
  reason?: string,
): Promise<void> {
  if (!isDiscordOutboxDualWriteEnabled()) return;
  const key = idempotencyKey.trim();
  if (!key) return;

  try {
    await prisma.discordOutbox.updateMany({
      where: {
        idempotencyKey: key,
        status: { in: ["PENDING", "PROCESSING", "FAILED"] },
      },
      data: {
        status: "HANDED_OFF",
        lastError: truncateError(reason),
        nextAttemptAt: null,
      },
    });
  } catch (error) {
    logOutbox("mark HANDED_OFF failed", {
      idempotencyKey: key,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function markDiscordOutboxDead(
  idempotencyKey: string,
  reason?: string,
): Promise<void> {
  if (!isDiscordOutboxDualWriteEnabled()) return;
  const key = idempotencyKey.trim();
  if (!key) return;

  try {
    await prisma.discordOutbox.updateMany({
      where: {
        idempotencyKey: key,
        status: { in: ["PENDING", "PROCESSING", "FAILED"] },
      },
      data: {
        status: "DEAD",
        lastError: truncateError(reason),
        nextAttemptAt: null,
      },
    });
  } catch (error) {
    logOutbox("mark DEAD failed", {
      idempotencyKey: key,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export type EnqueueCustomerDmOutboxInput = {
  notificationId: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  linkUrl?: string;
  linkLabel?: string;
  embedImageUrl?: string | null;
  actorUserId?: string;
  correlationId?: string;
};

export async function enqueueCustomerDmOutbox(
  input: EnqueueCustomerDmOutboxInput,
): Promise<string | null> {
  let product = resolveDiscordProductSource(input.type);
  let severity: DiscordEventSeverity | undefined;
  let deliveryPolicy: DiscordEventEnvelope["deliveryPolicy"] = "queued";
  if (isDiscordProductAwareRoutingEnabled()) {
    try {
      const def = resolveDiscordEventDefinition(input.type);
      product = def.product;
      severity = def.severity;
      deliveryPolicy = def.deliveryPolicy;
    } catch {
      /* resolveDiscordProductSource already handled / will throw when strict */
    }
  }
  const idempotencyKey = buildCustomerDmIdempotencyKey({
    userId: input.userId,
    type: input.type,
    notificationId: input.notificationId,
  });
  const displayPayload: DiscordCustomerDmDisplayPayload = {
    kind: "customer_dm",
    userId: input.userId,
    title: input.title.slice(0, 256),
    body: input.body.slice(0, 4096),
    linkUrl: input.linkUrl,
    linkLabel: input.linkLabel,
    embedImageUrl: input.embedImageUrl,
    notificationId: input.notificationId,
    eventType: input.type,
  };

  // Phase 7B — attach optional premium embed onto outbox row when flag is on.
  try {
    const { buildNotificationDmPayload } = await import("@/lib/discord/notification-dm");
    const built = buildNotificationDmPayload({
      title: input.title,
      body: input.body,
      linkUrl: input.linkUrl,
      linkLabel: input.linkLabel,
      embedImageUrl: input.embedImageUrl,
      eventType: input.type,
      correlationId: input.notificationId,
    });
    if (built.plainTextFallback) {
      displayPayload.embed = built.embed;
      displayPayload.components = built.components;
    }
  } catch {
    /* keep title/body-only payload */
  }

  const result = await enqueueDiscordFanout({
    baseIdempotencyKey: idempotencyKey,
    product,
    eventType: input.type,
    channelClass: "customer_dm",
    productTargetBot: resolveOutboxTargetBot({
      product,
      channelClass: "customer_dm",
      eventType: input.type,
    }),
    displayPayload,
    severity,
    correlationId: input.correlationId ?? input.notificationId,
    actor: input.actorUserId ? { userId: input.actorUserId } : { userId: input.userId },
    subject: { userId: input.userId, entityType: "USER_NOTIFICATION", entityId: input.notificationId },
    internalRef: {
      notificationId: input.notificationId,
      entityType: "USER_NOTIFICATION",
      entityId: input.notificationId,
    },
    deliveryPolicy,
  });

  const productDest = result.destinations.find((d) => d.role === "product");
  return productDest?.outboxId ?? null;
}

export type EnqueueStaffAuditOutboxInput = {
  product: string;
  action: string;
  /** Raw audit action for registry lookup (e.g. TERMINAL_CRYPTO_ORDER_FILLED). */
  eventType?: string;
  content: string;
  /** Optional premium embed — single message with plain-text fallback, never a second send. */
  embed?: Record<string, unknown>;
  components?: Record<string, unknown>[];
  actorUserId?: string;
  severity?: DiscordEventSeverity;
  dedupeKey?: string;
  correlationId?: string;
  actorLabel?: string;
  entityType?: string;
  entityId?: string;
  internalUrl?: string;
};

export async function enqueueStaffAuditOutbox(
  input: EnqueueStaffAuditOutboxInput,
): Promise<string | null> {
  let product = staffAuditProductToSource(input.product);
  let channelClass: DiscordEventEnvelope["channelClass"] = "staff_ops";
  let severity = input.severity;
  let deliveryPolicy: DiscordEventEnvelope["deliveryPolicy"] = "queued";
  const eventType = input.eventType?.trim() || input.action;
  if (isDiscordProductAwareRoutingEnabled()) {
    try {
      const def = resolveDiscordEventDefinition(eventType);
      product = def.product;
      channelClass = def.channelClass === "customer_dm" ? "staff_ops" : def.channelClass;
      severity = severity ?? def.severity;
      deliveryPolicy = def.deliveryPolicy;
    } catch {
      /* keep product from staff label */
    }
  }
  const idempotencyKey = buildStaffAuditIdempotencyKey(
    input.dedupeKey,
    `${input.action}:${input.correlationId ?? "unknown"}`,
  );
  const displayPayload: DiscordStaffAuditDisplayPayload = {
    kind: "staff_audit",
    content: input.content.slice(0, 2000),
    product: input.product,
    action: input.action,
    embed: input.embed,
    components: input.components,
  };

  const productTargetBot = resolveOutboxTargetBot({
    product,
    channelClass,
    eventType,
  });

  const secretaryAuditPayload = buildSecretaryCentralAuditDisplayPayload({
    originalProduct: product,
    eventType,
    action: input.action,
    severity,
    actorLabel: input.actorLabel,
    entityType: input.entityType,
    entityId: input.entityId,
    correlationId: input.correlationId ?? input.dedupeKey,
    internalUrl: input.internalUrl,
    redactedContent: input.content,
    originalDestinationBot: productTargetBot,
    originalChannelClass: channelClass,
  });

  const result = await enqueueDiscordFanout({
    baseIdempotencyKey: idempotencyKey,
    product,
    eventType,
    channelClass,
    productTargetBot,
    displayPayload,
    secretaryAuditPayload,
    severity,
    correlationId: input.correlationId ?? input.dedupeKey,
    actor: input.actorUserId ? { userId: input.actorUserId } : undefined,
    internalRef: {
      auditAction: input.action,
      entityType: input.entityType ?? "STAFF_AUDIT",
      entityId: input.entityId,
    },
    deliveryPolicy,
  });

  const productDest = result.destinations.find((d) => d.role === "product");
  return productDest?.outboxId ?? null;
}

function parseDisplayPayload(raw: unknown): DiscordSafeDisplayPayload | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if (obj.kind === "customer_dm" && typeof obj.userId === "string" && typeof obj.title === "string") {
    return {
      kind: "customer_dm",
      userId: obj.userId,
      title: obj.title,
      body: typeof obj.body === "string" ? obj.body : "",
      linkUrl: typeof obj.linkUrl === "string" ? obj.linkUrl : undefined,
      linkLabel: typeof obj.linkLabel === "string" ? obj.linkLabel : undefined,
      embedImageUrl: typeof obj.embedImageUrl === "string" ? obj.embedImageUrl : null,
      notificationId: typeof obj.notificationId === "string" ? obj.notificationId : undefined,
      eventType: typeof obj.eventType === "string" ? obj.eventType : undefined,
      embed:
        obj.embed && typeof obj.embed === "object" && !Array.isArray(obj.embed)
          ? (obj.embed as Record<string, unknown>)
          : undefined,
      components: Array.isArray(obj.components)
        ? (obj.components as Record<string, unknown>[])
        : undefined,
    };
  }
  if (obj.kind === "staff_audit" && typeof obj.content === "string") {
    return {
      kind: "staff_audit",
      content: obj.content,
      product: typeof obj.product === "string" ? obj.product : undefined,
      action: typeof obj.action === "string" ? obj.action : undefined,
      embed:
        obj.embed && typeof obj.embed === "object" && !Array.isArray(obj.embed)
          ? (obj.embed as Record<string, unknown>)
          : undefined,
      components: Array.isArray(obj.components)
        ? (obj.components as Record<string, unknown>[])
        : undefined,
    };
  }
  if (
    obj.kind === "role_mgmt" &&
    typeof obj.discordUserId === "string" &&
    typeof obj.roleId === "string" &&
    typeof obj.productRole === "string" &&
    typeof obj.action === "string"
  ) {
    const productRole = obj.productRole;
    const action = obj.action;
    if (
      productRole !== "bank_client" &&
      productRole !== "terminal_investor" &&
      productRole !== "secretary_staff"
    ) {
      return null;
    }
    if (action !== "grant" && action !== "revoke" && action !== "reconcile") return null;
    return {
      kind: "role_mgmt",
      action,
      productRole,
      discordUserId: obj.discordUserId,
      roleId: obj.roleId,
      altaUserId: typeof obj.altaUserId === "string" ? obj.altaUserId : undefined,
      reason: typeof obj.reason === "string" ? obj.reason : undefined,
      expectedHasRole: typeof obj.expectedHasRole === "boolean" ? obj.expectedHasRole : undefined,
    };
  }
  return null;
}

export type DiscordOutboxDeliveryDeps = {
  dispatchCustomerDm: (input: {
    userId: string;
    title: string;
    body: string;
    linkUrl?: string;
    linkLabel?: string;
    embedImageUrl?: string | null;
    eventType?: string | null;
  }) => Promise<{ sent: boolean; reason?: string }>;
  dispatchStaffAudit: (
    content: string,
    options?: {
      product?: string;
      channelClass?: string;
      embed?: Record<string, unknown>;
      components?: Record<string, unknown>[];
    },
  ) => Promise<{ sent: boolean; reason?: string }>;
  dispatchRoleMgmt?: (
    payload: Extract<DiscordSafeDisplayPayload, { kind: "role_mgmt" }>,
  ) => Promise<{ sent: boolean; reason?: string }>;
};

function roleMgmtDispatcher(requiredTargetBot: DiscordTargetBot) {
  return async (
    payload: Extract<DiscordSafeDisplayPayload, { kind: "role_mgmt" }>,
  ): Promise<{ sent: boolean; reason?: string }> => {
    const { applyDiscordProductRole } = await import("@/server/discord-product-role.service");
    const result = await applyDiscordProductRole({
      productRole: payload.productRole,
      action: payload.action,
      discordUserId: payload.discordUserId,
      altaUserId: payload.altaUserId,
      reason: payload.reason,
      expectedHasRole: payload.expectedHasRole,
      requiredTargetBot,
    });
    if (result.ok) return { sent: true, reason: result.reason };
    return {
      sent: false,
      reason: result.retryable ? `retryable:${result.reason}` : result.reason,
    };
  };
}

async function bankDeliveryDeps(): Promise<DiscordOutboxDeliveryDeps> {
  const { dispatchNotificationDm } = await import("@/server/notification-discord-dispatch.service");
  const { dispatchStaffAuditDiscordMessage } = await import(
    "@/server/staff-audit-discord-dispatch.service"
  );
  return {
    dispatchCustomerDm: dispatchNotificationDm,
    dispatchStaffAudit: async (content, options) => {
      const productLabel = options?.product;
      const product = productLabel ? staffAuditProductToSource(productLabel) : "bank";
      return dispatchStaffAuditDiscordMessage(content, {
        product,
        channelClass:
          options?.channelClass === "security_audit" ||
          options?.channelClass === "delivery_alert" ||
          options?.channelClass === "staff_ops" ||
          options?.channelClass === "role_mgmt"
            ? options.channelClass
            : "staff_ops",
        embed: options?.embed,
        components: options?.components,
      });
    },
    dispatchRoleMgmt: roleMgmtDispatcher("bank"),
  };
}

async function secretaryDeliveryDeps(): Promise<DiscordOutboxDeliveryDeps> {
  const { dispatchSecretaryStaffMessage } = await import(
    "@/server/secretary-discord-dispatch.service"
  );
  return {
    dispatchCustomerDm: async () => ({
      sent: false,
      reason: "secretary_refuses_customer_dm",
    }),
    dispatchStaffAudit: async (content, options) => {
      const productLabel = options?.product;
      const product = productLabel ? staffAuditProductToSource(productLabel) : "secretary";
      const channelClass =
        options?.channelClass === "security_audit" ||
        options?.channelClass === "delivery_alert" ||
        options?.channelClass === "staff_ops"
          ? options.channelClass
          : "staff_ops";
      return dispatchSecretaryStaffMessage(content, {
        product,
        channelClass,
        embed: options?.embed,
        components: options?.components,
      });
    },
    dispatchRoleMgmt: roleMgmtDispatcher("secretary"),
  };
}

async function terminalDeliveryDeps(): Promise<DiscordOutboxDeliveryDeps> {
  const { dispatchTerminalStaffMessage } = await import(
    "@/server/terminal-discord-dispatch.service"
  );
  return {
    dispatchCustomerDm: async () => ({
      sent: false,
      reason: "terminal_refuses_customer_dm",
    }),
    dispatchStaffAudit: async (content, options) => {
      const productLabel = options?.product;
      const product = productLabel ? staffAuditProductToSource(productLabel) : "terminal";
      const channelClass =
        options?.channelClass === "security_audit" ||
        options?.channelClass === "delivery_alert" ||
        options?.channelClass === "staff_ops"
          ? options.channelClass
          : "staff_ops";
      return dispatchTerminalStaffMessage(content, {
        product,
        channelClass,
        embed: options?.embed,
        components: options?.components,
      });
    },
    dispatchRoleMgmt: roleMgmtDispatcher("terminal"),
  };
}

async function defaultDeliveryDepsForBot(targetBot: DiscordTargetBot): Promise<DiscordOutboxDeliveryDeps> {
  if (targetBot === "secretary") return secretaryDeliveryDeps();
  if (targetBot === "terminal") return terminalDeliveryDeps();
  return bankDeliveryDeps();
}

/** Deliver a single outbox row. Exported for unit tests. */
export async function deliverDiscordOutboxPayload(
  payload: DiscordSafeDisplayPayload,
  deps: DiscordOutboxDeliveryDeps,
  options?: { channelClass?: string; product?: string },
): Promise<{ sent: boolean; reason?: string }> {
  if (payload.kind === "customer_dm") {
    return deps.dispatchCustomerDm({
      userId: payload.userId,
      title: payload.title,
      body: payload.body,
      linkUrl: payload.linkUrl,
      linkLabel: payload.linkLabel,
      embedImageUrl: payload.embedImageUrl,
      eventType: payload.eventType,
    });
  }
  if (payload.kind === "role_mgmt") {
    if (!deps.dispatchRoleMgmt) {
      return { sent: false, reason: "role_mgmt_not_supported" };
    }
    return deps.dispatchRoleMgmt(payload);
  }
  return deps.dispatchStaffAudit(payload.content, {
    product: options?.product ?? payload.product,
    channelClass: options?.channelClass,
    embed: payload.kind === "staff_audit" ? payload.embed : undefined,
    components: payload.kind === "staff_audit" ? payload.components : undefined,
  });
}

export type DiscordOutboxWorkerStore = {
  findDueIds: (targetBot: DiscordTargetBot, now: Date) => Promise<string[]>;
  claim: (id: string, targetBot: DiscordTargetBot) => Promise<DiscordOutbox | null>;
  markDeadInvalid: (row: DiscordOutbox, reason: string) => Promise<void>;
  finalize: (
    row: DiscordOutbox,
    result: { sent: boolean; reason?: string },
  ) => Promise<"sent" | "requeued" | "dead">;
};

async function claimOutboxRowForBot(
  id: string,
  targetBot: DiscordTargetBot,
): Promise<DiscordOutbox | null> {
  const claimed = await prisma.discordOutbox.updateMany({
    where: { id, status: "PENDING", targetBot },
    data: { status: "PROCESSING" },
  });
  if (claimed.count === 0) return null;
  return prisma.discordOutbox.findUnique({ where: { id } });
}

async function finalizeOutboxAttempt(
  row: DiscordOutbox,
  result: { sent: boolean; reason?: string },
): Promise<"sent" | "requeued" | "dead"> {
  if (result.sent) {
    await prisma.discordOutbox.update({
      where: { id: row.id },
      data: {
        status: "SENT",
        deliveredAt: new Date(),
        lastError: null,
        nextAttemptAt: null,
        attempts: row.attempts + 1,
      },
    });
    return "sent";
  }

  const attempts = row.attempts + 1;
  const reason = truncateError(result.reason ?? "not_sent");
  const isRateLimit =
    typeof result.reason === "string" &&
    (result.reason.includes("429") || result.reason.toLowerCase().includes("rate"));

  if (isRateLimit) {
    const bot = assertValidTargetBot(row.targetBot);
    healthByBot[bot].rateLimitHits += 1;
  }

  if (attempts >= row.maxAttempts) {
    await prisma.discordOutbox.update({
      where: { id: row.id },
      data: {
        status: "DEAD",
        attempts,
        lastError: reason,
        nextAttemptAt: null,
      },
    });
    return "dead";
  }

  await prisma.discordOutbox.update({
    where: { id: row.id },
    data: {
      status: "PENDING",
      attempts,
      lastError: reason,
      nextAttemptAt: nextAttemptAt(attempts),
    },
  });
  return "requeued";
}

function prismaWorkerStore(): DiscordOutboxWorkerStore {
  return {
    findDueIds: async (targetBot, now) => {
      const due = await prisma.discordOutbox.findMany({
        where: buildDueOutboxWhere(targetBot, now),
        orderBy: { createdAt: "asc" },
        take: WORKER_BATCH_SIZE,
        select: { id: true },
      });
      return due.map((row) => row.id);
    },
    claim: claimOutboxRowForBot,
    markDeadInvalid: async (row, reason) => {
      await prisma.discordOutbox.update({
        where: { id: row.id },
        data: {
          status: "DEAD",
          attempts: row.attempts + 1,
          lastError: reason,
          nextAttemptAt: null,
        },
      });
    },
    finalize: finalizeOutboxAttempt,
  };
}

export type ProcessDiscordOutboxResult = {
  targetBot: DiscordTargetBot;
  processed: number;
  sent: number;
  requeued: number;
  dead: number;
  skipped: number;
};

/**
 * Process due PENDING outbox rows for a single target bot.
 * Bank workers never claim Secretary/Terminal rows; Secretary never claims Bank/Terminal.
 */
export async function processDiscordOutboxForBot(
  targetBot: DiscordTargetBot,
  now: Date = new Date(),
  deps?: DiscordOutboxDeliveryDeps,
  store?: DiscordOutboxWorkerStore,
): Promise<ProcessDiscordOutboxResult> {
  const bot = assertValidTargetBot(targetBot);
  const result: ProcessDiscordOutboxResult = {
    targetBot: bot,
    processed: 0,
    sent: 0,
    requeued: 0,
    dead: 0,
    skipped: 0,
  };

  const worker = store ?? prismaWorkerStore();

  let dueIds: string[];
  try {
    dueIds = await worker.findDueIds(bot, now);
    healthByBot[bot].lastSuccessfulPollAt = new Date().toISOString();
    healthByBot[bot].lastPollTargetBot = bot;
    healthByBot[bot].lastError = null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    healthByBot[bot].lastError = truncateError(message);
    logOutbox("process findMany failed", { targetBot: bot, error: message });
    return result;
  }

  if (dueIds.length === 0) return result;

  const delivery = deps ?? (await defaultDeliveryDepsForBot(bot));

  for (const id of dueIds) {
    const row = await worker.claim(id, bot);
    if (!row) {
      result.skipped += 1;
      continue;
    }

    // Defense in depth — never process a row claimed for the wrong bot.
    if (row.targetBot !== bot) {
      result.skipped += 1;
      logOutbox("skipped cross-bot claim", {
        id: row.id,
        rowTargetBot: row.targetBot,
        workerBot: bot,
      });
      await worker.finalize(row, { sent: false, reason: "cross_bot_isolation" }).catch(() => {});
      continue;
    }

    result.processed += 1;
    const payload = parseDisplayPayload(row.displayPayload);
    if (!payload) {
      await worker.markDeadInvalid(row, "invalid_display_payload");
      result.dead += 1;
      continue;
    }

    const guard = staffBotMayDeliverPayload(bot, payload);
    if (!guard.ok) {
      await worker.markDeadInvalid(row, guard.reason);
      result.dead += 1;
      continue;
    }

    const started = Date.now();
    let deliveryResult: { sent: boolean; reason?: string };
    try {
      deliveryResult = await deliverDiscordOutboxPayload(payload, delivery, {
        channelClass: row.channelClass,
        product: payload.kind === "staff_audit" ? payload.product : undefined,
      });
    } catch (error) {
      deliveryResult = {
        sent: false,
        reason: error instanceof Error ? error.message : String(error),
      };
    }

    const outcome = await worker.finalize(row, deliveryResult);
    if (outcome === "sent") {
      result.sent += 1;
      healthByBot[bot].lastSuccessfulDeliveryAt = new Date().toISOString();
      healthByBot[bot].lastDeliveryLatencyMs = Date.now() - started;
    } else if (outcome === "requeued") {
      result.requeued += 1;
      healthByBot[bot].lastError = truncateError(deliveryResult.reason);
    } else {
      result.dead += 1;
      healthByBot[bot].lastError = truncateError(deliveryResult.reason);
    }
  }

  return result;
}

/**
 * Backward-compatible Bank-only worker entrypoint.
 * Prefer processDiscordOutboxForBot("bank" | "secretary" | "terminal").
 */
export async function processDiscordOutbox(
  now: Date = new Date(),
  deps?: DiscordOutboxDeliveryDeps,
  store?: DiscordOutboxWorkerStore,
): Promise<ProcessDiscordOutboxResult> {
  return processDiscordOutboxForBot("bank", now, deps, store);
}

/** Run Bank + Secretary + Terminal workers (operational-controls). */
export async function processDiscordOutboxAllBots(
  now: Date = new Date(),
): Promise<{
  bank: ProcessDiscordOutboxResult;
  secretary: ProcessDiscordOutboxResult;
  terminal: ProcessDiscordOutboxResult;
  staleRecovered: number;
}> {
  const { recoverStaleDiscordOutboxProcessing } = await import(
    "@/server/discord-outbox-ops.service"
  );
  const staleRecovered = await recoverStaleDiscordOutboxProcessing(now);
  const [bank, secretary, terminal] = await Promise.all([
    processDiscordOutboxForBot("bank", now),
    processDiscordOutboxForBot("secretary", now),
    processDiscordOutboxForBot("terminal", now),
  ]);
  return { bank, secretary, terminal, staleRecovered };
}

export type DiscordOutboxHealthSnapshot = {
  byBot: Record<
    DiscordTargetBot,
    OutboxHealthState & {
      pending: number | null;
      processing: number | null;
      sent: number | null;
      failed: number | null;
      dead: number | null;
    }
  >;
  /** Role-management outbox counts by owning bot (channelClass=role_mgmt). */
  roleMgmtByBot: Record<
    DiscordTargetBot,
    {
      pending: number | null;
      processing: number | null;
      sent: number | null;
      failed: number | null;
      dead: number | null;
    }
  >;
  secretaryConfigured: boolean;
  secretaryDeliveryEnabled: boolean;
  terminalConfigured: boolean;
  terminalDeliveryEnabled: boolean;
  /** Phase 7A — central Secretary audit fan-out. */
  secretaryAuditFanoutEnabled: boolean;
  fanout: {
    /** Outbox rows whose idempotency key includes `:destination:`. */
    destinationSuffixedPending: number | null;
    destinationSuffixedFailed: number | null;
    destinationSuffixedDead: number | null;
  };
};

type BotStatusCounts = {
  pending: number;
  processing: number;
  sent: number;
  failed: number;
  dead: number;
};

function emptyBotCounts(): Record<DiscordTargetBot, BotStatusCounts> {
  return {
    bank: { pending: 0, processing: 0, sent: 0, failed: 0, dead: 0 },
    secretary: { pending: 0, processing: 0, sent: 0, failed: 0, dead: 0 },
    terminal: { pending: 0, processing: 0, sent: 0, failed: 0, dead: 0 },
  };
}

function nullBotCounts(): Record<
  DiscordTargetBot,
  {
    pending: null;
    processing: null;
    sent: null;
    failed: null;
    dead: null;
  }
> {
  return {
    bank: { pending: null, processing: null, sent: null, failed: null, dead: null },
    secretary: { pending: null, processing: null, sent: null, failed: null, dead: null },
    terminal: { pending: null, processing: null, sent: null, failed: null, dead: null },
  };
}

function applyStatusCount(bucket: BotStatusCounts, status: string, n: number): void {
  if (status === "PENDING") bucket.pending += n;
  else if (status === "PROCESSING") bucket.processing += n;
  else if (status === "SENT") bucket.sent += n;
  else if (status === "FAILED") bucket.failed += n;
  else if (status === "DEAD") bucket.dead += n;
}

export async function getDiscordOutboxHealthSnapshot(): Promise<DiscordOutboxHealthSnapshot> {
  const {
    isDiscordSecretaryDeliveryEnabled,
    isDiscordTerminalDeliveryEnabled,
  } = await import("@/lib/discord/discord-event-envelope");
  const { isSecretaryDiscordConfigured } = await import(
    "@/server/secretary-discord-dispatch.service"
  );
  const { isTerminalDiscordConfigured } = await import(
    "@/server/terminal-discord-dispatch.service"
  );

  const counts = emptyBotCounts();
  const roleMgmtCounts = emptyBotCounts();
  const fanoutCounts = { pending: 0, failed: 0, dead: 0 };
  const secretaryConfigured = isSecretaryDiscordConfigured();
  const fanoutEnabled = isDiscordSecretaryAuditFanoutEnabled();

  try {
    const groups = await prisma.discordOutbox.groupBy({
      by: ["targetBot", "status"],
      _count: { _all: true },
      where: { status: { in: ["PENDING", "FAILED", "DEAD", "PROCESSING", "SENT"] } },
    });
    for (const group of groups) {
      const bot = VALID_TARGET_BOTS.has(group.targetBot as DiscordTargetBot)
        ? (group.targetBot as DiscordTargetBot)
        : null;
      if (!bot) continue;
      applyStatusCount(counts[bot], group.status, group._count._all);
    }

    const roleGroups = await prisma.discordOutbox.groupBy({
      by: ["targetBot", "status"],
      _count: { _all: true },
      where: {
        channelClass: "role_mgmt",
        status: { in: ["PENDING", "FAILED", "DEAD", "PROCESSING", "SENT"] },
      },
    });
    for (const group of roleGroups) {
      const bot = VALID_TARGET_BOTS.has(group.targetBot as DiscordTargetBot)
        ? (group.targetBot as DiscordTargetBot)
        : null;
      if (!bot) continue;
      applyStatusCount(roleMgmtCounts[bot], group.status, group._count._all);
    }

    const fanoutRows = await prisma.discordOutbox.findMany({
      where: {
        idempotencyKey: { contains: ":destination:" },
        status: { in: ["PENDING", "FAILED", "DEAD", "PROCESSING"] },
      },
      select: { status: true },
      take: 5000,
    });
    for (const row of fanoutRows) {
      if (row.status === "PENDING" || row.status === "PROCESSING") fanoutCounts.pending += 1;
      else if (row.status === "FAILED") fanoutCounts.failed += 1;
      else if (row.status === "DEAD") fanoutCounts.dead += 1;
    }
  } catch {
    const nullCounts = nullBotCounts();
    return {
      byBot: {
        bank: { ...healthByBot.bank, ...nullCounts.bank },
        secretary: { ...healthByBot.secretary, ...nullCounts.secretary },
        terminal: { ...healthByBot.terminal, ...nullCounts.terminal },
      },
      roleMgmtByBot: nullCounts,
      secretaryConfigured,
      secretaryDeliveryEnabled: isDiscordSecretaryDeliveryEnabled(),
      terminalConfigured: isTerminalDiscordConfigured(),
      terminalDeliveryEnabled: isDiscordTerminalDeliveryEnabled(),
      secretaryAuditFanoutEnabled: fanoutEnabled,
      fanout: {
        destinationSuffixedPending: null,
        destinationSuffixedFailed: null,
        destinationSuffixedDead: null,
      },
    };
  }

  // Never report Secretary fan-out as healthy when unconfigured while the flag is on.
  if (fanoutEnabled && !secretaryConfigured && healthByBot.secretary.lastError == null) {
    healthByBot.secretary.lastError = "secretary_unconfigured_fanout_fail_closed";
  }

  return {
    byBot: {
      bank: { ...healthByBot.bank, ...counts.bank },
      secretary: { ...healthByBot.secretary, ...counts.secretary },
      terminal: { ...healthByBot.terminal, ...counts.terminal },
    },
    roleMgmtByBot: roleMgmtCounts,
    secretaryConfigured,
    secretaryDeliveryEnabled: isDiscordSecretaryDeliveryEnabled(),
    terminalConfigured: isTerminalDiscordConfigured(),
    terminalDeliveryEnabled: isDiscordTerminalDeliveryEnabled(),
    secretaryAuditFanoutEnabled: fanoutEnabled,
    fanout: {
      destinationSuffixedPending: fanoutCounts.pending,
      destinationSuffixedFailed: fanoutCounts.failed,
      destinationSuffixedDead: fanoutCounts.dead,
    },
  };
}

/** Test helper — reset in-memory health counters. */
export function resetDiscordOutboxHealthForTests(): void {
  for (const bot of VALID_TARGET_BOTS) {
    healthByBot[bot] = {
      lastSuccessfulPollAt: null,
      lastSuccessfulDeliveryAt: null,
      lastPollTargetBot: null,
      lastDeliveryLatencyMs: null,
      lastError: null,
      rateLimitHits: 0,
    };
  }
}

/** Test helper — status type re-export. */
export type { DiscordOutboxStatus };
