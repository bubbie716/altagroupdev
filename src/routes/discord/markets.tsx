import { createFileRoute } from "@tanstack/react-router";
import { createDiscordRedirectRoute } from "@/components/site/discord-redirect-page";

export const Route = createFileRoute("/discord/markets")({
  ...createDiscordRedirectRoute("markets"),
});
