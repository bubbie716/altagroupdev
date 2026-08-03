/**
 * Authoritative Discord event registry (Phase 4).
 * `ownedByBot` / `deliveryBot` record ownership; outbox workers claim by targetBot.
 * Terminal customer DMs remain Bank-delivered; Terminal staff can target the Terminal bot
 * when DISCORD_TERMINAL_DELIVERY is enabled.
 */

import type {
  DiscordChannelClass,
  DiscordDeliveryPolicy,
  DiscordEventSeverity,
  DiscordProductSource,
  DiscordTargetBot,
} from "@/lib/discord/discord-event-envelope";

export type DiscordEventAudience = "customer" | "staff" | "both";

export type DiscordBrandProfile = {
  footer: string;
  productLabel: string;
  linkLabelDefault: string;
};

export type DiscordEventDefinition = {
  eventType: string;
  product: DiscordProductSource;
  audience: DiscordEventAudience;
  /** Owning bot (cutover / ops ownership). */
  ownedByBot: DiscordTargetBot;
  /**
   * Intended delivery bot for outbox targeting when product delivery flags are on.
   * Customer DMs always remain `bank`. Terminal staff → `terminal`; Secretary staff → `secretary`.
   */
  deliveryBot: DiscordTargetBot;
  channelClass: DiscordChannelClass;
  severity: DiscordEventSeverity;
  deliveryPolicy: DiscordDeliveryPolicy;
  /** Bank settings Discord preference group id when customer-facing. */
  preferenceGroupId?: string;
  brand: DiscordBrandProfile;
};

export const DISCORD_BRANDS = {
  bank: {
    footer: "Alta Bank · Newport",
    productLabel: "Alta Bank",
    linkLabelDefault: "View on Alta Bank",
  },
  terminal: {
    footer: "Alta Terminal · Newport",
    productLabel: "Alta Terminal",
    linkLabelDefault: "View on Alta Terminal",
  },
  corporate: {
    footer: "Alta Group · Newport",
    productLabel: "Companies",
    linkLabelDefault: "View on Alta",
  },
  secretary: {
    footer: "Alta Secretary · Newport",
    productLabel: "Alta Secretary",
    linkLabelDefault: "View internal",
  },
  ops: {
    footer: "Alta operations · Newport",
    productLabel: "Alta Ops",
    linkLabelDefault: "View internal",
  },
} as const satisfies Record<DiscordProductSource, DiscordBrandProfile>;

type DefInput = Omit<DiscordEventDefinition, "eventType" | "deliveryBot" | "brand" | "ownedByBot"> & {
  ownedByBot?: DiscordTargetBot;
  deliveryBot?: DiscordTargetBot;
  brand?: DiscordBrandProfile;
};

function resolveDefaultOwnedByBot(product: DiscordProductSource): DiscordTargetBot {
  if (product === "ops" || product === "corporate" || product === "secretary") return "secretary";
  return product;
}

/**
 * Phase 4 delivery bot:
 * - customer_dm → bank (never Secretary/Terminal)
 * - secretary-owned staff streams → secretary
 * - terminal-owned staff streams → terminal
 * - bank-owned → bank
 */
function resolveDefaultDeliveryBot(
  ownedByBot: DiscordTargetBot,
  channelClass: DiscordChannelClass,
  override?: DiscordTargetBot,
): DiscordTargetBot {
  if (override) return override;
  if (channelClass === "customer_dm") return "bank";
  // role_mgmt and staff streams follow ownership.
  if (ownedByBot === "secretary") return "secretary";
  if (ownedByBot === "terminal") return "terminal";
  return "bank";
}

function def(eventType: string, input: DefInput): DiscordEventDefinition {
  const brand = input.brand ?? DISCORD_BRANDS[input.product];
  const ownedByBot = input.ownedByBot ?? resolveDefaultOwnedByBot(input.product);
  return {
    eventType,
    product: input.product,
    audience: input.audience,
    ownedByBot,
    deliveryBot: resolveDefaultDeliveryBot(ownedByBot, input.channelClass, input.deliveryBot),
    channelClass: input.channelClass,
    severity: input.severity,
    deliveryPolicy: input.deliveryPolicy,
    preferenceGroupId: input.preferenceGroupId,
    brand,
  };
}

