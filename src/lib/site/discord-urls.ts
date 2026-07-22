export type AltaDiscordEntity = "group" | "bank" | "markets" | "ncc";

const ENTITY_ENV_KEYS: Record<AltaDiscordEntity, string> = {
  group: "VITE_ALTA_GROUP_DISCORD_URL",
  bank: "VITE_ALTA_BANK_DISCORD_URL",
  markets: "VITE_ALTA_TERMINAL_DISCORD_URL",
  ncc: "VITE_ALTA_NCC_DISCORD_URL",
};

function readDiscordUrl(envKey: string): string {
  const env = import.meta.env;
  if (!env) return "";
  return (env[envKey] as string | undefined)?.trim() || "";
}

/** Public Discord invite URLs — set the matching VITE_* value in production. */
export const ALTA_DISCORD_URLS: Record<AltaDiscordEntity, string> = {
  group:
    readDiscordUrl(ENTITY_ENV_KEYS.group) ||
    readDiscordUrl("VITE_ALTA_DISCORD_INVITE_URL"),
  bank: readDiscordUrl(ENTITY_ENV_KEYS.bank),
  markets:
    readDiscordUrl(ENTITY_ENV_KEYS.markets) ||
    // Legacy env key kept so existing deployments keep working.
    readDiscordUrl("VITE_ALTA_MARKETS_DISCORD_URL"),
  ncc: readDiscordUrl(ENTITY_ENV_KEYS.ncc),
};

export function getAltaDiscordUrl(entity: AltaDiscordEntity = "group"): string {
  return ALTA_DISCORD_URLS[entity];
}

export const ALTA_DISCORD_ENTITY_LABELS: Record<AltaDiscordEntity, string> = {
  group: "Alta Group",
  bank: "Alta Bank",
  markets: "Alta Terminal",
  ncc: "NCC",
};

export const ALTA_DISCORD_COMMUNITIES: Array<{
  entity: AltaDiscordEntity;
  label: string;
  description: string;
  route: "/discord" | "/discord/bank" | "/discord/markets" | "/discord/ncc";
}> = [
  {
    entity: "group",
    label: ALTA_DISCORD_ENTITY_LABELS.group,
    description: "Platform-wide announcements, governance updates, and general Alta community discussion.",
    route: "/discord",
  },
  {
    entity: "bank",
    label: ALTA_DISCORD_ENTITY_LABELS.bank,
    description: "Banking support, Alta Pay merchants, account questions, and Alta Card inquiries.",
    route: "/discord/bank",
  },
  {
    entity: "markets",
    label: ALTA_DISCORD_ENTITY_LABELS.markets,
    description: "Alta Terminal brokerage support, portfolio questions, and trading community.",
    route: "/discord/markets",
  },
  {
    entity: "ncc",
    label: ALTA_DISCORD_ENTITY_LABELS.ncc,
    description: "Clearing, settlement, and institutional participant coordination for NCC members.",
    route: "/discord/ncc",
  },
];

/** @deprecated Use getAltaDiscordUrl("group") */
export const ALTA_DISCORD_INVITE_URL = ALTA_DISCORD_URLS.group;
