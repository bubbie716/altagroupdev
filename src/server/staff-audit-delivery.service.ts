import { deliverStaffAuditToDiscordChannel } from "@/server/staff-audit-discord-dispatch.service";

function logDelivery(message: string, meta?: Record<string, unknown>): void {
  if (process.env.NODE_ENV === "test") return;
  console.info(`[staff-audit-delivery] ${message}`, meta ?? {});
}

export async function deliverStaffAuditChannelMessage(
  content: string,
): Promise<{ sent: boolean; reason?: string }> {
  const result = await deliverStaffAuditToDiscordChannel(content);
  if (!result.sent) {
    logDelivery("staff audit channel message skipped", { reason: result.reason });
    return result;
  }
  logDelivery("staff audit channel message sent");
  return result;
}
