import type { DealRoomStatus as DbDealRoomStatus, Prisma } from "@prisma/client";
/**
 * Legacy full-feature deal room service (Prisma `DealRoom` model).
 *
 * V1 lending uses `LoanApplicationThread` (Secure Deal Room) via
 * `loan-application-thread.service.ts`. This module remains for historical
 * records, dashboard metrics, notifications, and agreement execution paths.
 * UI routes under `/bank/lending/deal-rooms/*` redirect to applications.
 */
import type { AltaUser } from "@/lib/auth/types";
import {
  canAccessBankInternal,
  canManageBusinessTreasury,
  canViewCompanyDealRoom,
  isAdmin,
} from "@/lib/auth/permissions";
import type {
  AddDealRoomSystemUpdateInput,
  DealRoomListRow,
  DealRoomMessageRow,
  SendDealRoomMessageInput,
} from "@/lib/bank/deal-room-types";
import { DEAL_ROOM_MESSAGE_MAX_LENGTH, DEAL_ROOM_MESSAGE_SENDER_DELETE_WINDOW_MS } from "@/lib/bank/deal-room-types";
import type { DealRoom } from "@/lib/bank/deal-rooms-mock";
import type { DealRoomMessageType } from "@prisma/client";
import { prisma } from "@/server/db";
import {
  dealRoomInclude,
  dealRoomMessageInclude,
  mapDealRoomDetail,
  mapDealRoomListRow,
  mapDealRoomMessage,
  type DealRoomRecord,
} from "@/server/deal-room-mapper";
import { mapDbUserToAltaUser, userWithMembershipsInclude } from "@/server/user-mapper";
import { writeAuditLog } from "@/server/audit.service";

function forbidden(): never {
  throw new Error("FORBIDDEN");
}

function notFound(): never {
  throw new Error("NOT_FOUND");
}

function badRequest(message: string): never {
  throw new Error(`BAD_REQUEST:${message}`);
}

async function getAltaUser(userId: string): Promise<AltaUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: userWithMembershipsInclude,
  });
  if (!user) notFound();
  return mapDbUserToAltaUser(user);
}

function canManageDealRoomOps(user: AltaUser): boolean {
  return canAccessBankInternal(user);
}

function canViewDealRoom(user: AltaUser, room: Pick<DealRoomRecord, "borrowerUserId" | "companyId">): boolean {
  if (canAccessBankInternal(user)) return true;
  if (room.borrowerUserId === user.id) return true;
  if (room.companyId && canViewCompanyDealRoom(user, room.companyId)) return true;
  return false;
}

async function getDealRoomRecord(dealRoomId: string): Promise<DealRoomRecord> {
  const room = await prisma.dealRoom.findUnique({
    where: { id: dealRoomId },
    include: dealRoomInclude,
  });
  if (!room) notFound();
  return room;
}

async function assertCanViewDealRoom(userId: string, dealRoomId: string): Promise<{
  user: AltaUser;
  room: DealRoomRecord;
}> {
  const [user, room] = await Promise.all([getAltaUser(userId), getDealRoomRecord(dealRoomId)]);
  if (!canViewDealRoom(user, room)) forbidden();
  return { user, room };
}

function companyIdsForDealRoomView(user: AltaUser): string[] {
  return user.companyMemberships
    .filter((m) => canViewCompanyDealRoom(user, m.companyId))
    .map((m) => m.companyId);
}

const CLOSED_STATUSES: DbDealRoomStatus[] = ["DECLINED", "CLOSED", "EXECUTED"];

function validateMessageBody(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) badRequest("Message body is required.");
  if (trimmed.length > DEAL_ROOM_MESSAGE_MAX_LENGTH) {
    badRequest(`Message must be ${DEAL_ROOM_MESSAGE_MAX_LENGTH} characters or fewer.`);
  }
  return trimmed;
}