const CUSTOMER_QUEUED = {
  audience: "customer" as const,
  channelClass: "customer_dm" as const,
  deliveryPolicy: "queued" as const,
};

const STAFF_OPS = {
  audience: "staff" as const,
  channelClass: "staff_ops" as const,
  deliveryPolicy: "queued" as const,
};

const ROLE_MGMT = {
  audience: "staff" as const,
  channelClass: "role_mgmt" as const,
  deliveryPolicy: "queued" as const,
};

/** Exact event-type registry entries. */
const EXACT_EVENTS: DiscordEventDefinition[] = [
  // —— Bank customer ——
  def("DEPOSIT_SUBMITTED", { product: "bank", ...CUSTOMER_QUEUED, severity: "INFO", preferenceGroupId: "banking" }),
  def("DEPOSIT_APPROVED", { product: "bank", ...CUSTOMER_QUEUED, severity: "ACTION", preferenceGroupId: "banking" }),
  def("DEPOSIT_DENIED", { product: "bank", ...CUSTOMER_QUEUED, severity: "WARNING", preferenceGroupId: "banking" }),
  def("WITHDRAWAL_SUBMITTED", { product: "bank", ...CUSTOMER_QUEUED, severity: "INFO", preferenceGroupId: "banking" }),
  def("WITHDRAWAL_APPROVED", { product: "bank", ...CUSTOMER_QUEUED, severity: "ACTION", preferenceGroupId: "banking" }),
  def("WITHDRAWAL_DENIED", { product: "bank", ...CUSTOMER_QUEUED, severity: "WARNING", preferenceGroupId: "banking" }),
  def("TRANSFER_COMPLETED", { product: "bank", ...CUSTOMER_QUEUED, severity: "INFO", preferenceGroupId: "banking" }),
  def("TRANSFER_RECEIVED", { product: "bank", ...CUSTOMER_QUEUED, severity: "INFO", preferenceGroupId: "banking" }),
  def("TRANSFER_FAILED", { product: "bank", ...CUSTOMER_QUEUED, severity: "WARNING", preferenceGroupId: "banking" }),
  def("LARGE_MONEY_MOVEMENT_ALERT", { product: "bank", ...CUSTOMER_QUEUED, severity: "WARNING", preferenceGroupId: "banking" }),
  def("ALTA_PAY_SENT", { product: "bank", ...CUSTOMER_QUEUED, severity: "INFO", preferenceGroupId: "alta-pay" }),
  def("ALTA_PAY_RECEIVED", { product: "bank", ...CUSTOMER_QUEUED, severity: "INFO", preferenceGroupId: "alta-pay" }),
  def("ALTA_PAY_FAILED", { product: "bank", ...CUSTOMER_QUEUED, severity: "WARNING", preferenceGroupId: "alta-pay" }),
  def("SCHEDULED_TRANSFER_EXECUTED", { product: "bank", ...CUSTOMER_QUEUED, severity: "INFO", preferenceGroupId: "alta-pay" }),
  def("SCHEDULED_TRANSFER_FAILED", { product: "bank", ...CUSTOMER_QUEUED, severity: "WARNING", preferenceGroupId: "alta-pay" }),
  def("PAYROLL_RUN_EXECUTED", { product: "bank", ...CUSTOMER_QUEUED, severity: "INFO", preferenceGroupId: "alta-pay" }),
  def("PAYROLL_RUN_FAILED", { product: "bank", ...CUSTOMER_QUEUED, severity: "WARNING", preferenceGroupId: "alta-pay" }),
  def("MERCHANT_INVOICE_RECEIVED", { product: "bank", ...CUSTOMER_QUEUED, severity: "INFO", preferenceGroupId: "merchant" }),
  def("MERCHANT_INVOICE_REMINDER", { product: "bank", ...CUSTOMER_QUEUED, severity: "INFO", preferenceGroupId: "merchant" }),
  def("MERCHANT_INVOICE_PAID", { product: "bank", ...CUSTOMER_QUEUED, severity: "INFO", preferenceGroupId: "merchant" }),
  def("MERCHANT_INVOICE_CANCELLED", { product: "bank", ...CUSTOMER_QUEUED, severity: "INFO", preferenceGroupId: "merchant" }),
  def("MERCHANT_INVOICE_OVERDUE", { product: "bank", ...CUSTOMER_QUEUED, severity: "WARNING", preferenceGroupId: "merchant" }),
  def("CUSTOMER_PAYMENT_FAILED", { product: "bank", ...CUSTOMER_QUEUED, severity: "WARNING", preferenceGroupId: "merchant" }),
  def("MERCHANT_PAYMENT_FAILED", { product: "bank", ...CUSTOMER_QUEUED, severity: "WARNING", preferenceGroupId: "merchant" }),
  def("PAYMENT_LINK_PAID", { product: "bank", ...CUSTOMER_QUEUED, severity: "INFO", preferenceGroupId: "merchant" }),
  def("PAYMENT_LINK_RECEIPT", { product: "bank", ...CUSTOMER_QUEUED, severity: "INFO", preferenceGroupId: "merchant" }),
  def("MERCHANT_FIRST_PAYMENT_RECEIVED", { product: "bank", ...CUSTOMER_QUEUED, severity: "ACTION", preferenceGroupId: "merchant" }),
  def("COMMERCIAL_PRO_ACTIVATED", { product: "bank", ...CUSTOMER_QUEUED, severity: "ACTION", preferenceGroupId: "commercial" }),
  def("COMMERCIAL_PRO_BILLING_SUCCEEDED", { product: "bank", ...CUSTOMER_QUEUED, severity: "INFO", preferenceGroupId: "commercial" }),
  def("COMMERCIAL_PRO_BILLING_FAILED", { product: "bank", ...CUSTOMER_QUEUED, severity: "WARNING", preferenceGroupId: "commercial" }),
  def("COMMERCIAL_PRO_PAST_DUE", { product: "bank", ...CUSTOMER_QUEUED, severity: "WARNING", preferenceGroupId: "commercial" }),
  def("COMMERCIAL_PRO_DOWNGRADED", { product: "bank", ...CUSTOMER_QUEUED, severity: "WARNING", preferenceGroupId: "commercial" }),
  def("COMMERCIAL_BILLING_ACCOUNT_CHANGED", { product: "bank", ...CUSTOMER_QUEUED, severity: "INFO", preferenceGroupId: "commercial" }),
  def("COMMERCIAL_PRO_RENEWAL_REMINDER", { product: "bank", ...CUSTOMER_QUEUED, severity: "INFO", preferenceGroupId: "commercial" }),
  def("COMMERCIAL_BILLING_LOW_BALANCE_WARNING", { product: "bank", ...CUSTOMER_QUEUED, severity: "WARNING", preferenceGroupId: "commercial" }),
  def("DEAL_ROOM_CREATED", { product: "bank", ...CUSTOMER_QUEUED, severity: "ACTION", preferenceGroupId: "deal-rooms" }),
  def("DEAL_ROOM_MESSAGE_RECEIVED", { product: "bank", ...CUSTOMER_QUEUED, severity: "INFO", preferenceGroupId: "deal-rooms" }),
  def("LOAN_APPLICATION_APPROVED", { product: "bank", ...CUSTOMER_QUEUED, severity: "ACTION", preferenceGroupId: "deal-rooms" }),
  def("LOAN_APPLICATION_DENIED", { product: "bank", ...CUSTOMER_QUEUED, severity: "WARNING", preferenceGroupId: "deal-rooms" }),
  def("LOAN_PAYMENT_MADE", { product: "bank", ...CUSTOMER_QUEUED, severity: "INFO", preferenceGroupId: "deal-rooms" }),
  def("LOAN_PAID_OFF", { product: "bank", ...CUSTOMER_QUEUED, severity: "ACTION", preferenceGroupId: "deal-rooms" }),
  def("LOAN_AUTOPAY_FAILED", { product: "bank", ...CUSTOMER_QUEUED, severity: "WARNING", preferenceGroupId: "deal-rooms" }),
  def("ALTA_CARD_APPLICATION_APPROVED", { product: "bank", ...CUSTOMER_QUEUED, severity: "ACTION", preferenceGroupId: "credit" }),
  def("ALTA_CARD_APPLICATION_DENIED", { product: "bank", ...CUSTOMER_QUEUED, severity: "WARNING", preferenceGroupId: "credit" }),
  def("ALTA_CARD_PAYMENT_MADE", { product: "bank", ...CUSTOMER_QUEUED, severity: "INFO", preferenceGroupId: "credit" }),
  def("ALTA_CARD_AUTOPAY_SUCCEEDED", { product: "bank", ...CUSTOMER_QUEUED, severity: "INFO", preferenceGroupId: "credit" }),
  def("ALTA_CARD_AUTOPAY_FAILED", { product: "bank", ...CUSTOMER_QUEUED, severity: "WARNING", preferenceGroupId: "credit" }),
  def("ALTA_CARD_REVIEW_DECIDED", { product: "bank", ...CUSTOMER_QUEUED, severity: "ACTION", preferenceGroupId: "credit" }),
  def("ALTA_CARD_ACTIVATED", { product: "bank", ...CUSTOMER_QUEUED, severity: "ACTION", preferenceGroupId: "credit" }),
  def("ALTA_CARD_FROZEN", { product: "bank", ...CUSTOMER_QUEUED, severity: "CRITICAL", preferenceGroupId: "credit" }),
  def("ALTA_CARD_UNFROZEN", { product: "bank", ...CUSTOMER_QUEUED, severity: "ACTION", preferenceGroupId: "credit" }),
  def("COMPANY_VERIFIED", { product: "corporate", ...CUSTOMER_QUEUED, severity: "ACTION", preferenceGroupId: "companies" }),
  def("COMPANY_ROLE_CHANGED", { product: "corporate", ...CUSTOMER_QUEUED, severity: "INFO", preferenceGroupId: "companies" }),
  def("COMPANY_VERIFICATION_REJECTED", { product: "corporate", ...CUSTOMER_QUEUED, severity: "WARNING", preferenceGroupId: "companies" }),
  def("COMPANY_VERIFICATION_REVOKED", { product: "corporate", ...CUSTOMER_QUEUED, severity: "WARNING", preferenceGroupId: "companies" }),

  // —— Terminal customer ——
  def("TERMINAL_SCHEDULED_TRADE_CREATED", { product: "terminal", ...CUSTOMER_QUEUED, severity: "INFO", preferenceGroupId: "terminal" }),
  def("TERMINAL_SCHEDULED_TRADE_PAUSED", { product: "terminal", ...CUSTOMER_QUEUED, severity: "INFO", preferenceGroupId: "terminal" }),
  def("TERMINAL_SCHEDULED_TRADE_RESUMED", { product: "terminal", ...CUSTOMER_QUEUED, severity: "INFO", preferenceGroupId: "terminal" }),
  def("TERMINAL_SCHEDULED_TRADE_CANCELLED", { product: "terminal", ...CUSTOMER_QUEUED, severity: "INFO", preferenceGroupId: "terminal" }),
  def("TERMINAL_SCHEDULED_TRADE_ORDER_SUBMITTED", { product: "terminal", ...CUSTOMER_QUEUED, severity: "INFO", preferenceGroupId: "terminal" }),
  def("TERMINAL_SCHEDULED_TRADE_ATTEMPT_SKIPPED", { product: "terminal", ...CUSTOMER_QUEUED, severity: "WARNING", preferenceGroupId: "terminal" }),
  def("TERMINAL_SCHEDULED_TRADE_ATTEMPT_FAILED", { product: "terminal", ...CUSTOMER_QUEUED, severity: "WARNING", preferenceGroupId: "terminal" }),
  def("TERMINAL_SCHEDULED_TRADE_COMPLETED", { product: "terminal", ...CUSTOMER_QUEUED, severity: "ACTION", preferenceGroupId: "terminal" }),
  def("TERMINAL_SCHEDULED_TRADE_ENDED", { product: "terminal", ...CUSTOMER_QUEUED, severity: "INFO", preferenceGroupId: "terminal" }),
  def("TERMINAL_CRYPTO_ORDER_FILLED", { product: "terminal", ...CUSTOMER_QUEUED, severity: "ACTION", preferenceGroupId: "terminal" }),
  def("TERMINAL_CRYPTO_ORDER_REJECTED", { product: "terminal", ...CUSTOMER_QUEUED, severity: "WARNING", preferenceGroupId: "terminal" }),
  def("TERMINAL_CRYPTO_ORDER_FAILED", { product: "terminal", ...CUSTOMER_QUEUED, severity: "WARNING", preferenceGroupId: "terminal" }),
  def("TERMINAL_FUNDING_COMPLETED", { product: "terminal", ...CUSTOMER_QUEUED, severity: "ACTION", preferenceGroupId: "terminal" }),
  def("TERMINAL_FUNDING_FAILED", { product: "terminal", ...CUSTOMER_QUEUED, severity: "WARNING", preferenceGroupId: "terminal" }),

  // —— Terminal / Bank staff audit actions (exact) ——
  def("TERMINAL_CRYPTO_ORDER_FILLED", { product: "terminal", ...STAFF_OPS, severity: "INFO" }),
  def("TERMINAL_CRYPTO_ORDER_REJECTED", { product: "terminal", ...STAFF_OPS, severity: "WARNING" }),
  def("TERMINAL_CRYPTO_ORDER_FAILED", { product: "terminal", ...STAFF_OPS, severity: "WARNING" }),
  def("TERMINAL_FUNDING_TRANSFER_COMPLETED", { product: "terminal", ...STAFF_OPS, severity: "INFO" }),
  def("TERMINAL_FUNDING_TRANSFER_FAILED", { product: "terminal", ...STAFF_OPS, severity: "WARNING" }),
  def("TERMINAL_SCHEDULED_TRADE_CREATED", { product: "terminal", ...STAFF_OPS, severity: "INFO" }),
  def("TERMINAL_CRYPTO_FEE_CONFIG_UPDATED", { product: "terminal", ...STAFF_OPS, severity: "ACTION" }),
  def("TERMINAL_CRYPTO_REVENUE_SWEEP", { product: "terminal", ...STAFF_OPS, severity: "ACTION" }),
  def("TERMINAL_CRYPTO_RECON_ISSUE_RESOLVED", { product: "terminal", ...STAFF_OPS, severity: "INFO" }),
  def("TERMINAL_CRYPTO_RECON_ISSUE_REOPENED", { product: "terminal", ...STAFF_OPS, severity: "WARNING" }),
  def("TERMINAL_CRYPTO_RECON_ISSUE_OPENED", { product: "terminal", ...STAFF_OPS, severity: "WARNING" }),
  def("TERMINAL_CRYPTO_RECON_CRITICAL", {
    product: "terminal",
    audience: "staff",
    channelClass: "security_audit",
    severity: "CRITICAL",
    deliveryPolicy: "queued",
  }),
  def("TERMINAL_CRYPTO_RECON_WARNING", { product: "terminal", ...STAFF_OPS, severity: "WARNING" }),
  def("STAFF_AUDIT_MESSAGE_FAILED", {
    product: "secretary",
    audience: "staff",
    channelClass: "delivery_alert",
    severity: "WARNING",
    deliveryPolicy: "queued",
  }),
  def("CUSTOMER_DM_DELIVERY_FAILED", {
    product: "secretary",
    audience: "staff",
    channelClass: "delivery_alert",
    severity: "WARNING",
    deliveryPolicy: "queued",
  }),
  def("INTERNAL_NOTE_ADDED", { product: "ops", ...STAFF_OPS, severity: "INFO", ownedByBot: "secretary" }),
  def("BUSINESS_ACCOUNT_OPENED", { product: "corporate", ...STAFF_OPS, severity: "ACTION", ownedByBot: "secretary" }),

  // —— Phase 5 product role management ——
  def("BANK_CLIENT_ROLE_GRANTED", { product: "bank", ...ROLE_MGMT, severity: "ACTION", ownedByBot: "bank", deliveryBot: "bank" }),
  def("BANK_CLIENT_ROLE_REVOKED", { product: "bank", ...ROLE_MGMT, severity: "ACTION", ownedByBot: "bank", deliveryBot: "bank" }),
  def("BANK_CLIENT_ROLE_RECONCILED", { product: "bank", ...ROLE_MGMT, severity: "INFO", ownedByBot: "bank", deliveryBot: "bank" }),
  def("TERMINAL_INVESTOR_ROLE_GRANTED", {
    product: "terminal",
    ...ROLE_MGMT,
    severity: "ACTION",
    ownedByBot: "terminal",
    deliveryBot: "terminal",
  }),
  def("TERMINAL_INVESTOR_ROLE_REVOKED", {
    product: "terminal",
    ...ROLE_MGMT,
    severity: "ACTION",
    ownedByBot: "terminal",
    deliveryBot: "terminal",
  }),
  def("TERMINAL_INVESTOR_ROLE_RECONCILED", {
    product: "terminal",
    ...ROLE_MGMT,
    severity: "INFO",
    ownedByBot: "terminal",
    deliveryBot: "terminal",
  }),
  def("SECRETARY_STAFF_ROLE_GRANTED", {
    product: "secretary",
    ...ROLE_MGMT,
    severity: "ACTION",
    ownedByBot: "secretary",
    deliveryBot: "secretary",
  }),
  def("SECRETARY_STAFF_ROLE_REVOKED", {
    product: "secretary",
    ...ROLE_MGMT,
    severity: "ACTION",
    ownedByBot: "secretary",
    deliveryBot: "secretary",
  }),
  def("SECRETARY_STAFF_ROLE_RECONCILED", {
    product: "secretary",
    ...ROLE_MGMT,
    severity: "INFO",
    ownedByBot: "secretary",
    deliveryBot: "secretary",
  }),
  def("OPS_JOB_FAILED", { product: "ops", ...STAFF_OPS, severity: "CRITICAL", ownedByBot: "secretary" }),
];

