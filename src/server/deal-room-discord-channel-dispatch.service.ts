import {
  directEnsureDealRoomChannel,
  directLockDealRoomChannel,
  directPostDealRoomChannelMessage,
} from "@/server/deal-room-discord-channel-direct.service";
import type {
  EnsureChannelDispatchInput,
  EnsureChannelDispatchResult,
} from "@/lib/bank/secure-deal-room-discord-types";

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

async function postToBot<T extends { ok?: boolean }>(
  path: string,
  body: Record<string, unknown>,
): Promise<T | null> {
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
    if (!response.ok || data.ok === false) {
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

export type { EnsureChannelDispatchInput, EnsureChannelDispatchResult } from "@/lib/bank/secure-deal-room-discord-types";

async function ensureViaBot(
  input: EnsureChannelDispatchInput,
): Promise<EnsureChannelDispatchResult | null> {
  return postToBot<EnsureChannelDispatchResult>("/internal/deal-room/channel/ensure", input);
}

async function messageViaBot(input: {
  channelId: string;
  content?: string;
  embedTitle?: string;
  embedDescription?: string;
}): Promise<{ ok: boolean; messageId?: string; reason?: string } | null> {
  return postToBot<{ ok: boolean; messageId?: string; reason?: string }>(
    "/internal/deal-room/channel/message",
    input,
  );
}

async function lockViaBot(input: {
  channelId: string;
  customerDiscordUserId: string;
}): Promise<{ ok: boolean; reason?: string } | null> {
  return postToBot<{ ok: boolean; reason?: string }>("/internal/deal-room/channel/lock", input);
}

export async function dispatchEnsureDealRoomChannel(
  input: EnsureChannelDispatchInput,
): Promise<EnsureChannelDispatchResult> {
  const direct = await directEnsureDealRoomChannel(input);
  if (direct.ok) {
    logDispatch("direct channel ensure sent", {
      dealRoomId: input.dealRoomId,
      channelId: direct.channelId,
      linked: direct.linked,
    });
    return direct;
  }

  logDispatch("direct channel ensure failed, trying bot", {
    dealRoomId: input.dealRoomId,
    reason: direct.reason,
  });

  const viaBot = await ensureViaBot(input);
  if (viaBot?.ok) {
    logDispatch("bot channel ensure sent", { dealRoomId: input.dealRoomId });
    return viaBot;
  }

  return { ok: false, reason: viaBot?.reason ?? direct.reason ?? "delivery_failed" };
}

export async function dispatchPostDealRoomChannelMessage(input: {
  channelId: string;
  content?: string;
  embedTitle?: string;
  embedDescription?: string;
}): Promise<{ ok: boolean; messageId?: string; reason?: string }> {
  const direct = await directPostDealRoomChannelMessage(input);
  if (direct.ok) {
    logDispatch("direct channel message sent", { channelId: input.channelId });
    return direct;
  }

  logDispatch("direct channel message failed, trying bot", {
    channelId: input.channelId,
    reason: direct.reason,
  });

  const viaBot = await messageViaBot(input);
  if (viaBot?.ok) {
    logDispatch("bot channel message sent", { channelId: input.channelId });
    return viaBot;
  }

  return { ok: false, reason: viaBot?.reason ?? direct.reason ?? "delivery_failed" };
}

export async function dispatchLockDealRoomChannel(input: {
  channelId: string;
  customerDiscordUserId: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const direct = await directLockDealRoomChannel(input);
  if (direct.ok) {
    logDispatch("direct channel lock sent", { channelId: input.channelId });
    return direct;
  }

  const viaBot = await lockViaBot(input);
  if (viaBot?.ok) return viaBot;

  return { ok: false, reason: viaBot?.reason ?? direct.reason ?? "delivery_failed" };
}
