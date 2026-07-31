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
  const { sendingConfigured, servers } = Route.useLoaderData();

  return (
    <InternalPageShell
      title="Communications"
      description="Send plain-text Discord messages through the Corporate, Terminal, or Bank bot."
    >
      <DiscordEmbedBuilder sendingConfigured={sendingConfigured} servers={servers} />
    </InternalPageShell>
  );
}