/** Prefix rules (longest match wins). */
const PREFIX_RULES: Array<{ prefix: string; partial: DefInput }> = [
  { prefix: "TERMINAL_CRYPTO_STATUS_", partial: { product: "terminal", ...STAFF_OPS, severity: "ACTION" } },
  { prefix: "TERMINAL_CRYPTO_CONTRIBUTION_", partial: { product: "terminal", ...STAFF_OPS, severity: "ACTION" } },
  { prefix: "TERMINAL_SCHEDULED_TRADE_", partial: { product: "terminal", ...STAFF_OPS, severity: "INFO" } },
  { prefix: "TERMINAL_CRYPTO_", partial: { product: "terminal", ...STAFF_OPS, severity: "INFO" } },
  { prefix: "TERMINAL_FUNDING_", partial: { product: "terminal", ...STAFF_OPS, severity: "INFO" } },
  { prefix: "TERMINAL_", partial: { product: "terminal", ...STAFF_OPS, severity: "INFO" } },
  { prefix: "ALTA_CARD_", partial: { product: "bank", ...STAFF_OPS, severity: "INFO" } },
  { prefix: "ALTA_EMPLOYEE_CARD_", partial: { product: "bank", ...STAFF_OPS, severity: "INFO" } },
  { prefix: "ALTA_PAY_", partial: { product: "bank", ...STAFF_OPS, severity: "INFO" } },
  { prefix: "COMPANY_", partial: { product: "corporate", ...STAFF_OPS, severity: "INFO", ownedByBot: "secretary" } },
  { prefix: "MERCHANT_", partial: { product: "bank", ...STAFF_OPS, severity: "INFO" } },
  { prefix: "PAYMENT_LINK_", partial: { product: "bank", ...STAFF_OPS, severity: "INFO" } },
  { prefix: "COMMERCIAL_", partial: { product: "bank", ...STAFF_OPS, severity: "INFO" } },
  { prefix: "MAINTENANCE", partial: { product: "ops", ...STAFF_OPS, severity: "CRITICAL", ownedByBot: "secretary" } },
  { prefix: "CREDIT_DESK", partial: { product: "ops", ...STAFF_OPS, severity: "WARNING", ownedByBot: "secretary" } },
  { prefix: "OPS_", partial: { product: "ops", ...STAFF_OPS, severity: "INFO", ownedByBot: "secretary" } },
  { prefix: "USER_", partial: { product: "ops", ...STAFF_OPS, severity: "INFO", ownedByBot: "secretary" } },
  { prefix: "BANK_", partial: { product: "bank", ...STAFF_OPS, severity: "INFO" } },
  { prefix: "DEAL_ROOM_", partial: { product: "bank", ...STAFF_OPS, severity: "INFO" } },
  { prefix: "LOAN_", partial: { product: "bank", ...STAFF_OPS, severity: "INFO" } },
];

