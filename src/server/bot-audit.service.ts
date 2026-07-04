import { auditSourceMetadata } from "@/lib/internal/audit-metadata";
import { writeAuditLog } from "@/server/audit.service";
import {
  recordFailedAction,
  recordPermissionDeniedAction,
} from "@/server/failed-action-audit.service";
import { prisma } from "@/server/db";

export type BotBankingAction = "deposit" | "withdrawal" | "transfer" | "alta_pay";

const BANKING_FAILURE_ACTION: Record<BotBankingAction, string> = {
  deposit: "BANK_DEPOSIT_REQUEST_FAILED",
  withdrawal: "BANK_WITHDRAWAL_REQUEST_FAILED",
  transfer: "BANK_INTERNAL_TRANSFER_FAILED",
  alta_pay: "ALTA_PAY_FAILED",
};

export function friendlyBotFailureReason(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (raw.startsWith("BAD_REQUEST:")) return raw.replace(/^BAD_REQUEST:/, "").trim();
  if (raw === "FORBIDDEN") return "Permission denied";
  if (raw === "NOT_FOUND") return "Resource not found";
  return raw.trim() || "Unknown error";
}

async function resolveActorUserId(discordUserId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { discordId: discordUserId },
    select: { id: true },
  });
  return user?.id ?? null;
}

async function resolveActorUserIdOrSystem(discordUserId: string): Promise<string> {
  const userId = await resolveActorUserId(discordUserId);
  if (userId) return userId;
  const { resolveSystemActorUserId } = await import("@/server/system-actor.service");
  return resolveSystemActorUserId();
}

/** Records a failed customer banking action initiated from the Discord bot. */
export async function recordBotBankingActionFailedBestEffort(input: {
  userId: string;
  action: BotBankingAction;
  reason: string;
  amount?: number;
  accountId?: string;
  payeeLabel?: string;
}): Promise<void> {
  try {
    await writeAuditLog({
      actorUserId: input.userId,
      action: BANKING_FAILURE_ACTION[input.action],
      entityType: "USER",
      entityId: input.userId,
      targetUserId: input.userId,
      targetAccountId: input.accountId,
      description: `Discord bot ${input.action.replace("_", " ")} failed`,
      metadata: auditSourceMetadata("discord_bot", {
        amount: input.amount ?? null,
        failureReason: input.reason,
        payeeLabel: input.payeeLabel ?? null,
        severity: "warning",
      }),
    });
  } catch (error) {
    console.error("[bot-audit] banking failure audit error", error);
  }
}

/** Records Discord transfer convenience fee collection. */
export async function recordBotDiscordTransferFeeBestEffort(input: {
  userId: string;
  accountId: string;
  fee: number;
  transferReference: string;
}): Promise<void> {
  if (input.fee <= 0) return;

  try {
    await writeAuditLog({
      actorUserId: input.userId,
      action: "DISCORD_TRANSFER_CONVENIENCE_FEE",
      entityType: "BANK_ACCOUNT",
      entityId: input.accountId,
      targetUserId: input.userId,
      targetAccountId: input.accountId,
      description: `Discord banking convenience fee for transfer ${input.transferReference}`,
      metadata: auditSourceMetadata("discord_bot", {
        amount: input.fee,
        referenceCode: input.transferReference,
        feeReferenceCode: `${input.transferReference}-FEE`,
      }),
    });
  } catch (error) {
    console.error("[bot-audit] transfer fee audit error", error);
  }
}

/** Records a permission or access denial on the Discord bot. */
export async function recordBotPermissionDeniedBestEffort(input: {
  discordUserId: string;
  actionAttempted: string;
  failureReason?: string;
  entityType?: "USER" | "PLATFORM" | "DEAL_ROOM";
  entityId?: string;
}): Promise<void> {
  try {
    const actorUserId = await resolveActorUserIdOrSystem(input.discordUserId);
    const linkedUserId = await resolveActorUserId(input.discordUserId);

    if (linkedUserId) {
      await recordPermissionDeniedAction({
        actorUserId: linkedUserId,
        actionAttempted: input.actionAttempted,
        entityType: input.entityType ?? "USER",
        entityId: input.entityId ?? linkedUserId,
        source: "discord_bot",
      });
      return;
    }

    await recordFailedAction({
      actorUserId,
      actionAttempted: input.actionAttempted,
      failureReason: input.failureReason ?? "Permission denied",
      entityType: input.entityType ?? "USER",
      entityId: input.entityId,
      source: "discord_bot",
      auditAction: "OPS_PERMISSION_DENIED",
      metadata: { discordUserId: input.discordUserId },
    });
  } catch (error) {
    console.error("[bot-audit] permission denied audit error", error);
  }
}

/** Records a failed invitation response from the Discord bot. */
export async function recordBotInvitationActionFailedBestEffort(input: {
  userId: string;
  kind: "private" | "company";
  action: "accept" | "decline";
  invitationId: string;
  reason: string;
}): Promise<void> {
  try {
    await recordFailedAction({
      actorUserId: input.userId,
      actionAttempted: `${input.kind.toUpperCase()}_INVITATION_${input.action.toUpperCase()}`,
      failureReason: input.reason,
      entityType: "USER",
      entityId: input.userId,
      targetUserId: input.userId,
      source: "discord_bot",
      metadata: { invitationId: input.invitationId, kind: input.kind, action: input.action },
    });
  } catch (error) {
    console.error("[bot-audit] invitation failure audit error", error);
  }
}

/** Records an unexpected bot hub or command interaction failure. */
export async function recordBotInteractionFailedBestEffort(input: {
  discordUserId: string;
  actionAttempted: string;
  reason: string;
  userId?: string;
}): Promise<void> {
  try {
    const actorUserId = input.userId ?? (await resolveActorUserIdOrSystem(input.discordUserId));
    await recordFailedAction({
      actorUserId,
      actionAttempted: input.actionAttempted,
      failureReason: input.reason,
      entityType: "USER",
      entityId: input.userId ?? actorUserId,
      targetUserId: input.userId,
      source: "discord_bot",
      metadata: { discordUserId: input.discordUserId },
    });
  } catch (error) {
    console.error("[bot-audit] interaction failure audit error", error);
  }
}