function canSendApplicantMessage(user: AltaUser, room: DealRoomRecord): boolean {
  if (room.borrowerUserId === user.id) return true;
  if (room.companyId && canManageBusinessTreasury(user, { companyId: room.companyId })) return true;
  return false;
}

function assertRoomAcceptsMessages(room: DealRoomRecord, user: AltaUser): void {
  if (room.status === "EXECUTED") {
    badRequest("This deal room has been successfully executed. No further messages are accepted.");
  }
  if (CLOSED_STATUSES.includes(room.status) && !canManageDealRoomOps(user)) {
    badRequest("This deal room is closed and no longer accepts messages.");
  }
}

function nextStatusAfterApplicantMessage(current: DbDealRoomStatus): DbDealRoomStatus | null {
  if (current === "NEGOTIATING_TERMS" || current === "AWAITING_APPLICANT") return "AWAITING_OFFICER";
  return null;
}

function nextStatusAfterOfficerMessage(current: DbDealRoomStatus): DbDealRoomStatus | null {
  if (current === "UNDER_REVIEW" || current === "NEGOTIATING_TERMS" || current === "AWAITING_OFFICER") {
    return "AWAITING_APPLICANT";
  }
  return null;
}

async function writeMessageAudit(
  actorUserId: string,
  action: string,
  dealRoomId: string,
  message: { id: string; messageType: DealRoomMessageType; senderUserId: string | null },
  room: DealRoomRecord,
): Promise<void> {
  await writeAuditLog({
    actorUserId,
    action,
    entityType: "DEAL_ROOM",
    entityId: dealRoomId,
    targetUserId: room.borrowerUserId,
    targetCompanyId: room.companyId ?? undefined,
    description: `${action.replaceAll("_", " ").toLowerCase()} in deal room ${dealRoomId}.`,
    metadata: {
      dealRoomId,
      messageId: message.id,
      messageType: message.messageType,
      senderUserId: message.senderUserId,
    },
  });
}

export async function createDealRoomForLoanApplication(
  actorUserId: string,
  loanApplicationId: string,
): Promise<DealRoomListRow> {
  const application = await prisma.loanApplication.findUnique({
    where: { id: loanApplicationId },
  });
  if (!application) notFound();

  const existing = await prisma.dealRoom.findUnique({
    where: { loanApplicationId },
    include: dealRoomInclude,
  });
  if (existing) return mapDealRoomListRow(existing);

  const actor = await getAltaUser(actorUserId);
  const isApplicant = application.applicantUserId === actorUserId;
  const isInternal = canManageDealRoomOps(actor);
  if (!isApplicant && !isInternal) forbidden();

  const room = await prisma.$transaction(async (tx) => {
    const created = await tx.dealRoom.create({
      data: {
        loanApplicationId: application.id,
        borrowerUserId: application.applicantUserId,
        companyId: application.companyId,
        createdByUserId: actorUserId,
        status: "UNDER_REVIEW",
        workflowStage: "APPLICATION_RECEIVED",
        currentRequestedAmount: application.requestedAmount,
        currentProposedTermMonths: application.termMonths,
        participants: {
          create: {
            userId: application.applicantUserId,
            role: "APPLICANT",
          },
        },
      },
      include: dealRoomInclude,
    });

    await tx.dealRoomStageHistory.create({
      data: {
        dealRoomId: created.id,
        stage: "APPLICATION_RECEIVED",
        changedByUserId: actorUserId,
      },
    });

    return created;
  });

  const { createUserNotification } = await import("@/server/notification.service");
  await createUserNotification({
    userId: room.borrowerUserId,
    type: "DEAL_ROOM_CREATED",
    title: "Secure Deal Room opened",
    body: "Your Secure Deal Room is ready. Alta Bank will review your application here.",
    linkUrl: `/bank/lending/applications/${application.id}/thread`,
    metadata: { dealRoomId: room.id, loanApplicationId: application.id },
  });
  if (room.assignedOfficerId) {
    await createUserNotification({
      userId: room.assignedOfficerId,
      type: "DEAL_ROOM_CREATED",
      title: "Secure Deal Room opened",
      body: "A Secure Deal Room is ready for application review.",
      linkUrl: `/internal/lending/applications/${application.id}/thread`,
      metadata: { dealRoomId: room.id, loanApplicationId: application.id },
    });
  }

  await writeAuditLog({
    actorUserId,
    action: "DEAL_ROOM_CREATED",
    entityType: "DEAL_ROOM",
    entityId: room.id,
    targetUserId: room.borrowerUserId,
    targetCompanyId: room.companyId ?? undefined,
    description: `Secure deal room opened for loan application ${application.id}.`,
    metadata: {
      loanApplicationId: application.id,
      status: room.status,
    },
  });

  return mapDealRoomListRow(room);
}

