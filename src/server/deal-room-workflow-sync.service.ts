import type { Prisma } from "@prisma/client";
import type { DealRoomWorkflowStage as DbWorkflowStage } from "@prisma/client";
import { deriveWorkflowStage } from "@/lib/bank/deal-room-workflow";
import { insertDealRoomSystemUpdateInTx } from "@/server/deal-room.service";

/** Sync workflow stage from room state; records history when stage changes. */
export async function syncDealRoomWorkflowStageInTx(
  tx: Prisma.TransactionClient,
  dealRoomId: string,
  input: {
    status: Prisma.DealRoomGetPayload<object>["status"];
    currentStage: DbWorkflowStage;
    stageEnteredAt: Date;
    assignedOfficerId: string | null;
    activeDraftStatus?: string | null;
  },
  options?: { changedByUserId?: string; forceStage?: DbWorkflowStage },
): Promise<DbWorkflowStage> {
  const nextStage =
    options?.forceStage ??
    deriveWorkflowStage({
      status: input.status,
      currentStage: input.currentStage,
      activeDraftStatus: input.activeDraftStatus as never,
    });

  if (nextStage === input.currentStage) return nextStage;

  const now = new Date();
  await tx.dealRoomStageHistory.updateMany({
    where: { dealRoomId, exitedAt: null },
    data: { exitedAt: now },
  });

  await tx.dealRoomStageHistory.create({
    data: {
      dealRoomId,
      stage: nextStage,
      ownerUserId: input.assignedOfficerId,
      changedByUserId: options?.changedByUserId ?? null,
      enteredAt: now,
    },
  });

  await tx.dealRoom.update({
    where: { id: dealRoomId },
    data: { workflowStage: nextStage, stageEnteredAt: now, stalledAt: null },
  });

  await insertDealRoomSystemUpdateInTx(
    tx,
    dealRoomId,
    `Deal moved to ${nextStage.replaceAll("_", " ").toLowerCase()}.`,
    { metadata: { workflowStage: nextStage }, actorUserId: options?.changedByUserId },
  );

  return nextStage;
}
