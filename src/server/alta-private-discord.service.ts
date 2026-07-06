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
    const { scheduleDispatchInvitationDm } = await import("@/server/invitation-discord-dispatch.service");
    scheduleDispatchInvitationDm("private", invitationId);
    return { status: "sent" };
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

  try {
    const { scheduleCreateUserNotification } = await import("@/server/notification.service");
    scheduleCreateUserNotification({
      userId,
      type: "ALTA_PRIVATE_MEMBERSHIP_ACTIVATED",
      title: "Welcome to Alta Private",
      body: "Your Alta Private membership is now active. Explore private banking on Alta Bank.",
      linkUrl: "/bank/private",
    });

    return { status: "sent" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Discord error";
    return { status: "failed", error: message };
  }
}

export async function sendAltaPrivateDeclinedDiscordNotification(
  _userId: string,
): Promise<DiscordDeliveryResult> {
  // Decline is recorded in audit only — no customer DM per product policy.
  return { status: "skipped", reason: "not_configured" };
}

export function isAltaPrivateDiscordConfigured(): boolean {
  return discordConfigured();
}