export async function getUserDealRooms(userId: string): Promise<DealRoomListRow[]> {
  const user = await getAltaUser(userId);
  const companyIds = companyIdsForDealRoomView(user);

  const rooms = await prisma.dealRoom.findMany({
    where: {
      OR: [{ borrowerUserId: userId }, ...(companyIds.length ? [{ companyId: { in: companyIds } }] : [])],
    },
    include: dealRoomInclude,
    orderBy: { updatedAt: "desc" },
  });

  return rooms.map(mapDealRoomListRow);
}

export async function getDealRoomDetail(userId: string, dealRoomId: string): Promise<DealRoom> {
  const { room } = await assertCanViewDealRoom(userId, dealRoomId);
  return mapDealRoomDetail(room);
}

export async function getInternalDealRooms(): Promise<DealRoomListRow[]> {
  const rooms = await prisma.dealRoom.findMany({
    include: dealRoomInclude,
    orderBy: { updatedAt: "desc" },
  });
  return rooms.map(mapDealRoomListRow);
}

export async function assignDealRoomOfficer(
  actorUserId: string,
  dealRoomId: string,
  officerUserId: string,
): Promise<DealRoomListRow> {
  const actor = await getAltaUser(actorUserId);
  if (!canManageDealRoomOps(actor)) forbidden();

  const officer = await prisma.user.findUnique({ where: { id: officerUserId } });
  if (!officer) badRequest("Officer user not found");

  const existing = await getDealRoomRecord(dealRoomId);

  const room = await prisma.$transaction(async (tx) => {
    await tx.dealRoomParticipant.upsert({
      where: {
        dealRoomId_userId_role: {
          dealRoomId,
          userId: officerUserId,
          role: "LOAN_OFFICER",
        },
      },
      create: {
        dealRoomId,
        userId: officerUserId,
        role: "LOAN_OFFICER",
      },
      update: {},
    });

    const updated = await tx.dealRoom.update({
      where: { id: dealRoomId },
      data: { assignedOfficerId: officerUserId },
      include: dealRoomInclude,
    });

    const label = existing.assignedOfficerId ? "reassigned" : "assigned";
    await insertDealRoomSystemUpdateInTx(
      tx,
      dealRoomId,
      `Assigned banker ${label}: ${officer.discordUsername}.`,
      { actorUserId, metadata: { officerUserId, previousOfficerUserId: existing.assignedOfficerId } },
    );

    return updated;
  });

  const { createUserNotification } = await import("@/server/notification.service");
  await createUserNotification({
    userId: officerUserId,
    type: "DEAL_ROOM_OFFICER_ASSIGNED",
    title: existing.assignedOfficerId ? "Secure Deal Room reassigned to you" : "Secure Deal Room assigned to you",
    body: `You have access to review this legacy Secure Deal Room ${dealRoomId.slice(0, 12)}.`,
    linkUrl: room.loanApplicationId
      ? `/internal/lending/applications/${room.loanApplicationId}/thread`
      : `/internal/lending`,
    metadata: { dealRoomId },
  });

  await writeAuditLog({
    actorUserId,
    action: "DEAL_ROOM_OFFICER_ASSIGNED",
    entityType: "DEAL_ROOM",
    entityId: room.id,
    targetUserId: room.borrowerUserId,
    targetCompanyId: room.companyId ?? undefined,
    description: `Assigned ${officer.discordUsername} as banker for legacy deal room ${room.id}.`,
    metadata: {
      officerUserId,
      previousOfficerUserId: existing.assignedOfficerId,
    },
  });

  return mapDealRoomListRow(room);
}

