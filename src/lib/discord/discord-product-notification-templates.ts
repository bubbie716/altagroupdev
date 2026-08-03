/**
 * Phase 7B — Typed Bank / Terminal product notification templates.
 * Builds premium embeds via the shared builder when DISCORD_PRODUCT_PREMIUM_EMBEDS is on.
 */

import {
  DISCORD_BRANDS,
  listRegisteredDiscordEventDefinitions,
  resolveDiscordEventDefinition,
  type DiscordEventDefinition,
} from "@/lib/discord/discord-event-registry";
import type {
  DiscordEventSeverity,
  DiscordProductSource,
} from "@/lib/discord/discord-event-envelope";
import {
  buildPremiumEmbed,
  type PremiumEmbedBuilt,
  type PremiumEmbedField,
  validatePremiumEmbedInput,
} from "@/lib/discord/discord-premium-embed";
import { sanitizeStaffAuditDetails } from "@/lib/staff-audit/staff-audit-privacy";
import type { NotificationDmPayload } from "@/lib/discord/notification-dm";

/** Feature flag — default off keeps legacy notification-dm color embeds. */
export function isDiscordProductPremiumEmbedsEnabled(): boolean {
  const raw = process.env.DISCORD_PRODUCT_PREMIUM_EMBEDS?.trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}

export type ProductNotificationAudience = "customer" | "staff";

export type ProductNotificationFieldKey =
  | "Status"
  | "Amount"
  | "Reference"
  | "Account"
  | "Portfolio"
  | "Order";

export type ProductNotificationTemplate = {
  eventType: string;
  product: "bank" | "terminal";
  audience: ProductNotificationAudience;
  defaultTitle: string;
  summaryStyle: "status" | "money_movement" | "order" | "security" | "lifecycle" | "generic";
  preferenceGroupId?: string;
  preferredFields: ProductNotificationFieldKey[];
  severity: DiscordEventSeverity;
};

function humanizeEventType(eventType: string): string {
  const raw = eventType.trim().toUpperCase().replace(/_/g, " ").toLowerCase();
  return raw.replace(/\b\w/g, (c) => c.toUpperCase());
}

function audienceForDef(def: DiscordEventDefinition): ProductNotificationAudience {
  if (def.channelClass === "customer_dm") return "customer";
  return "staff";
}

function preferredFieldsFor(eventType: string, style: ProductNotificationTemplate["summaryStyle"]): ProductNotificationFieldKey[] {
  if (style === "money_movement") return ["Status", "Amount", "Reference", "Account"];
  if (style === "order") return ["Status", "Amount", "Order", "Portfolio", "Reference"];
  if (style === "security") return ["Status", "Account", "Reference"];
  if (style === "lifecycle") return ["Status", "Portfolio", "Account", "Reference"];
  if (style === "status") return ["Status", "Reference"];
  return ["Status", "Reference"];
}

function summaryStyleFor(eventType: string): ProductNotificationTemplate["summaryStyle"] {
  const t = eventType.toUpperCase();
  if (/RECON|FROZEN|UNFROZEN|SECURITY|CRITICAL/.test(t)) return "security";
  if (/ORDER|TRADE|FILL|CRYPTO|STOCK/.test(t)) return "order";
  if (/DEPOSIT|WITHDRAWAL|TRANSFER|PAY|FUNDING|PAYMENT|BILLING|INVOICE|PAYROLL/.test(t)) {
    return "money_movement";
  }
  if (/PORTFOLIO|ACCOUNT_OPENED|ACTIVATED|CREATED|ROLE_/.test(t)) return "lifecycle";
  if (/FAILED|DENIED|REJECTED|PAUSED|CANCELLED|OVERDUE|PAST_DUE/.test(t)) return "status";
  return "generic";
}

