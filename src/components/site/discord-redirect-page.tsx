import { createFileRoute, redirect } from "@tanstack/react-router";
import {
  ALTA_DISCORD_ENTITY_LABELS,
  ALTA_DISCORD_URLS,
  type AltaDiscordEntity,
} from "@/lib/site/discord-urls";
import { ComingSoonPage } from "@/components/site/coming-soon-page";

export function createDiscordRedirectRoute(entity: AltaDiscordEntity) {
  const label = ALTA_DISCORD_ENTITY_LABELS[entity];
  const envKey = {
    group: "VITE_ALTA_GROUP_DISCORD_URL",
    bank: "VITE_ALTA_BANK_DISCORD_URL",
    markets: "VITE_ALTA_MARKETS_DISCORD_URL",
    ncc: "VITE_ALTA_NCC_DISCORD_URL",
  }[entity];

  return {
    head: () => ({
      meta: [
        { title: `Discord — ${label}` },
        { name: "description", content: `Join the official ${label} Discord community.` },
      ],
    }),
    beforeLoad: () => {
      const url = ALTA_DISCORD_URLS[entity];
      if (url) {
        throw redirect({ href: url, replace: true });
      }
    },
    component: function DiscordRedirectPage() {
      return (
        <ComingSoonPage
          eyebrow={`${label} Community`}
          title="Discord"
          description={`The official ${label} Discord invite link will be available here. Configure ${envKey} to enable automatic redirect.`}
        />
      );
    },
  };
}

export type DiscordRedirectRoute = ReturnType<typeof createDiscordRedirectRoute>;
