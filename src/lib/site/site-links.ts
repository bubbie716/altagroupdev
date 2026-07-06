/** Public Alta Discord invite URLs — see discord-urls.ts */
export { ALTA_DISCORD_INVITE_URL, getAltaDiscordUrl, ALTA_DISCORD_URLS } from "@/lib/site/discord-urls";

import { resolveEntitySiteUrl } from "@/lib/site/entity-site-url";

export const LEGAL_CENTER_PATH = "/legal" as const;

/** Public system status page — external redirect. */
export const ALTA_SYSTEM_STATUS_URL = "https://status.altagroup.dev" as const;

export type FooterCompanyLink =
  | { label: string; to: string; external?: false }
  | { label: string; href: string; external: true };

export function getFooterCompanyLinks(): FooterCompanyLink[] {
  return [
    { label: "Alta Group", to: "/structure" },
    { label: "Alta Bank", href: resolveEntitySiteUrl("bank"), external: true },
    { label: "Alta Exchange", href: resolveEntitySiteUrl("exchange"), external: true },
    { label: "Alta Terminal", href: resolveEntitySiteUrl("terminal"), external: true },
    { label: "NCC", href: resolveEntitySiteUrl("ncc"), external: true },
    { label: "Leadership", to: "/leadership" },
  ];
}

export const FOOTER_SUPPORT_LINKS = [
  { label: "Support Center", to: "/support" as const },
] as const;