/** Explicit title polish for high-traffic events (registry names unchanged). */
const TITLE_OVERRIDES: Partial<Record<string, string>> = {
  DEPOSIT_SUBMITTED: "Deposit submitted",
  DEPOSIT_APPROVED: "Deposit approved",
  DEPOSIT_DENIED: "Deposit declined",
  WITHDRAWAL_SUBMITTED: "Withdrawal submitted",
  WITHDRAWAL_APPROVED: "Withdrawal approved",
  WITHDRAWAL_DENIED: "Withdrawal declined",
  TRANSFER_COMPLETED: "Transfer completed",
  TRANSFER_RECEIVED: "Transfer received",
  TRANSFER_FAILED: "Transfer failed",
  ALTA_PAY_SENT: "Alta Pay sent",
  ALTA_PAY_RECEIVED: "Alta Pay received",
  ALTA_PAY_FAILED: "Alta Pay failed",
  BANK_ACCOUNT_OPENED: "Bank account opened",
  LARGE_MONEY_MOVEMENT_ALERT: "Large money movement",
  ALTA_CARD_FROZEN: "Alta Card frozen",
  ALTA_CARD_UNFROZEN: "Alta Card unfrozen",
  ALTA_CARD_ACTIVATED: "Alta Card activated",
  LOAN_APPLICATION_APPROVED: "Loan application approved",
  LOAN_APPLICATION_DENIED: "Loan application declined",
  TERMINAL_CRYPTO_ORDER_FILLED: "Crypto order filled",
  TERMINAL_CRYPTO_ORDER_REJECTED: "Crypto order rejected",
  TERMINAL_CRYPTO_ORDER_FAILED: "Crypto order failed",
  TERMINAL_FUNDING_COMPLETED: "Terminal funding completed",
  TERMINAL_FUNDING_FAILED: "Terminal funding failed",
  TERMINAL_PORTFOLIO_CREATED: "Terminal portfolio created",
  TERMINAL_SCHEDULED_TRADE_CREATED: "Scheduled trade created",
  TERMINAL_SCHEDULED_TRADE_PAUSED: "Scheduled trade paused",
  TERMINAL_SCHEDULED_TRADE_RESUMED: "Scheduled trade resumed",
  TERMINAL_SCHEDULED_TRADE_CANCELLED: "Scheduled trade cancelled",
  TERMINAL_CRYPTO_RECON_CRITICAL: "Terminal reconciliation critical",
  TERMINAL_CRYPTO_RECON_WARNING: "Terminal reconciliation warning",
};

function templateFromDefinition(def: DiscordEventDefinition): ProductNotificationTemplate | null {
  if (def.product !== "bank" && def.product !== "terminal") return null;
  const eventType = def.eventType;
  const audience = audienceForDef(def);
  const style = summaryStyleFor(eventType);
  return {
    eventType,
    product: def.product,
    audience,
    defaultTitle: TITLE_OVERRIDES[eventType] ?? humanizeEventType(eventType),
    summaryStyle: style,
    preferenceGroupId: def.preferenceGroupId,
    preferredFields: preferredFieldsFor(eventType, style),
    severity: def.severity,
  };
}

const TEMPLATE_BY_KEY = new Map<string, ProductNotificationTemplate>();

function templateKey(eventType: string, audience: ProductNotificationAudience): string {
  return `${eventType.trim().toUpperCase()}::${audience}`;
}

function ensureTemplateCatalog(): void {
  if (TEMPLATE_BY_KEY.size > 0) return;
  for (const def of listRegisteredDiscordEventDefinitions()) {
    const tpl = templateFromDefinition(def);
    if (!tpl) continue;
    TEMPLATE_BY_KEY.set(templateKey(tpl.eventType, tpl.audience), tpl);
    // Customer entries that are also used as staff audits (shared names) get a staff twin.
    if (tpl.audience === "customer") {
      const staffTwin: ProductNotificationTemplate = {
        ...tpl,
        audience: "staff",
        preferenceGroupId: undefined,
      };
      const staffKey = templateKey(tpl.eventType, "staff");
      if (!TEMPLATE_BY_KEY.has(staffKey)) {
        TEMPLATE_BY_KEY.set(staffKey, staffTwin);
      }
    }
  }
}

/** All registered Bank/Terminal product templates (customer + staff twins). */
export function listProductNotificationTemplates(): ProductNotificationTemplate[] {
  ensureTemplateCatalog();
  return [...TEMPLATE_BY_KEY.values()].sort((a, b) => {
    const c = a.eventType.localeCompare(b.eventType);
    return c !== 0 ? c : a.audience.localeCompare(b.audience);
  });
}

export function getProductNotificationTemplate(
  eventType: string,
  audience: ProductNotificationAudience = "customer",
): ProductNotificationTemplate | null {
  ensureTemplateCatalog();
  const key = templateKey(eventType, audience);
  const exact = TEMPLATE_BY_KEY.get(key);
  if (exact) return exact;

  // Prefix / registry fallback for staff audits not in exact customer map.
  try {
    const def = resolveDiscordEventDefinition(eventType);
    if (def.product !== "bank" && def.product !== "terminal") return null;
    const fromDef = templateFromDefinition({
      ...def,
      channelClass: audience === "customer" ? "customer_dm" : def.channelClass === "customer_dm" ? "staff_ops" : def.channelClass,
      audience: audience === "customer" ? "customer" : "staff",
    });
    return fromDef;
  } catch {
    return null;
  }
}

function maskRef(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 8) return trimmed;
  return `…${trimmed.slice(-6)}`;
}

function readMetaString(meta: Record<string, unknown> | null | undefined, keys: string[]): string | null {
  if (!meta) return null;
  for (const key of keys) {
    const raw = meta[key];
    if (typeof raw === "string" && raw.trim()) return raw.trim();
    if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
  }
  return null;
}

