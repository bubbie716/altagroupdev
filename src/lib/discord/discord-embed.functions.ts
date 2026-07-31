import { createServerFn } from "@tanstack/react-start";
import type { DiscordMessageDraft, SendDiscordMessageResult } from "@/lib/discord/embed-types";

export const sendDiscordEmbedRecord = createServerFn({ method: "POST" })
  .inputValidator((input: DiscordMessageDraft) => input)
  .handler(async ({ data }): Promise<SendDiscordMessageResult> => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { assertNotUiLabMutation } = await import("@/lib/internal/ui-lab-mutation-gate");
    const { sendDiscordMessage } = await import("@/server/discord-embed.service");
    await requireOperator();
    assertNotUiLabMutation("Discord message send");
    return sendDiscordMessage(data);
  });

export const fetchDiscordEmbedConfig = createServerFn({ method: "GET" }).handler(async () => {
  const { requireOperator } = await import("@/server/permissions.service");
  const { isDiscordSendingConfigured, listDiscordServers } = await import(
    "@/server/discord-embed.service"
  );
  await requireOperator();
  return {
    sendingConfigured: isDiscordSendingConfigured(),
    servers: listDiscordServers(),
  };
});