export async function updateDealRoomStatus(
  actorUserId: string,
  dealRoomId: string,
  status: DbDealRoomStatus,
): Promise<DealRoomListRow> {
  const actor = await getAltaUser(actorUserId);
  if (!canManageDealRoomOps(actor)) forbidden();

  const existing = await getDealRoomRecord(dealRoomId);

  const room = await prisma.$transaction(async (tx) => {
    const updated = await tx.dealRoom.update({
      where: { id: dealRoomId },
      data: {
        status,
        closedAt: CLOSED_STATUSES.includes(status)
          ? existing.closedAt ?? new Date()
          : null,
      },
      include: {
        ...dealRoomInclude,
        agreement: { include: { activeDraft: { select: { status: true } } } },
      },
    });

    const { syncDealRoomWorkflowStageInTx } = await import("@/server/deal-room-workflow-sync.service");
    await syncDealRoomWorkflowStageInTx(
      tx,
      dealRoomId,
      {
        status: updated.status,
        currentStage: updated.workflowStage,
        stageEnteredAt: updated.stageEnteredAt,
        assignedOfficerId: updated.assignedOfficerId,
        activeDraftStatus: updated.agreement?.activeDraft?.status ?? null,
      },
      { changedByUserId: actorUserId },
    );

    return tx.dealRoom.findUniqueOrThrow({
      where: { id: dealRoomId },
      include: dealRoomInclude,
    });
  });

  await writeAuditLog({
    actorUserId,
    action: "DEAL_ROOM_STATUS_CHANGED",
    entityType: "DEAL_ROOM",
    entityId: room.id,
    targetUserId: room.borrowerUserId,
    targetCompanyId: room.companyId ?? undefined,
    description: `Deal room ${room.id} status changed to ${status}.`,
    metadata: {
      previousStatus: existing.status,
      nextStatus: status,
    },
  });

  return mapDealRoomListRow(room);
}

export async function getDealRoomMessages(
  actorUserId: string,
  dealRoomId: string,
): Promise<DealRoomMessageRow[]> {
  const { user } = await assertCanViewDealRoom(actorUserId, dealRoomId);
  const includeInternal = canManageDealRoomOps(user);

  const messages = await prisma.dealRoomMessage.findMany({
    where: {
      dealRoomId,
      deletedAt: null,
      ...(includeInternal ? {} : { messageType: { not: "INTERNAL_NOTE" } }),
    },
    include: dealRoomMessageInclude,
    orderBy: { createdAt: "asc" },
  });

  return messages.map(mapDealRoomMessage);
}

