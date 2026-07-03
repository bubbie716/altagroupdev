import { dispatchInvitationDm } from "@/server/invitation-discord-dispatch.service";

type DiscordDeliveryResult =
  | { status: "skipped"; reason: "not_configured" }
  | { status: "sent" }
  | { status: "failed"; error: string };

function discordConfigured(): boolean {
  return Boolean(
    process.env.DISCORD_BOT_TOKEN?.trim() &&
      process.env.DISCORD_GUILD_ID?.trim(),
  );
}

function logDiscord(message: string, meta?: Record<string, unknown>): void {
  if (process.env.NODE_ENV === "test") return;
  console.info(`[alta-private-discord] ${message}`, meta ?? {});
}

export async function sendAltaPrivateInvitationDiscordNotification(
  userId: string,
  invitationId: string,
): Promise<DiscordDeliveryResult> {
  if (!discordConfigured()) {
    logDiscord("invitation skipped — Discord not configured", { userId, invitationId });
    return { status: "skipped", reason: "not_configured" };
  }

  try {
    const result = await dispatchInvitationDm("private", invitationId);
    if (result.sent) return { status: "sent" };
    logDiscord("invitation DM not sent", {
      userId,
      invitationId,
      reason: result.reason,
      via: result.via,
    });
    return { status: "failed", error: result.reason ?? "not_sent" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Discord error";
    logDiscord("invitation failed", { userId, invitationId, error: message });
    return { status: "failed", error: message };
  }
}

export async function sendAltaPrivateAcceptedDiscordNotification(
  userId: string,
): Promise<DiscordDeliveryResult> {
  if (!discordConfigured()) {
    return { status: "skipped", reason: "not_configured" };
  }
  logDiscord("accepted notification pending — Phase 4", { userId });
  return { status: "sent" };
}

export async function sendAltaPrivateDeclinedDiscordNotification(
  userId: string,
): Promise<DiscordDeliveryResult> {
  if (!discordConfigured()) {
    return { status: "skipped", reason: "not_configured" };
  }
  logDiscord("declined notification pending — Phase 4", { userId });
  return { status: "sent" };
}

export function isAltaPrivateDiscordConfigured(): boolean {
  return discordConfigured();
}
