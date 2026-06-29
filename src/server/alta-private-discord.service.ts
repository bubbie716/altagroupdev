type DiscordDeliveryResult =
  | { status: "skipped"; reason: "not_configured" }
  | { status: "sent" }
  | { status: "failed"; error: string };

function discordConfigured(): boolean {
  return Boolean(
    process.env.DISCORD_BOT_TOKEN?.trim() &&
      process.env.DISCORD_GUILD_ID?.trim() &&
      process.env.DISCORD_PRIVATE_ROLE_ID?.trim(),
  );
}

function logDiscord(message: string, meta?: Record<string, unknown>): void {
  if (process.env.NODE_ENV === "test") return;
  console.info(`[alta-private-discord] ${message}`, meta ?? {});
}

async function deliverDiscordNotification(
  label: string,
  meta: Record<string, unknown>,
): Promise<DiscordDeliveryResult> {
  if (!discordConfigured()) {
    logDiscord(`${label} skipped — Discord not configured`, meta);
    return { status: "skipped", reason: "not_configured" };
  }

  try {
    // Placeholder: wire to Discord bot when available.
    // Uses DISCORD_BOT_TOKEN, DISCORD_GUILD_ID, DISCORD_PRIVATE_ROLE_ID, DISCORD_PRIVATE_CHANNEL_ID.
    logDiscord(`${label} queued (bot integration pending)`, meta);
    return { status: "sent" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Discord error";
    logDiscord(`${label} failed`, { ...meta, error: message });
    return { status: "failed", error: message };
  }
}

export async function sendAltaPrivateInvitationDiscordNotification(
  userId: string,
  invitationId: string,
): Promise<DiscordDeliveryResult> {
  return deliverDiscordNotification("invitation", { userId, invitationId });
}

export async function sendAltaPrivateAcceptedDiscordNotification(
  userId: string,
): Promise<DiscordDeliveryResult> {
  return deliverDiscordNotification("accepted", { userId });
}

export async function sendAltaPrivateDeclinedDiscordNotification(
  userId: string,
): Promise<DiscordDeliveryResult> {
  return deliverDiscordNotification("declined", { userId });
}

export function isAltaPrivateDiscordConfigured(): boolean {
  return discordConfigured();
}
