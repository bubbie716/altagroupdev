import type { DiscordBrandProfile } from "@/lib/discord/discord-event-registry";
import { DISCORD_BRANDS, resolveDiscordBrandForEvent } from "@/lib/discord/discord-event-registry";

export function brandFooterForEvent(eventType?: string | null): string {
  return resolveDiscordBrandForEvent(eventType).footer;
}

export function brandLinkLabelForEvent(eventType?: string | null, override?: string): string {
  if (override?.trim()) return override.trim().slice(0, 80);
  return resolveDiscordBrandForEvent(eventType).linkLabelDefault;
}

export function brandProfileForProductLabel(productLabel: string): DiscordBrandProfile {
  switch (productLabel) {
    case "Alta Terminal":
      return DISCORD_BRANDS.terminal;
    case "Companies":
      return DISCORD_BRANDS.corporate;
    case "Alta Ops":
      return DISCORD_BRANDS.ops;
    case "Alta Bank":
    case "Alta Pay":
    case "Alta Card":
    case "Deal Room":
    default:
      return DISCORD_BRANDS.bank;
  }
}

/** Regression helper: Terminal event types must never resolve to Bank footer. */
export function assertTerminalBrandNotBank(eventType: string): void {
  const brand = resolveDiscordBrandForEvent(eventType);
  if (eventType.toUpperCase().startsWith("TERMINAL_") && brand.footer.includes("Alta Bank")) {
    throw new Error(`Terminal event ${eventType} incorrectly branded as Bank`);
  }
}
