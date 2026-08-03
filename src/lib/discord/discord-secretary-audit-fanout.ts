/**
 * Phase 7A — Central Secretary audit fan-out planning + redacted payloads.
 * Product delivery stays on Bank/Terminal/Secretary ownership; Secretary gets a
 * redacted operational audit copy when DISCORD_SECRETARY_AUDIT_FANOUT is on.
 */

import {
  DISCORD_BRANDS,
  resolveDiscordEventDefinition,
  type DiscordEventClassification,
  type DiscordEventDefinition,
} from "@/lib/discord/discord-event-registry";
import type {
  DiscordChannelClass,
  DiscordEventSeverity,
  DiscordProductSource,
  DiscordSafeDisplayPayload,
  DiscordStaffAuditDisplayPayload,
  DiscordTargetBot,
} from "@/lib/discord/discord-event-envelope";
import { buildPremiumEmbed } from "@/lib/discord/discord-premium-embed";
import { sanitizeStaffAuditDetails } from "@/lib/staff-audit/staff-audit-privacy";

const DEST_SUFFIX = ":destination:";

/** Feature flag — default off preserves Phase 1–6 behavior. */
export function isDiscordSecretaryAuditFanoutEnabled(): boolean {
  const raw = process.env.DISCORD_SECRETARY_AUDIT_FANOUT?.trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}

/** Append destination to a base outbox idempotency key. */
export function buildDestinationIdempotencyKey(
  baseKey: string,
  destination: DiscordTargetBot,
): string {
  const base = baseKey.trim();
  if (!base) throw new Error("empty_idempotency_base");
  if (base.includes(DEST_SUFFIX)) return base;
  return `${base}${DEST_SUFFIX}${destination}`;
}

/** Strip `:destination:{bot}` if present (for correlating fan-out siblings). */
export function stripDestinationIdempotencyKey(key: string): string {
  const idx = key.lastIndexOf(DEST_SUFFIX);
  if (idx < 0) return key;
  return key.slice(0, idx);
}

export function parseDestinationFromIdempotencyKey(
  key: string,
): DiscordTargetBot | null {
  const idx = key.lastIndexOf(DEST_SUFFIX);
  if (idx < 0) return null;
  const dest = key.slice(idx + DEST_SUFFIX.length);
  if (dest === "bank" || dest === "secretary" || dest === "terminal") return dest;
  return null;
}

/**
 * Whether this registry event should create a Secretary audit copy in addition
 * to product delivery. Customer DMs and already-Secretary-owned events never fan out.
 */
export function shouldFanoutSecretaryAuditCopy(
  def: Pick<DiscordEventDefinition, "classification" | "ownedByBot" | "deliveryBot" | "channelClass">,
): boolean {
  if (!isDiscordSecretaryAuditFanoutEnabled()) return false;
  if (def.classification === "customer_notification") return false;
  if (def.channelClass === "customer_dm") return false;
  // Already Secretary-delivered — one row only.
  if (def.ownedByBot === "secretary" || def.deliveryBot === "secretary") return false;
  if (def.classification === "secretary_system_audit") return false;
  return true;
}

export function shouldFanoutSecretaryAuditForEventType(eventType: string): boolean {
  try {
    return shouldFanoutSecretaryAuditCopy(resolveDiscordEventDefinition(eventType));
  } catch {
    // Unknown types: fan out only when flag on and not clearly a customer DM prefix.
    if (!isDiscordSecretaryAuditFanoutEnabled()) return false;
    const key = eventType.trim().toUpperCase();
    if (!key || key.includes("CUSTOMER") && key.includes("DM")) return false;
    return true;
  }
}

export type FanoutDestinationPlan = {
  targetBot: DiscordTargetBot;
  /** Outbox product field (channel routing). */
  product: DiscordProductSource;
  channelClass: DiscordChannelClass;
  idempotencyKey: string;
  displayPayload: DiscordSafeDisplayPayload;
  role: "product" | "secretary_audit";
};

/**
 * Plan destination outbox rows for an event.
 * Flag off → single product destination with the legacy (unsuffixed) key.
 */
