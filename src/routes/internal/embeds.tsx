import { createFileRoute } from "@tanstack/react-router";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { DiscordEmbedBuilder } from "@/components/internal/discord-embed-builder";
import { fetchDiscordEmbedConfig } from "@/lib/discord/discord-embed.functions";

export const Route = createFileRoute("/internal/embeds")({
  loader: () => fetchDiscordEmbedConfig(),
  head: () => ({ meta: [{ title: "Discord Embeds — Alta Internal" }] }),
  component: InternalEmbedsPage,
});

function InternalEmbedsPage() {
  const { sendingConfigured, channelPresets } = Route.useLoaderData();

  return (
    <InternalPageShell
      title="Discord Embeds"
      description="Operations console for composing Alta Discord embeds, validating limits, and sending to configured channels."
    >
      <DiscordEmbedBuilder sendingConfigured={sendingConfigured} channelPresets={channelPresets} />
    </InternalPageShell>
  );
}
