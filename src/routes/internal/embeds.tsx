import { createFileRoute } from "@tanstack/react-router";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { DiscordEmbedBuilder } from "@/components/internal/discord-embed-builder";
import { fetchDiscordEmbedConfig } from "@/lib/discord/discord-embed.functions";
import { internalDocumentTitle } from "@/lib/internal/internal-document-title";

export const Route = createFileRoute("/internal/embeds")({
  loader: () => fetchDiscordEmbedConfig(),
  head: ({ match }) => ({ meta: [{ title: internalDocumentTitle("Communications", (match.search as { site?: string }).site) }] }),
  component: InternalEmbedsPage,
});

function InternalEmbedsPage() {
  const { sendingConfigured, channelPresets } = Route.useLoaderData();

  return (
    <InternalPageShell
      title="Communications"
      description="Compose Alta Discord embeds for operations announcements and status updates."
    >
      <DiscordEmbedBuilder sendingConfigured={sendingConfigured} channelPresets={channelPresets} />
    </InternalPageShell>
  );
}