export function planDiscordFanoutDestinations(input: {
  baseIdempotencyKey: string;
  product: DiscordProductSource;
  eventType: string;
  channelClass: DiscordChannelClass;
  productTargetBot: DiscordTargetBot;
  displayPayload: DiscordSafeDisplayPayload;
  secretaryAuditPayload?: DiscordStaffAuditDisplayPayload;
}): FanoutDestinationPlan[] {
  const base = input.baseIdempotencyKey.trim();
  if (!base) return [];

  if (!isDiscordSecretaryAuditFanoutEnabled()) {
    return [
      {
        targetBot: input.productTargetBot,
        product: input.product,
        channelClass: input.channelClass,
        idempotencyKey: base,
        displayPayload: input.displayPayload,
        role: "product",
      },
    ];
  }

  // Customer DMs — product bot only (always Bank).
  if (input.channelClass === "customer_dm" || input.displayPayload.kind === "customer_dm") {
    return [
      {
        targetBot: "bank",
        product: input.product,
        channelClass: "customer_dm",
        idempotencyKey: buildDestinationIdempotencyKey(base, "bank"),
        displayPayload: input.displayPayload,
        role: "product",
      },
    ];
  }

  // Secretary-owned / already Secretary-targeted — single Secretary row.
  if (input.productTargetBot === "secretary") {
    return [
      {
        targetBot: "secretary",
        product: input.product,
        channelClass: input.channelClass,
        idempotencyKey: buildDestinationIdempotencyKey(base, "secretary"),
        displayPayload: input.displayPayload,
        role: "product",
      },
    ];
  }

  // Staff / role / security payloads: fan out when flag on.
  // Prefer payload kind over registry classification so shared customer/staff
  // event names (e.g. TERMINAL_CRYPTO_ORDER_FILLED) still fan out for audits.
  const isStaffPayload =
    input.displayPayload.kind === "staff_audit" || input.displayPayload.kind === "role_mgmt";
  const fanout =
    isStaffPayload ||
    input.channelClass === "security_audit" ||
    input.channelClass === "delivery_alert" ||
    shouldFanoutSecretaryAuditForEventType(input.eventType);

  const productPlan: FanoutDestinationPlan = {
    targetBot: input.productTargetBot,
    product: input.product,
    channelClass: input.channelClass,
    idempotencyKey: buildDestinationIdempotencyKey(base, input.productTargetBot),
    displayPayload: input.displayPayload,
    role: "product",
  };

  if (!fanout) {
    return [productPlan];
  }

  const secretaryChannelClass = resolveSecretaryFanoutChannelClass(input.channelClass);
  const secretaryPayload =
    input.secretaryAuditPayload ??
    buildSecretaryCentralAuditDisplayPayload({
      originalProduct: input.product,
      eventType: input.eventType,
      action:
        input.displayPayload.kind === "staff_audit"
          ? input.displayPayload.action ?? input.eventType
          : input.displayPayload.kind === "role_mgmt"
            ? `${input.displayPayload.productRole}_${input.displayPayload.action}`
            : input.eventType,
      originalDestinationBot: input.productTargetBot,
      originalChannelClass: input.channelClass,
      redactedContent:
        input.displayPayload.kind === "staff_audit" ? input.displayPayload.content : undefined,
      roleMgmt:
        input.displayPayload.kind === "role_mgmt"
          ? {
              productRole: input.displayPayload.productRole,
              action: input.displayPayload.action,
              reason: input.displayPayload.reason,
            }
          : undefined,
    });

  return [
    productPlan,
    {
      targetBot: "secretary",
      // ops product → Secretary staff audit channel (never Bank/Terminal staff_ops refuse).
      product: secretaryChannelClass === "staff_ops" ? "ops" : input.product,
      channelClass: secretaryChannelClass,
      idempotencyKey: buildDestinationIdempotencyKey(base, "secretary"),
      displayPayload: secretaryPayload,
      role: "secretary_audit",
    },
  ];
}

/** Map product channel class onto Secretary central-audit route. */
export function resolveSecretaryFanoutChannelClass(
  channelClass: DiscordChannelClass,
): DiscordChannelClass {
  if (channelClass === "security_audit") return "security_audit";
  if (channelClass === "delivery_alert") return "delivery_alert";
  // role_mgmt / staff_ops / customer_dm → staff_ops audit (customer never reaches here).
  return "staff_ops";
}

