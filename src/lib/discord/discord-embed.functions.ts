import { createServerFn } from "@tanstack/react-start";
import type { DiscordEmbedDraft, SendDiscordEmbedResult } from "@/lib/discord/embed-types";

export const sendDiscordEmbedRecord = createServerFn({ method: "POST" })
  .inputValidator((input: DiscordEmbedDraft) => input)
  .handler(async ({ data }): Promise<SendDiscordEmbedResult> => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { sendDiscordEmbed } = await import("@/server/discord-embed.service");
    await requireOperator();
    return sendDiscordEmbed(data);
  });

export const fetchDiscordEmbedConfig = createServerFn({ method: "GET" }).handler(async () => {
  const { requireOperator } = await import("@/server/permissions.service");
  const { isDiscordSendingConfigured, listChannelPresets } = await import("@/server/discord-embed.service");
  await requireOperator();
  return {
    sendingConfigured: isDiscordSendingConfigured(),
    channelPresets: listChannelPresets(),
  };
});
