function logDispatch(message: string, meta?: Record<string, unknown>): void {
  if (process.env.NODE_ENV === "test") return;
  console.info(`[deal-room-channel-dispatch] ${message}`, meta ?? {});
}

function botInternalUrl(): string {
  return process.env.BOT_INTERNAL_URL?.trim() || "http://127.0.0.1:3847";
}

function botApiSecret(): string | null {
  return process.env.BOT_API_SECRET?.trim() || null;
}

async function postToBot<T>(path: string, body: Record<string, unknown>): Promise<T | null> {
  const secret = botApiSecret();
  if (!secret) {
    logDispatch("bot dispatch skipped — BOT_API_SECRET not set");
    return null;
  }

  try {
    const response = await fetch(`${botInternalUrl()}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });

    const data = (await response.json().catch(() => ({}))) as T;
    if (!response.ok) {
      logDispatch("bot dispatch failed", { path, status: response.status, data });
      return null;
    }
    return data;
  } catch (error) {
    logDispatch("bot dispatch unreachable", {
      path,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export type EnsureChannelDispatchInput = {
  channelName: string;
  customerDiscordUserId: string;
  dealRoomType: string;
  dealRoomId: string;
  welcomeContent: string;
  linkUrl: string;
  existingChannelId?: string | null;
};

export type EnsureChannelDispatchResult = {
  ok: boolean;
  channelId?: string;
  channelName?: string;
  linked?: boolean;
  reason?: string;
};

export async function dispatchEnsureDealRoomChannel(
  input: EnsureChannelDispatchInput,
): Promise<EnsureChannelDispatchResult> {
  const result = await postToBot<EnsureChannelDispatchResult>(
    "/internal/deal-room/channel/ensure",
    input,
  );
  return result ?? { ok: false, reason: "bot_unreachable" };
}

export async function dispatchPostDealRoomChannelMessage(input: {
  channelId: string;
  content: string;
}): Promise<{ ok: boolean; messageId?: string; reason?: string }> {
  const result = await postToBot<{ ok: boolean; messageId?: string; reason?: string }>(
    "/internal/deal-room/channel/message",
    input,
  );
  return result ?? { ok: false, reason: "bot_unreachable" };
}

export async function dispatchLockDealRoomChannel(input: {
  channelId: string;
  customerDiscordUserId: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const result = await postToBot<{ ok: boolean; reason?: string }>(
    "/internal/deal-room/channel/lock",
    input,
  );
  return result ?? { ok: false, reason: "bot_unreachable" };
}