const EXACT_MAP = new Map<string, DiscordEventDefinition>();
for (const entry of EXACT_EVENTS) {
  // First registration wins for duplicate keys (customer defs registered before staff redefs).
  if (!EXACT_MAP.has(entry.eventType)) {
    EXACT_MAP.set(entry.eventType, entry);
  }
}

// Staff-specific overrides that must win for audit actions sharing customer notification names
for (const staffType of [
  "TERMINAL_CRYPTO_ORDER_FILLED",
  "TERMINAL_CRYPTO_ORDER_REJECTED",
  "TERMINAL_CRYPTO_ORDER_FAILED",
  "TERMINAL_SCHEDULED_TRADE_CREATED",
] as const) {
  // Keep customer def in map for notification path; resolveDiscordEventDefinition uses audience hint.
  void staffType;
}

export function isDiscordProductAwareRoutingEnabled(): boolean {
  const raw = process.env.DISCORD_PRODUCT_AWARE_ROUTING?.trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}

export function shouldStrictDiscordEventRegistry(): boolean {
  if (process.env.DISCORD_STRICT_EVENT_REGISTRY === "1") return true;
  if (process.env.NODE_ENV === "test") return true;
  if (process.env.NODE_ENV === "development") return true;
  return isDiscordProductAwareRoutingEnabled();
}