export async function sendDealRoomMessage(
  actorUserId: string,
  input: SendDealRoomMessageInput,
): Promise<DealRoomMessageRow> {
  const body = validateMessageBody(input.body);
  const { user, room } = await assertCanViewDealRoom(actorUserId, input.dealRoomId);
  assertRoomAcceptsMessages(room, user);

  const channel = input.channel ?? "applicant";
  let messageType: DealRoomMessageType;

  if (channel === "officer") {
    if (!canManageDealRoomOps(user)) forbidden();
    messageType = "OFFICER_MESSAGE";
  } else if (channel === "internal_note") {
    return addInternalDealRoomNote(input.dealRoomId, body, actorUserId);
  } else {
    if (!canSendApplicantMessage(user, room)) forbidden();
    if (canManageDealRoomOps(user) && room.borrowerUserId !== user.id) {
      badRequest("Staff must use officer messages, not applicant messages.");
    }
    messageType = "APPLICANT_MESSAGE";
  }

  const nextStatus =
    messageType === "APPLICANT_MESSAGE"
      ? nextStatusAfterApplicantMessage(room.status)
      : nextStatusAfterOfficerMessage(room.status);

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.dealRoomMessage.create({
      data: {
        dealRoomId: input.dealRoomId,
        senderUserId: actorUserId,
        messageType,
        body,
      },
      include: dealRoomMessageInclude,
    });

    await tx.dealRoom.update({
      where: { id: input.dealRoomId },
      data: {
        updatedAt: new Date(),
        ...(nextStatus ? { status: nextStatus } : {}),
        ...(messageType === "OFFICER_MESSAGE" && !room.slaOfficerFirstResponseAt
          ? { slaOfficerFirstResponseAt: new Date() }
          : {}),
      },
    });

    if (nextStatus) {
      const { syncDealRoomWorkflowStageInTx } = await import("@/server/deal-room-workflow-sync.service");
      const refreshed = await tx.dealRoom.findUnique({
        where: { id: input.dealRoomId },
        include: { agreement: { include: { activeDraft: true } } },
      });
      if (refreshed) {
        await syncDealRoomWorkflowStageInTx(tx, input.dealRoomId, {
          status: refreshed.status,
          currentStage: refreshed.workflowStage,
          stageEnteredAt: refreshed.stageEnteredAt,
          assignedOfficerId: refreshed.assignedOfficerId,
          activeDraftStatus: refreshed.agreement?.activeDraft?.status ?? null,
        }, { changedByUserId: actorUserId });
      }
    }

    if (messageType === "APPLICANT_MESSAGE" && room.borrowerUserId !== actorUserId) {
      await tx.dealRoomParticipant.upsert({
        where: {
          dealRoomId_userId_role: {
            dealRoomId: input.dealRoomId,
            userId: actorUserId,
            role: "COMPANY_REPRESENTATIVE",
          },
        },
        create: {
          dealRoomId: input.dealRoomId,
          userId: actorUserId,
          role: "COMPANY_REPRESENTATIVE",
        },
        update: {},
      });
    }

    return created;
  });

  await writeMessageAudit(actorUserId, "DEAL_ROOM_MESSAGE_SENT", input.dealRoomId, message, room);

  return mapDealRoomMessage(message);
}

export async function insertDealRoomSystemUpdateInTx(
  tx: Prisma.TransactionClient,
  dealRoomId: string,
  body: string,
  options?: {
    metadata?: Record<string, unknown>;
    updateStatus?: DbDealRoomStatus;
    actorUserId?: string;
  },
): Promise<void> {
  const trimmed = body.trim();
  if (!trimmed) return;

  await tx.dealRoomMessage.create({
    data: {
      dealRoomId,
      senderUserId: options?.actorUserId ?? null,
      messageType: "SYSTEM_UPDATE",
      body: trimmed,
      metadata: options?.metadata ?? undefined,
    },
  });

  await tx.dealRoom.update({
    where: { id: dealRoomId },
    data: {
      updatedAt: new Date(),
      ...(options?.updateStatus ? { status: options.updateStatus } : {}),
    },
  });
}

export async function addDealRoomSystemUpdate(
  dealRoomId: string,
  body: string,
  metadata?: Record<string, unknown>,
  actorUserId?: string,
  updateStatus?: DbDealRoomStatus,
): Promise<DealRoomMessageRow> {
  const trimmed = validateMessageBody(body);

  if (actorUserId) {
    const actor = await getAltaUser(actorUserId);
    if (!canManageDealRoomOps(actor)) forbidden();
    await assertCanViewDealRoom(actorUserId, dealRoomId);
  }

  const room = await getDealRoomRecord(dealRoomId);

  const message = await prisma.$transaction(async (tx) => {
    await insertDealRoomSystemUpdateInTx(tx, dealRoomId, trimmed, {
      metadata,
      updateStatus,
      actorUserId,
    });

    return tx.dealRoomMessage.findFirstOrThrow({
      where: { dealRoomId, body: trimmed, messageType: "SYSTEM_UPDATE" },
      include: dealRoomMessageInclude,
      orderBy: { createdAt: "desc" },
    });
  });

  if (actorUserId) {
    await writeMessageAudit(actorUserId, "DEAL_ROOM_MESSAGE_SENT", dealRoomId, message, room);
  }

  return mapDealRoomMessage(message);
}

