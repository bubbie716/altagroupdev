/**
 * Shared Discord event envelope for the multi-bot outbox.
 * Phase 4: Secretary-owned staff streams can target the Secretary bot worker;
 * Terminal-owned staff streams can target the Terminal bot when enabled;
 * customer DMs always stay on the Bank delivery path.
 */

import {
  isDiscordProductAwareRoutingEnabled,
  resolveDiscordEventDefinition,
  UnknownDiscordEventError,
} from "@/lib/discord/discord-event-registry";

export type DiscordProductSource = "secretary" | "bank" | "terminal" | "corporate" | "ops";

export type DiscordTargetBot = "secretary" | "bank" | "terminal";

export type DiscordChannelClass =
  | "customer_dm"
  | "staff_ops"
  | "security_audit"
  | "delivery_alert"
  | "role_mgmt";

export type DiscordEventSeverity = "INFO" | "ACTION" | "WARNING" | "CRITICAL";

export type DiscordDeliveryPolicy = "immediate" | "queued" | "best_effort";

export type DiscordEventActor = {
  userId?: string;
  label?: string;
};

export type DiscordEventSubject = {
  entityType?: string;
  entityId?: string;
  userId?: string;
};

/** Safe fields only — never tokens, secrets, or full internal notes. */
export type DiscordCustomerDmDisplayPayload = {
  kind: "customer_dm";
  userId: string;
  title: string;
  body: string;
  linkUrl?: string;
  linkLabel?: string;
  embedImageUrl?: string | null;
  notificationId?: string;
  eventType?: string;
};

export type DiscordStaffAuditDisplayPayload = {
  kind: "staff_audit";
  content: string;
  product?: string;
  action?: string;
  /** Optional premium embed (API-shaped). Plain content remains the fallback. */
  embed?: Record<string, unknown>;
  components?: Record<string, unknown>[];
};

export type DiscordRoleMgmtDisplayPayload = {
  kind: "role_mgmt";
  action: "grant" | "revoke" | "reconcile";
  productRole: "bank_client" | "terminal_investor" | "secretary_staff";
  discordUserId: string;
  roleId: string;
  altaUserId?: string;
  reason?: string;
  expectedHasRole?: boolean;
};

export type DiscordSafeDisplayPayload =
  | DiscordCustomerDmDisplayPayload
  | DiscordStaffAuditDisplayPayload
  | DiscordRoleMgmtDisplayPayload;

export type DiscordInternalRef = {
  entityType?: string;
  entityId?: string;
  notificationId?: string;
  auditAction?: string;
};

export type DiscordEventEnvelope = {
  eventId: string;
  idempotencyKey: string;
  product: DiscordProductSource;
  eventType: string;
  actor?: DiscordEventActor;
  subject?: DiscordEventSubject;
  severity?: DiscordEventSeverity;
  occurredAt: string;
  correlationId?: string;
  displayPayload: DiscordSafeDisplayPayload;
  internalRef?: DiscordInternalRef;
  targetBot: DiscordTargetBot;
  channelClass: DiscordChannelClass;
  deliveryPolicy: DiscordDeliveryPolicy;
};

/** Map a notification / audit type string to a product source (legacy heuristic). */
export function resolveDiscordProductSourceLegacy(eventType: string): DiscordProductSource {
  const type = eventType.trim().toUpperCase();
  if (type.startsWith("TERMINAL_")) return "terminal";
  if (
    type.startsWith("MAINTENANCE") ||
    type.startsWith("CREDIT_DESK") ||
    type.startsWith("OPS_") ||
    type.startsWith("USER_") ||
    type === "INTERNAL_NOTE_ADDED"
  ) {
    return "ops";
  }
  if (type.startsWith("COMPANY_") || type === "BUSINESS_ACCOUNT_OPENED") return "corporate";
  return "bank";
}

/**
 * Resolve product for outbox rows.
 * When product-aware routing is on, uses the authoritative registry (throws on unknown in strict mode).
 */
export function resolveDiscordProductSource(eventType: string): DiscordProductSource {
  if (!isDiscordProductAwareRoutingEnabled()) {
    return resolveDiscordProductSourceLegacy(eventType);
  }
  try {
    return resolveDiscordEventDefinition(eventType).product;
  } catch (error) {
    if (error instanceof UnknownDiscordEventError) throw error;
    return resolveDiscordProductSourceLegacy(eventType);
  }
}

/** Phase 2: delivery always used the Bank bot worker. */
export function resolvePhase2DeliveryBot(_product: DiscordProductSource): DiscordTargetBot {
  return "bank";
}