export class UnknownDiscordEventError extends Error {
  readonly eventType: string;
  constructor(eventType: string) {
    super(`Unknown Discord event type: ${eventType}`);
    this.name = "UnknownDiscordEventError";
    this.eventType = eventType;
  }
}

function normalizeEventType(eventType: string): string {
  return eventType.trim().toUpperCase().replace(/\s+/g, "_");
}

function matchPrefix(eventType: string): DiscordEventDefinition | null {
  const sorted = [...PREFIX_RULES].sort((a, b) => b.prefix.length - a.prefix.length);
  for (const rule of sorted) {
    if (eventType.startsWith(rule.prefix)) {
      return def(eventType, rule.partial);
    }
  }
  return null;
}

/**
 * Resolve an event definition from the registry.
 * Unknown types throw in test/dev/strict/product-aware mode; never silently label as Alta Bank.
 */
export function resolveDiscordEventDefinition(eventType: string): DiscordEventDefinition {
  const key = normalizeEventType(eventType);
  const exact = EXACT_MAP.get(key);
  if (exact) return { ...exact, eventType: key };

  const prefixed = matchPrefix(key);
  if (prefixed) return prefixed;

  if (shouldStrictDiscordEventRegistry()) {
    throw new UnknownDiscordEventError(key);
  }

  console.error("[discord-event-registry] unknown event type — refusing Bank default", {
    eventType: key,
  });
  // Production without strict mode: route to secretary delivery_alert for visibility.
  return def(key, {
    product: "secretary",
    audience: "staff",
    channelClass: "delivery_alert",
    severity: "WARNING",
    deliveryPolicy: "queued",
    ownedByBot: "secretary",
  });
}