export async function addInternalDealRoomNote(
  dealRoomId: string,
  body: string,
  actorUserId: string,
): Promise<DealRoomMessageRow> {
  const trimmed = validateMessageBody(body);
  const actor = await getAltaUser(actorUserId);
  if (!canManageDealRoomOps(actor)) forbidden();
  await assertCanViewDealRoom(actorUserId, dealRoomId);

  const room = await getDealRoomRecord(dealRoomId);

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.dealRoomMessage.create({
      data: {
        dealRoomId,
        senderUserId: actorUserId,
        messageType: "INTERNAL_NOTE",
        body: trimmed,
      },
      include: dealRoomMessageInclude,
    });

    await tx.dealRoom.update({
      where: { id: dealRoomId },
      data: { updatedAt: new Date() },
    });

    return created;
  });

  await writeAuditLog({
    actorUserId,
    action: "DEAL_ROOM_INTERNAL_NOTE_ADDED",
    entityType: "DEAL_ROOM",
    entityId: dealRoomId,
    targetUserId: room.borrowerUserId,
    targetCompanyId: room.companyId ?? undefined,
    description: `Internal note added to deal room ${dealRoomId}.`,
    metadata: {
      dealRoomId,
      messageId: message.id,
      messageType: message.messageType,
      senderUserId: actorUserId,
    },
  });

  return mapDealRoomMessage(message);
}

export async function softDeleteDealRoomMessage(
  messageId: string,
  actorUserId: string,
): Promise<void> {
  const message = await prisma.dealRoomMessage.findUnique({
    where: { id: messageId },
    include: { dealRoom: { include: dealRoomInclude } },
  });
  if (!message || message.deletedAt) notFound();

  const actor = await getAltaUser(actorUserId);
  const room = message.dealRoom;
  if (!canViewDealRoom(actor, room)) forbidden();

  const isSender = message.senderUserId === actorUserId;
  const withinWindow =
    isSender &&
    Date.now() - message.createdAt.getTime() <= DEAL_ROOM_MESSAGE_SENDER_DELETE_WINDOW_MS;

  if (!canAccessBankInternal(actor) && !withinWindow) {
    badRequest("You can only remove your own messages within 15 minutes, or ask an admin.");
  }

  if (message.messageType === "INTERNAL_NOTE" && !canManageDealRoomOps(actor)) forbidden();

  await prisma.dealRoomMessage.update({
    where: { id: messageId },
    data: { deletedAt: new Date() },
  });

  await writeAuditLog({
    actorUserId,
    action: "DEAL_ROOM_MESSAGE_DELETED",
    entityType: "DEAL_ROOM",
    entityId: room.id,
    targetUserId: room.borrowerUserId,
    targetCompanyId: room.companyId ?? undefined,
    description: `Message removed from deal room ${room.id}.`,
    metadata: {
      dealRoomId: room.id,
      messageId: message.id,
      messageType: message.messageType,
      senderUserId: message.senderUserId,
    },
  });
}

export async function addDealRoomSystemUpdateFromInput(
  actorUserId: string,
  input: AddDealRoomSystemUpdateInput,
): Promise<DealRoomMessageRow> {
  return addDealRoomSystemUpdate(
    input.dealRoomId,
    input.body,
    input.metadata,
    actorUserId,
    input.updateStatus,
  );
}

export {
  deleteDocument,
  generateDownloadLink,
  getDocumentForDownload,
  getDocuments,
  replaceDocument,
  requestDocument,
  reviewDocumentRequest,
  uploadDocument,
} from "@/server/deal-room-document.service";