function buildFields(
  template: ProductNotificationTemplate,
  audience: ProductNotificationAudience,
  metadata?: Record<string, unknown> | null,
): PremiumEmbedField[] {
  const fields: PremiumEmbedField[] = [];
  const meta = metadata ?? {};

  for (const name of template.preferredFields) {
    let value: string | null = null;
    if (name === "Status") {
      value = readMetaString(meta, ["status", "statusLabel"]) ?? (audience === "staff" ? template.severity : null);
    } else if (name === "Amount") {
      value = readMetaString(meta, ["amountLabel", "amount", "florinAmount"]);
      if (value && /^\d+(\.\d+)?$/.test(value)) value = `ƒ${value}`;
    } else if (name === "Reference") {
      value = readMetaString(meta, ["referenceCode", "reference", "correlationId"]);
      if (value && audience === "customer") value = maskRef(value);
    } else if (name === "Account") {
      value = readMetaString(meta, ["accountName", "accountLabel"]);
      // Never put full account numbers in fields — sanitize catches AB- patterns.
    } else if (name === "Portfolio") {
      value = readMetaString(meta, ["portfolioName", "portfolioLabel"]);
    } else if (name === "Order") {
      const orderId = readMetaString(meta, ["orderId", "orderReference"]);
      value = orderId ? (audience === "customer" ? maskRef(orderId) : orderId) : null;
    }
    if (!value) continue;
    const safe = sanitizeStaffAuditDetails(value) ?? value;
    fields.push({ name, value: safe.slice(0, 256), inline: true });
  }

  if (audience === "staff") {
    const entity = readMetaString(meta, ["entityType"]);
    const entityId = readMetaString(meta, ["entityId"]);
    if (entity) {
      fields.push({
        name: "Entity",
        value: sanitizeStaffAuditDetails(entityId ? `${entity}:${maskRef(entityId)}` : entity) ?? entity,
        inline: true,
      });
    }
  }

  return fields.slice(0, 8);
}

export type BuildProductPremiumInput = {
  eventType: string;
  audience: ProductNotificationAudience;
  title: string;
  body: string;
  linkUrl?: string | null;
  linkLabel?: string;
  embedImageUrl?: string | null;
  metadata?: Record<string, unknown> | null;
  correlationId?: string | null;
  timestamp?: string | Date | null;
  /** When set (e.g. staff audit severity), overrides the registry template severity/color. */
  severity?: DiscordEventSeverity;
};

/**
 * Build a premium Bank/Terminal notification payload.
 * Returns null when the flag is off, product is not Bank/Terminal, or embed validation fails
 * (callers must fall back to legacy plain/legacy embeds).
 */
export function buildProductPremiumNotification(
  input: BuildProductPremiumInput,
): (PremiumEmbedBuilt & { product: "bank" | "terminal" }) | null {
  if (!isDiscordProductPremiumEmbedsEnabled()) return null;

  const template = getProductNotificationTemplate(input.eventType, input.audience);
  if (!template) return null;

  const summary =
    input.audience === "customer"
      ? sanitizeStaffAuditDetails(input.body)?.slice(0, 500) ?? input.body.slice(0, 500)
      : sanitizeStaffAuditDetails(input.body) ?? input.body.slice(0, 800);

  const title = (input.title.trim() || template.defaultTitle).slice(0, 256);
  const fields = buildFields(template, input.audience, input.metadata);

  const premiumInput = {
    product: template.product as DiscordProductSource,
    eventType: template.eventType,
    severity: input.severity ?? template.severity,
    title,
    description: summary || undefined,
    fields,
    linkUrl: input.linkUrl,
    linkLabel: input.linkLabel,
    thumbnailUrl: input.audience === "customer" ? input.embedImageUrl : undefined,
    correlationId:
      input.audience === "staff"
        ? input.correlationId
        : input.correlationId
          ? maskRef(input.correlationId)
          : undefined,
    timestamp: input.timestamp,
    footer: DISCORD_BRANDS[template.product].footer,
  };

  const validation = validatePremiumEmbedInput(premiumInput);
  if (!validation.ok) return null;

  try {
    const built = buildPremiumEmbed(premiumInput);
    // Hard brand guard — never cross Bank/Terminal.
    if (template.product === "bank" && /Terminal/i.test(built.brand.footer)) return null;
    if (template.product === "terminal" && /Alta Bank/i.test(built.brand.footer)) return null;
    return { ...built, product: template.product };
  } catch {
    return null;
  }
}

/** Convert premium build into NotificationDmPayload shape. */
export function productPremiumToDmPayload(
  built: PremiumEmbedBuilt,
): NotificationDmPayload {
  return {
    embed: built.embed,
    components: built.components,
  };
}

/** Inventory helper: every Bank/Terminal registry event must resolve a template. */
export function assertProductTemplateCoverage(): {
  covered: string[];
  missing: string[];
} {
  ensureTemplateCatalog();
  const covered: string[] = [];
  const missing: string[] = [];
  for (const def of listRegisteredDiscordEventDefinitions()) {
    if (def.product !== "bank" && def.product !== "terminal") continue;
    const audience = audienceForDef(def);
    const tpl = getProductNotificationTemplate(def.eventType, audience);
    const label = `${def.eventType}:${audience}`;
    if (tpl && tpl.product === def.product) covered.push(label);
    else missing.push(label);
  }
  return { covered, missing };
}