/** Soft resolve for branding — never throws; unknown → bank brand. */
export function resolveDiscordBrandForEvent(eventType: string | undefined | null): DiscordBrandProfile {
  if (!eventType?.trim()) return DISCORD_BRANDS.bank;
  try {
    return resolveDiscordEventDefinition(eventType).brand;
  } catch {
    const key = normalizeEventType(eventType);
    if (key.startsWith("TERMINAL_")) return DISCORD_BRANDS.terminal;
    if (key.startsWith("COMPANY_")) return DISCORD_BRANDS.corporate;
    return DISCORD_BRANDS.bank;
  }
}

export function resolveStaffAuditProductLabel(eventType: string): string {
  try {
    return resolveDiscordEventDefinition(eventType).brand.productLabel;
  } catch {
    const key = normalizeEventType(eventType);
    if (key.startsWith("TERMINAL_")) return DISCORD_BRANDS.terminal.productLabel;
    if (key.startsWith("COMPANY_")) return DISCORD_BRANDS.corporate.productLabel;
    if (key.startsWith("OPS_") || key.startsWith("MAINTENANCE") || key.startsWith("USER_")) {
      return DISCORD_BRANDS.ops.productLabel;
    }
    throw new UnknownDiscordEventError(key);
  }
}

export function listRegisteredDiscordEventTypes(): string[] {
  return [...EXACT_MAP.keys()].sort();
}

export function listPrefixRules(): string[] {
  return PREFIX_RULES.map((r) => r.prefix).sort((a, b) => b.length - a.length);
}