export type BuildSecretaryCentralAuditInput = {
  originalProduct: DiscordProductSource;
  eventType: string;
  action: string;
  severity?: DiscordEventSeverity;
  actorLabel?: string;
  entityType?: string;
  entityId?: string;
  amount?: string;
  status?: string;
  correlationId?: string;
  internalUrl?: string;
  /** Already-sanitized details; never pass customer DM body. */
  redactedDetails?: string;
  redactedContent?: string;
  originalDestinationBot: DiscordTargetBot;
  originalChannelClass: DiscordChannelClass;
  site?: string;
  roleMgmt?: {
    productRole: string;
    action: string;
    reason?: string;
  };
};

/**
 * Redacted operational audit for Secretary — never a customer message copy.
 * Uses Secretary/ops branding; preserves plain-text fallback.
 */
export function buildSecretaryCentralAuditDisplayPayload(
  input: BuildSecretaryCentralAuditInput,
): DiscordStaffAuditDisplayPayload {
  const site = input.site?.trim() || "Newport";
  const productLabel =
    DISCORD_BRANDS[input.originalProduct]?.productLabel ?? input.originalProduct;
  const details =
    sanitizeStaffAuditDetails(input.redactedDetails) ??
    sanitizeStaffAuditDetails(input.redactedContent);
  const actionLabel = input.action.replace(/_/g, " ").trim() || input.eventType;

  const fields: Array<{ name: string; value: string; inline?: boolean }> = [
    { name: "Product", value: productLabel, inline: true },
    { name: "Site", value: site, inline: true },
    { name: "Severity", value: input.severity ?? "INFO", inline: true },
    {
      name: "Original destination",
      value: `${input.originalDestinationBot} · ${input.originalChannelClass}`,
      inline: false,
    },
  ];
  if (input.actorLabel?.trim()) {
    fields.push({ name: "Actor", value: input.actorLabel.trim().slice(0, 100), inline: true });
  }
  if (input.entityType?.trim()) {
    const ref = input.entityId?.trim()
      ? `${input.entityType}:${input.entityId.trim().slice(0, 40)}`
      : input.entityType;
    fields.push({ name: "Entity", value: ref.slice(0, 256), inline: true });
  }
  if (input.amount?.trim()) {
    fields.push({ name: "Amount", value: input.amount.trim().slice(0, 64), inline: true });
  }
  if (input.status?.trim()) {
    fields.push({ name: "Status", value: input.status.trim().slice(0, 64), inline: true });
  }
  if (input.roleMgmt) {
    fields.push({
      name: "Role sync",
      value: `${input.roleMgmt.productRole} · ${input.roleMgmt.action}${
        input.roleMgmt.reason ? ` · ${sanitizeStaffAuditDetails(input.roleMgmt.reason) ?? ""}` : ""
      }`.slice(0, 256),
      inline: false,
    });
  }

  let embed: Record<string, unknown> | undefined;
  let components: Record<string, unknown>[] | undefined;
  let plainText: string;

  try {
    const built = buildPremiumEmbed({
      product: "ops",
      eventType: input.eventType,
      severity: input.severity ?? "INFO",
      title: `Central audit · ${actionLabel}`.slice(0, 256),
      description: details ?? undefined,
      fields,
      linkUrl: input.internalUrl,
      correlationId: input.correlationId,
      footer: DISCORD_BRANDS.secretary.footer,
    });
    embed = built.embed;
    components = built.components;
    plainText = built.plainText;
  } catch {
    plainText = [
      `Central audit · ${actionLabel}`,
      `Product: ${productLabel}`,
      `Site: ${site}`,
      details,
      `Destination: ${input.originalDestinationBot}`,
    ]
      .filter(Boolean)
      .join("\n")
      .slice(0, 2000);
  }

  // Guard: never leak customer_dm-shaped content into Secretary.
  if (/customer_dm/i.test(plainText) && /title:|body:/i.test(plainText)) {
    plainText = `Central audit · ${actionLabel} (customer content redacted)`.slice(0, 2000);
    embed = undefined;
    components = undefined;
  }

  return {
    kind: "staff_audit",
    content: plainText.slice(0, 2000),
    product: "Alta Ops",
    action: input.action,
    embed,
    components,
  };
}

/** Classification → human inventory label (tests / ops). */
export function classificationLabel(c: DiscordEventClassification): string {
  return c;
}
