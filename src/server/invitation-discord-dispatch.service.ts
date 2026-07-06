export type InvitationKind = "private" | "company";

function logDispatch(message: string, meta?: Record<string, unknown>): void {
  if (process.env.NODE_ENV === "test") return;
  console.info(`[invitation-dispatch] ${message}`, meta ?? {});
}

function botInternalUrl(): string {
  return process.env.BOT_INTERNAL_URL?.trim() || "http://127.0.0.1:3847";
}

function botApiSecret(): string | null {
  return process.env.BOT_API_SECRET?.trim() || null;
}

async function tryBotDelivery(kind: InvitationKind, invitationId: string): Promise<boolean> {
  const secret = botApiSecret();
  if (!secret) {
    logDispatch("bot delivery skipped — BOT_API_SECRET not set");
    return false;
  }

  try {
    const response = await fetch(`${botInternalUrl()}/internal/invitations/deliver`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ kind, invitationId }),
      signal: AbortSignal.timeout(5000),
    });

    const data = (await response.json().catch(() => ({}))) as {
      sent?: boolean;
      reason?: string;
    };

    if (response.ok && data.sent === true) {
      logDispatch("bot delivery sent", { kind, invitationId });
      return true;
    }

    logDispatch("bot delivery failed", {
      kind,
      invitationId,
      status: response.status,
      reason: data.reason,
    });
    return false;
  } catch (error) {
    logDispatch("bot delivery unreachable", {
      kind,
      invitationId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

async function directDelivery(
  kind: InvitationKind,
  invitationId: string,
): Promise<{ sent: boolean; reason?: string }> {
  const { deliverAltaPrivateInvitationDm, deliverCompanyInvitationDm } = await import(
    "@/server/bot-invitation-delivery.service"
  );

  if (kind === "private") {
    return deliverAltaPrivateInvitationDm(invitationId);
  }

  return deliverCompanyInvitationDm(invitationId);
}

export async function dispatchInvitationDm(
  kind: InvitationKind,
  invitationId: string,
): Promise<{ sent: boolean; via: "bot" | "direct" | "none"; reason?: string }> {
  try {
    const direct = await directDelivery(kind, invitationId);
    if (direct.sent) {
      logDispatch("direct delivery sent", { kind, invitationId });
      return { sent: true, via: "direct" };
    }

    logDispatch("direct delivery failed", { kind, invitationId, reason: direct.reason });

    const viaBot = await tryBotDelivery(kind, invitationId);
    if (viaBot) return { sent: true, via: "bot" };

    return { sent: false, via: "none", reason: direct.reason };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logDispatch("dispatch error", { kind, invitationId, error: message });
    return { sent: false, via: "none", reason: message };
  }
}

/** Invitation DMs must not block invite flows — deliver in the background. */
export function scheduleDispatchInvitationDm(kind: InvitationKind, invitationId: string): void {
  void dispatchInvitationDm(kind, invitationId).catch((error) => {
    logDispatch("background invitation dispatch failed", {
      kind,
      invitationId,
      error: error instanceof Error ? error.message : String(error),
    });
  });
}
