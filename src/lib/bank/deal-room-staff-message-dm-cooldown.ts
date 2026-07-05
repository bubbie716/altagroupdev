import type { SecureDealRoomType } from "@prisma/client";
import { prisma } from "@/server/db";

/** Minimum interval between deal room staff-message DMs to the same applicant. */
export const DEAL_ROOM_STAFF_MESSAGE_DM_COOLDOWN_MS = 10 * 60 * 1000;

export type StaffDealRoomMessageDmCooldownInput = {
  dealRoomType: SecureDealRoomType;
  dealRoomId: string;
  applicantUserId: string;
};

export function dealRoomStaffMessageDmCooldownCutoff(
  nowMs = Date.now(),
): Date {
  return new Date(nowMs - DEAL_ROOM_STAFF_MESSAGE_DM_COOLDOWN_MS);
}

export function isStaffDealRoomMessageDmCooldownActive(
  lastDmSentAt: Date | null | undefined,
  cutoff: Date,
): boolean {
  return lastDmSentAt != null && lastDmSentAt > cutoff;
}

/** Returns true when a staff deal room message should trigger a customer Discord DM. */
export async function shouldSendStaffDealRoomMessageDm(
  input: StaffDealRoomMessageDmCooldownInput,
): Promise<boolean> {
  const cutoff = dealRoomStaffMessageDmCooldownCutoff();

  const session = await prisma.secureDealRoomDiscordSession.findUnique({
    where: {
      dealRoomType_dealRoomId: {
        dealRoomType: input.dealRoomType,
        dealRoomId: input.dealRoomId,
      },
    },
    select: { lastStaffMessageDmAt: true },
  });

  if (isStaffDealRoomMessageDmCooldownActive(session?.lastStaffMessageDmAt, cutoff)) {
    return false;
  }

  const recentNotification = await prisma.userNotification.findFirst({
    where: {
      userId: input.applicantUserId,
      type: "DEAL_ROOM_MESSAGE_RECEIVED",
      discordNotifiedAt: { gte: cutoff },
      AND: [
        { metadata: { path: ["dealRoomId"], equals: input.dealRoomId } },
        { metadata: { path: ["dealRoomType"], equals: input.dealRoomType } },
      ],
    },
    select: { id: true },
  });

  return recentNotification == null;
}

export async function recordStaffDealRoomMessageDmSent(
  input: Pick<StaffDealRoomMessageDmCooldownInput, "dealRoomType" | "dealRoomId">,
): Promise<void> {
  await prisma.secureDealRoomDiscordSession.updateMany({
    where: {
      dealRoomType: input.dealRoomType,
      dealRoomId: input.dealRoomId,
    },
    data: { lastStaffMessageDmAt: new Date() },
  });
}
