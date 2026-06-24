import { createFileRoute } from "@tanstack/react-router";
import type { DiscordEmbedDraft } from "@/lib/discord/embed-types";
import { handleDiscordEmbedRequest } from "@/server/discord-embed.service";

export const Route = createFileRoute("/api/internal/discord/embed")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            channelId?: string;
            embed?: Record<string, unknown>;
            components?: Record<string, unknown>[];
            draft?: DiscordEmbedDraft;
          };

          if (!body.draft) {
            return Response.json({ ok: false, message: "Missing embed draft payload." }, { status: 400 });
          }

          const result = await handleDiscordEmbedRequest(request, body.draft);
          const status = result.ok ? 200 : 422;
          return Response.json(result, { status });
        } catch (error) {
          const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
          if (message === "UNAUTHORIZED") {
            return Response.json({ ok: false, message: "Authentication required." }, { status: 401 });
          }
          if (message === "FORBIDDEN" || message === "ACCOUNT_RESTRICTED") {
            return Response.json({ ok: false, message: "Internal access required." }, { status: 403 });
          }
          if (message.startsWith("DISCORD_API_ERROR:")) {
            return Response.json(
              { ok: false, message: "Discord API rejected the embed.", detail: message },
              { status: 502 },
            );
          }
          return Response.json({ ok: false, message: "Unable to process embed request." }, { status: 500 });
        }
      },
    },
  },
});
