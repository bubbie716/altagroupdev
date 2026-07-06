/** Public Alta Discord invite URLs — see discord-urls.ts */
export { ALTA_DISCORD_INVITE_URL, getAltaDiscordUrl, ALTA_DISCORD_URLS } from "@/lib/site/discord-urls";

export const LEGAL_CENTER_PATH = "/governance/legaldocs" as const;

export const FOOTER_COMPANY_LINKS = [
  { label: "Alta Group", to: "/company" as const },
  { label: "Alta Bank", to: "/bank" as const },
  { label: "Alta Markets", to: "/exchange" as const },
  { label: "NCC", to: "/company/ncc" as const },
  { label: "Leadership", to: "/company/leadership" as const },
] as const;

export const FOOTER_SUPPORT_LINKS = [
  { label: "Support Center", to: "/support" as const },
  { label: "System Status", to: "/status" as const },
] as const;
