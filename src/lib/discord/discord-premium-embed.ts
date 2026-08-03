/**
 * Shared premium Discord embed model + builder (Phase 5).
 * Used by Bank, Secretary, and Terminal delivery — do not duplicate per bot.
 */

import { DISCORD_BRANDS, type DiscordBrandProfile } from "@/lib/discord/discord-event-registry";
import type { DiscordEventSeverity, DiscordProductSource } from "@/lib/discord/discord-event-envelope";
import { sanitizeStaffAuditDetails } from "@/lib/staff-audit/staff-audit-privacy";
import { resolvePublicLinkUrl } from "@/lib/discord/notification-dm";

export const PREMIUM_EMBED_LIMITS = {
  title: 256,
  description: 4096,
  fieldName: 256,
  fieldValue: 1024,
  maxFields: 25,
  footer: 2048,
  totalApprox: 6000,
} as const;

/** Product accent colors (hex int for Discord API). */
export const PRODUCT_ACCENT_COLORS = {
  bank: 0x06111f,
  terminal: 0x0f1729,
  secretary: 0x1e293b,
  corporate: 0x1e293b,
  ops: 0x1e293b,
} as const satisfies Record<DiscordProductSource, number>;

export const SEVERITY_COLORS = {
  INFO: 0x334155,
  ACTION: 0x047857,
  WARNING: 0xd97706,
  CRITICAL: 0xb91c1c,
} as const satisfies Record<DiscordEventSeverity, number>;

export type PremiumEmbedField = {
  name: string;
  value: string;
  inline?: boolean;
};

export type PremiumEmbedInput = {
  product: DiscordProductSource;
  eventType: string;
  severity?: DiscordEventSeverity;
  title: string;
  description?: string;
  fields?: PremiumEmbedField[];
  /** Relative or absolute deep link. */
  linkUrl?: string | null;
  linkLabel?: string;
  thumbnailUrl?: string | null;
  correlationId?: string | null;
  timestamp?: string | Date | null;
  /** Override footer; defaults to product brand. */
  footer?: string;
};

export type PremiumEmbedBuilt = {
  /** Discord API embed object. */
  embed: Record<string, unknown>;
  /** Discord message components (link button). */
  components: Record<string, unknown>[];
  /** Plain-text fallback for channels that prefer content. */
  plainText: string;
  brand: DiscordBrandProfile;
};

function brandForProduct(product: DiscordProductSource): DiscordBrandProfile {
  return DISCORD_BRANDS[product] ?? DISCORD_BRANDS.bank;
}

function redact(text: string): string {
  return sanitizeStaffAuditDetails(text) ?? text.slice(0, 500);
}

function clamp(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, Math.max(0, max - 3))}...`;
}

export function validatePremiumEmbedInput(
  input: PremiumEmbedInput,
): { ok: true } | { ok: false; reason: string } {
  if (!input.title?.trim()) return { ok: false, reason: "title_required" };
  if (input.title.length > PREMIUM_EMBED_LIMITS.title) {
    return { ok: false, reason: "title_too_long" };
  }
  if (input.description && input.description.length > PREMIUM_EMBED_LIMITS.description) {
    return { ok: false, reason: "description_too_long" };
  }
  if ((input.fields?.length ?? 0) > PREMIUM_EMBED_LIMITS.maxFields) {
    return { ok: false, reason: "too_many_fields" };
  }
  return { ok: true };
}

/** Build a Discord embed + plain-text fallback with product branding. */
export function buildPremiumEmbed(input: PremiumEmbedInput): PremiumEmbedBuilt {
  const validation = validatePremiumEmbedInput(input);
  if (!validation.ok) {
    throw new Error(`invalid_premium_embed:${validation.reason}`);
  }

  const brand = brandForProduct(input.product);
  const severity = input.severity ?? "INFO";
  const color = SEVERITY_COLORS[severity] ?? PRODUCT_ACCENT_COLORS[input.product];
  const absoluteLink = resolvePublicLinkUrl(input.linkUrl);
  const title = clamp(redact(input.title), PREMIUM_EMBED_LIMITS.title);
  const description = input.description
    ? clamp(redact(input.description), PREMIUM_EMBED_LIMITS.description)
    : undefined;

  const fields = (input.fields ?? []).slice(0, PREMIUM_EMBED_LIMITS.maxFields).map((field) => ({
    name: clamp(redact(field.name), PREMIUM_EMBED_LIMITS.fieldName) || "—",
    value: clamp(redact(field.value), PREMIUM_EMBED_LIMITS.fieldValue) || "—",
    inline: Boolean(field.inline),
  }));

  if (input.correlationId?.trim()) {
    fields.push({
      name: "Reference",
      value: clamp(input.correlationId.trim(), PREMIUM_EMBED_LIMITS.fieldValue),
      inline: true,
    });
  }

  const footerText = clamp(
    input.footer?.trim() || brand.footer,
    PREMIUM_EMBED_LIMITS.footer,
  );

  const timestamp =
    input.timestamp instanceof Date
      ? input.timestamp.toISOString()
      : typeof input.timestamp === "string" && input.timestamp.trim()
        ? input.timestamp.trim()
        : new Date().toISOString();

  const embed: Record<string, unknown> = {
    title,
    color,
    footer: { text: footerText },
    timestamp,
  };
  if (description) embed.description = description;
  if (fields.length > 0) embed.fields = fields;
  if (absoluteLink) embed.url = absoluteLink;

  const thumb = input.thumbnailUrl?.trim();
  if (thumb && (thumb.startsWith("http://") || thumb.startsWith("https://"))) {
    embed.thumbnail = { url: thumb };
  }

  const components: Record<string, unknown>[] = [];
  if (absoluteLink) {
    components.push({
      type: 1,
      components: [
        {
          type: 2,
          style: 5,
          label: clamp(input.linkLabel?.trim() || brand.linkLabelDefault, 80),
          url: absoluteLink,
        },
      ],
    });
  }

  const fieldPlain = fields.map((f) => `${f.name}: ${f.value}`).join(" · ");
  const plainText = clamp(
    [title, description, fieldPlain, footerText].filter(Boolean).join("\n"),
    2000,
  );

  return { embed, components, plainText, brand };
}

/** Reusable embed definitions for high-traffic event families. */
export function buildEventPremiumEmbed(input: {
  eventType: string;
  product: DiscordProductSource;
  severity?: DiscordEventSeverity;
  title: string;
  description?: string;
  fields?: PremiumEmbedField[];
  linkUrl?: string | null;
  correlationId?: string | null;
}): PremiumEmbedBuilt {
  return buildPremiumEmbed({
    product: input.product,
    eventType: input.eventType,
    severity: input.severity,
    title: input.title,
    description: input.description,
    fields: input.fields,
    linkUrl: input.linkUrl,
    correlationId: input.correlationId,
  });
}

/** Structural snapshot helper for tests — no secrets. */
export function premiumEmbedSnapshot(built: PremiumEmbedBuilt): {
  title: unknown;
  color: unknown;
  footer: unknown;
  hasTimestamp: boolean;
  fieldNames: string[];
  plainTextLength: number;
  brandFooter: string;
} {
  const embed = built.embed;
  const fields = Array.isArray(embed.fields)
    ? (embed.fields as Array<{ name?: string }>).map((f) => f.name ?? "")
    : [];
  return {
    title: embed.title,
    color: embed.color,
    footer: (embed.footer as { text?: string } | undefined)?.text,
    hasTimestamp: typeof embed.timestamp === "string",
    fieldNames: fields,
    plainTextLength: built.plainText.length,
    brandFooter: built.brand.footer,
  };
}
