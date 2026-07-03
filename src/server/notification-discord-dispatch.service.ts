import type { UserNotificationDmInput } from "@/server/bot-notification-delivery.service";

function logDispatch(message: string, meta?: Record<string, unknown>): void {
  if (process.env.NODE_ENV === "test") return;
  console.info(`[notification-dispatch] ${message}`, meta ?? {});
}

function botInternalUrl(): string {
  return process.env.BOT_INTERNAL_URL?.trim() || "http://127.0.0.1:3847";
}

function botApiSecret(): string | null {
  return process.env.BOT_API_SECRET?.trim() || null;
}

async function tryBotDelivery(input: UserNotificationDmInput): Promise<boolean> {
  const secret = botApiSecret();
  if (!secret) {
    logDispatch("bot delivery skipped — BOT_API_SECRET not set");
    return false;
  }

  try {
    const response = await fetch(`${botInternalUrl()}/internal/notifications/deliver`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(5000),
    });

    const data = (await response.json().catch(() => ({}))) as {
      sent?: boolean;
      reason?: string;
    };

    if (response.ok && data.sent === true) {
      logDispatch("bot delivery sent", { userId: input.userId, title: input.title });
      return true;
    }

    logDispatch("bot delivery failed", {
      userId: input.userId,
      title: input.title,
      status: response.status,
      reason: data.reason,
    });
    return false;
  } catch (error) {
    logDispatch("bot delivery unreachable", {
      userId: input.userId,
      title: input.title,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

async function directDelivery(
  input: UserNotificationDmInput,
): Promise<{ sent: boolean; reason?: string }> {
  const { deliverUserNotificationDm } = await import("@/server/bot-notification-delivery.service");
  return deliverUserNotificationDm(input);
}

export async function dispatchNotificationDm(
  input: UserNotificationDmInput,
): Promise<{ sent: boolean; via: "bot" | "direct" | "none"; reason?: string }> {
  try {
    const direct = await directDelivery(input);
    if (direct.sent) {
      logDispatch("direct delivery sent", { userId: input.userId, title: input.title });
      return { sent: true, via: "direct" };
    }

    logDispatch("direct delivery failed", {
      userId: input.userId,
      title: input.title,
      reason: direct.reason,
    });

    const viaBot = await tryBotDelivery(input);
    if (viaBot) return { sent: true, via: "bot" };

    return { sent: false, via: "none", reason: direct.reason };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logDispatch("dispatch error", { userId: input.userId, title: input.title, error: message });
    return { sent: false, via: "none", reason: message };
  }
}