/** When true, Secretary-owned staff/outbox rows claim via the Secretary worker. */
export function isDiscordSecretaryDeliveryEnabled(): boolean {
  const raw = process.env.DISCORD_SECRETARY_DELIVERY?.trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}

/** When true, Terminal-owned staff/outbox rows claim via the Terminal worker. */
export function isDiscordTerminalDeliveryEnabled(): boolean {
  const raw = process.env.DISCORD_TERMINAL_DELIVERY?.trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}

export type ResolveOutboxTargetBotInput = {
  product: DiscordProductSource;
  channelClass: DiscordChannelClass;
  eventType?: string;
  /**
   * Explicit Terminal cutover for a single enqueue. When true, records
   * targetBot=terminal (neither Bank nor Secretary workers will claim the row).
   */
  explicitTerminalBot?: boolean;
};

/**
 * Resolve which outbox worker may claim this row (Phase 4/5).
 *
 * Rules:
 * - customer_dm → always bank (Terminal/Secretary never send customer DMs)
 * - role_mgmt → owning product bot (bank / terminal / secretary)
 * - Terminal staff when DISCORD_TERMINAL_DELIVERY on → terminal (fail closed; no Bank fallback)
 * - Secretary staff when DISCORD_SECRETARY_DELIVERY on → secretary
 * - otherwise → bank (legacy / rollback)
 */
export function resolveOutboxTargetBot(input: ResolveOutboxTargetBotInput): DiscordTargetBot {
  // Customer DMs always Bank — Terminal/Secretary never send customer financial DMs.
  if (input.channelClass === "customer_dm") return "bank";
  if (input.explicitTerminalBot) return "terminal";

  // Phase 5 role management — route by product ownership (never cross-product).
  if (input.channelClass === "role_mgmt") {
    if (input.product === "terminal") return "terminal";
    if (input.product === "secretary" || input.product === "ops" || input.product === "corporate") {
      return isDiscordSecretaryDeliveryEnabled() ? "secretary" : "bank";
    }
    return "bank";
  }

  // Terminal staff cutover — no Bank/Secretary fallback when the flag is on.
  if (isDiscordTerminalDeliveryEnabled() && input.product === "terminal") {
    return "terminal";
  }

  if (input.eventType?.trim()) {
    try {
      const def = resolveDiscordEventDefinition(input.eventType);

      if (
        isDiscordTerminalDeliveryEnabled() &&
        def.ownedByBot === "terminal" &&
        def.channelClass !== "customer_dm"
      ) {
        return "terminal";
      }

      if (isDiscordSecretaryDeliveryEnabled()) {
        if (def.ownedByBot === "secretary" || def.deliveryBot === "secretary") {
          return "secretary";
        }
      }

      return "bank";
    } catch {
      /* fall through to product heuristics */
    }
  }

  if (isDiscordSecretaryDeliveryEnabled()) {
    if (
      input.product === "secretary" ||
      input.product === "ops" ||
      input.product === "corporate"
    ) {
      return "secretary";
    }
  }

  return "bank";
}

/** Phase 3 alias — prefer resolveOutboxTargetBot for channel-aware routing. */
export function resolvePhase3DeliveryBot(
  product: DiscordProductSource,
  channelClass: DiscordChannelClass = "staff_ops",
  eventType?: string,
): DiscordTargetBot {
  return resolveOutboxTargetBot({ product, channelClass, eventType });
}

/** @deprecated Use resolveOutboxTargetBot — alias kept for Phase 1 call sites. */
export function resolvePhase1TargetBot(product: DiscordProductSource): DiscordTargetBot {
  return resolvePhase2DeliveryBot(product);
}

export function staffAuditProductToSource(
  product: string,
): DiscordProductSource {
  switch (product) {
    case "Alta Terminal":
      return "terminal";
    case "Alta Ops":
      return "ops";
    case "Companies":
      return "corporate";
    case "Alta Card":
    case "Alta Pay":
    case "Alta Bank":
    case "Deal Room":
    default:
      return "bank";
  }
}

export function buildCustomerDmIdempotencyKey(input: {
  userId: string;
  type: string;
  notificationId: string;
}): string {
  return `customer-dm:${input.userId}:${input.type}:${input.notificationId}`;
}

export function buildStaffAuditIdempotencyKey(dedupeKey: string | undefined, fallback: string): string {
  const key = dedupeKey?.trim();
  if (key) return key.startsWith("staff-audit:") ? key : `staff-audit:${key}`;
  return `staff-audit:${fallback}`;
}
