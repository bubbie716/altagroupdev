import type {
  DealRoomPriority as DbPriority,
  DealRoomTaskStatus as DbTaskStatus,
  DealRoomWorkflowStage as DbWorkflowStage,
  Prisma,
} from "@prisma/client";
import type { AltaUser } from "@/lib/auth/types";
import { isAdmin, isOperator } from "@/lib/auth/permissions";
import {
  hoursInStage,
  isStalled,
  isWaitingOnAlta,
  isWaitingOnBorrower,
  PRIORITY_FROM_DB,
  TASK_STATUS_FROM_DB,
  WORKFLOW_STAGE_DESCRIPTIONS,
  WORKFLOW_STAGE_FROM_DB,
  WORKFLOW_STAGE_LABELS,
  type DealRoomPriorityCode,
  type DealRoomTaskStatusCode,
} from "@/lib/bank/deal-room-workflow";
import type {
  CreateDealRoomTaskInput,
  DealRoomOpsContext,
  DealRoomOpsDashboard,
  DealRoomOpsListRow,
  DealRoomOpsSearchInput,
  DealRoomSlaMetrics,
  DealRoomTaskRow,
  DealRoomTimelineEvent,
  OfficerWorkloadRow,
  UpdateDealRoomTaskInput,
  UpdateDealRoomWorkflowInput,
} from "@/lib/bank/deal-room-ops-types";
import { formatActivityDateTime } from "@/lib/format-datetime";
import { prisma } from "@/server/db";
import { writeAuditLog } from "@/server/audit.service";
import { createUserNotification, createUserNotifications } from "@/server/notification.service";
import { dealRoomInclude, mapDealRoomListRow } from "@/server/deal-room-mapper";
import { insertDealRoomSystemUpdateInTx } from "@/server/deal-room.service";
import { syncDealRoomWorkflowStageInTx } from "@/server/deal-room-workflow-sync.service";
import { mapDbUserToAltaUser, userWithMembershipsInclude } from "@/server/user-mapper";

function forbidden(): never {
  throw new Error("FORBIDDEN");
}

function canManageOps(user: AltaUser): boolean {
  return isAdmin(user) || isOperator(user);
}

async function requireOpsUser(userId: string): Promise<AltaUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: userWithMembershipsInclude,
  });
  if (!user) throw new Error("NOT_FOUND");
  const alta = mapDbUserToAltaUser(user);
  if (!canManageOps(alta)) forbidden();
  return alta;
}

const opsRoomInclude = {
  ...dealRoomInclude,
  createdBy: { select: { id: true, discordUsername: true } },
  agreement: { include: { activeDraft: { select: { status: true } } } },
  _count: { select: { tasks: { where: { status: { in: ["OPEN", "IN_PROGRESS"] as const } } } } },
} satisfies Prisma.DealRoomInclude;

type OpsRoomRecord = Prisma.DealRoomGetPayload<{ include: typeof opsRoomInclude }>;

function mapTaskRow(
  task: Prisma.DealRoomTaskGetPayload<{
    include: { assignedTo: { select: { discordUsername: true } }; createdBy: { select: { discordUsername: true } } };
  }>,
): DealRoomTaskRow {
  return {
    id: task.id,
    dealRoomId: task.dealRoomId,
    title: task.title,
    description: task.description,
    assignedToUserId: task.assignedToUserId,
    assignedToName: task.assignedTo?.discordUsername ?? null,
    priority: PRIORITY_FROM_DB[task.priority] as DealRoomPriorityCode,
    priorityLabel: task.priority.charAt(0) + task.priority.slice(1).toLowerCase(),
    dueDate: task.dueDate?.toISOString() ?? null,
    status: TASK_STATUS_FROM_DB[task.status] as DealRoomTaskStatusCode,
    statusLabel: task.status.replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()),
    createdByName: task.createdBy.discordUsername,
    completedAt: task.completedAt?.toISOString() ?? null,
    createdAt: task.createdAt.toISOString(),
    isOverdue: Boolean(
      task.dueDate && task.status !== "COMPLETED" && task.status !== "CANCELLED" && task.dueDate < new Date(),
    ),
  };
}

function computeSlaMetrics(room: OpsRoomRecord): DealRoomSlaMetrics {
  const ms = (a: Date | null | undefined, b: Date | null | undefined) =>
    a && b ? Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60)) : null;

  return {
    applicationSubmittedAt: room.createdAt.toISOString(),
    officerFirstResponseAt: room.slaOfficerFirstResponseAt?.toISOString() ?? null,
    documentsRequestedAt: room.slaDocumentsRequestedAt?.toISOString() ?? null,
    documentsReceivedAt: room.slaDocumentsReceivedAt?.toISOString() ?? null,
    agreementGeneratedAt: room.slaAgreementGeneratedAt?.toISOString() ?? null,
    borrowerSignedAt: room.slaBorrowerSignedAt?.toISOString() ?? null,
    bankSignedAt: room.slaBankSignedAt?.toISOString() ?? null,
    fundingCompletedAt: room.slaFundingCompletedAt?.toISOString() ?? null,
    timeToFirstResponseHours: ms(room.createdAt, room.slaOfficerFirstResponseAt),
    timeToFundingHours: ms(room.createdAt, room.slaFundingCompletedAt),
    timeWaitingOnApplicantHours: isWaitingOnBorrower(room.workflowStage)
      ? hoursInStage(room.stageEnteredAt)
      : null,
    timeWaitingOnAltaHours: isWaitingOnAlta(room.workflowStage) ? hoursInStage(room.stageEnteredAt) : null,
  };
}

function mapOpsListRow(room: OpsRoomRecord): DealRoomOpsListRow {
  const base = mapDealRoomListRow(room);
  const stage = WORKFLOW_STAGE_FROM_DB[room.workflowStage];
  return {
    ...base,
    workflowStage: stage,
    workflowStageLabel: WORKFLOW_STAGE_LABELS[stage],
    priority: PRIORITY_FROM_DB[room.priority] as DealRoomPriorityCode,
    assignedTeam: room.assignedTeamLabel,
    createdByName: room.createdBy?.discordUsername ?? null,
    openTaskCount: room._count.tasks,
    hoursInStage: hoursInStage(room.stageEnteredAt),
    isStalled: isStalled(room.stageEnteredAt, room.workflowStage) || Boolean(room.stalledAt),
    waitingOn: isWaitingOnBorrower(room.workflowStage)
      ? "borrower"
      : isWaitingOnAlta(room.workflowStage)
        ? "alta"
        : null,
  };
}

function applyFilters(rooms: DealRoomOpsListRow[], filters: DealRoomOpsSearchInput) {
  return rooms.filter((r) => {
    if (filters.stage && filters.stage !== "all" && r.workflowStage !== filters.stage) return false;
    if (filters.priority && filters.priority !== "all" && r.priority !== filters.priority) return false;
    if (filters.officerId && filters.officerId !== "all") {
      if (filters.officerId === "unassigned" && r.assignedOfficerId) return false;
      if (filters.officerId !== "unassigned" && r.assignedOfficerId !== filters.officerId) return false;
    }
    if (filters.status && filters.status !== "all" && r.status !== filters.status) return false;
    if (filters.product && filters.product !== "all" && r.loanProduct !== filters.product) return false;
    if (filters.fundingStatus === "funded" && r.workflowStage !== "completed") return false;
    if (filters.fundingStatus === "open" && r.workflowStage === "completed") return false;
    if (filters.stalledOnly && !r.isStalled) return false;
    if (filters.query) {
      const q = filters.query.toLowerCase();
      const hay = `${r.applicant} ${r.company ?? ""} ${r.id} ${r.loanApplicationId ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export async function getDealRoomOperationsDashboard(
  actorUserId: string,
  filters?: DealRoomOpsSearchInput,
): Promise<DealRoomOpsDashboard> {
  await requireOpsUser(actorUserId);

  const rooms = await prisma.dealRoom.findMany({
    include: opsRoomInclude,
    orderBy: { updatedAt: "desc" },
  });

  const mapped = rooms.map(mapOpsListRow);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const completedToday = rooms.filter(
    (r) => r.workflowStage === "COMPLETED" && r.slaFundingCompletedAt && r.slaFundingCompletedAt >= todayStart,
  ).length;

  const fundedRooms = rooms.filter((r) => r.slaFundingCompletedAt);
  const avgFundingHours =
    fundedRooms.length > 0
      ? fundedRooms.reduce((sum, r) => sum + (r.slaFundingCompletedAt!.getTime() - r.createdAt.getTime()), 0) /
        fundedRooms.length /
        (1000 * 60 * 60)
      : 0;

  const negotiating = rooms.filter((r) => r.workflowStage === "NEGOTIATING_TERMS");
  const avgNegotiationHours =
    negotiating.length > 0
      ? negotiating.reduce((sum, r) => sum + hoursInStage(r.stageEnteredAt), 0) / negotiating.length
      : 0;

  const activeRooms = rooms.filter(
    (r) => !["COMPLETED", "DECLINED", "CANCELLED", "EXPIRED"].includes(r.workflowStage),
  );
  const avgProcessingHours =
    activeRooms.length > 0
      ? activeRooms.reduce((sum, r) => sum + hoursInStage(r.createdAt), 0) / activeRooms.length
      : 0;

  const widgets = {
    needsReview: mapped.filter((r) => ["initial_review", "underwriting"].includes(r.workflowStage)).length,
    waitingOnBorrower: mapped.filter((r) => r.waitingOn === "borrower").length,
    waitingOnAlta: mapped.filter((r) => r.waitingOn === "alta").length,
    readyForFunding: mapped.filter((r) => r.workflowStage === "funding").length,
    completedToday,
    stalled: mapped.filter((r) => r.isStalled).length,
    unassigned: mapped.filter((r) => !r.assignedOfficerId && r.workflowStage !== "completed").length,
  };

  const reporting = {
    applications: rooms.length,
    approvals: rooms.filter((r) => r.workflowStage === "COMPLETED").length,
    declines: rooms.filter((r) => r.workflowStage === "DECLINED").length,
    averageLoanSize:
      rooms.length > 0
        ? rooms.reduce((s, r) => s + Number(r.currentProposedAmount ?? r.currentRequestedAmount), 0) / rooms.length
        : 0,
    averageFundingTimeHours: Math.round(avgFundingHours),
    largestLoan: Math.max(...rooms.map((r) => Number(r.currentProposedAmount ?? r.currentRequestedAmount)), 0),
    outstandingDealRooms: activeRooms.length,
  };

  const officerIds = [...new Set(rooms.map((r) => r.assignedOfficerId).filter(Boolean))] as string[];
  const officers = await prisma.user.findMany({
    where: { id: { in: officerIds } },
    select: { id: true, discordUsername: true },
  });
  const officerMap = new Map(officers.map((o) => [o.id, o.discordUsername]));

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);

  const officerWorkload: OfficerWorkloadRow[] = officerIds.map((id) => {
    const assigned = rooms.filter((r) => r.assignedOfficerId === id);
    return {
      officerId: id,
      officerName: officerMap.get(id) ?? "Unknown",
      openDealRooms: assigned.filter((r) => !["COMPLETED", "DECLINED", "CANCELLED"].includes(r.workflowStage)).length,
      pendingTasks: assigned.reduce((s, r) => s + r._count.tasks, 0),
      applicationsThisWeek: assigned.filter((r) => r.createdAt >= weekStart).length,
      loansFunded: assigned.filter((r) => r.workflowStage === "COMPLETED").length,
      currentWorkload: assigned.filter((r) => isWaitingOnAlta(r.workflowStage)).length,
    };
  });

  return {
    widgets,
    metrics: {
      averageProcessingTimeHours: Math.round(avgProcessingHours),
      averageFundingTimeHours: Math.round(avgFundingHours),
      averageNegotiationTimeHours: Math.round(avgNegotiationHours),
    },
    reporting,
    officerWorkload: officerWorkload.sort((a, b) => b.currentWorkload - a.currentWorkload),
    rooms: filters ? applyFilters(mapped, filters) : mapped,
  };
}

export async function getDealRoomOpsContext(actorUserId: string, dealRoomId: string): Promise<DealRoomOpsContext> {
  await requireOpsUser(actorUserId);

  const room = await prisma.dealRoom.findUnique({
    where: { id: dealRoomId },
    include: {
      ...opsRoomInclude,
      stageHistory: {
        orderBy: { enteredAt: "desc" },
        take: 20,
        include: { owner: { select: { discordUsername: true } } },
      },
      tasks: {
        include: {
          assignedTo: { select: { discordUsername: true } },
          createdBy: { select: { discordUsername: true } },
        },
        orderBy: [{ status: "asc" }, { dueDate: "asc" }],
      },
    },
  });
  if (!room) throw new Error("NOT_FOUND");

  const stage = WORKFLOW_STAGE_FROM_DB[room.workflowStage];

  return {
    dealRoomId,
    workflowStage: stage,
    workflowStageLabel: WORKFLOW_STAGE_LABELS[stage],
    workflowStageDescription: WORKFLOW_STAGE_DESCRIPTIONS[stage],
    stageEnteredAt: room.stageEnteredAt.toISOString(),
    hoursInStage: hoursInStage(room.stageEnteredAt),
    assignedTeam: room.assignedTeamLabel,
    createdByName: room.createdBy?.discordUsername ?? null,
    createdAt: room.createdAt.toISOString(),
    priority: PRIORITY_FROM_DB[room.priority] as DealRoomPriorityCode,
    isStalled: isStalled(room.stageEnteredAt, room.workflowStage) || Boolean(room.stalledAt),
    sla: computeSlaMetrics(room),
    tasks: room.tasks.map(mapTaskRow),
    stageHistory: room.stageHistory.map((h) => ({
      stage: WORKFLOW_STAGE_FROM_DB[h.stage],
      stageLabel: WORKFLOW_STAGE_LABELS[WORKFLOW_STAGE_FROM_DB[h.stage]],
      ownerName: h.owner?.discordUsername ?? null,
      enteredAt: h.enteredAt.toISOString(),
      exitedAt: h.exitedAt?.toISOString() ?? null,
      timeInStageHours: h.exitedAt ? hoursInStage(h.enteredAt, h.exitedAt) : hoursInStage(h.enteredAt),
    })),
  };
}

export async function listDealRoomOfficers(): Promise<{ id: string; name: string }[]> {
  const users = await prisma.user.findMany({
    where: { tags: { some: { tag: { in: ["ADMIN", "OPERATOR"] } } } },
    select: { id: true, discordUsername: true },
    orderBy: { discordUsername: "asc" },
  });
  return users.map((u) => ({ id: u.id, name: u.discordUsername }));
}

export async function unassignDealRoomOfficer(actorUserId: string, dealRoomId: string): Promise<void> {
  await requireOpsUser(actorUserId);
  const room = await prisma.dealRoom.findUnique({ where: { id: dealRoomId } });
  if (!room) throw new Error("NOT_FOUND");

  await prisma.dealRoom.update({ where: { id: dealRoomId }, data: { assignedOfficerId: null } });
  await prisma.$transaction(async (tx) => {
    await insertDealRoomSystemUpdateInTx(tx, dealRoomId, "Assigned banker unassigned.", { actorUserId });
  });

  await writeAuditLog({
    actorUserId,
    action: "DEAL_ROOM_OFFICER_UNASSIGNED",
    entityType: "DEAL_ROOM",
    entityId: dealRoomId,
    description: "Banker unassigned from legacy deal room.",
    metadata: { previousOfficerUserId: room.assignedOfficerId },
  });
}

export async function updateDealRoomWorkflow(actorUserId: string, input: UpdateDealRoomWorkflowInput): Promise<void> {
  await requireOpsUser(actorUserId);
  const room = await prisma.dealRoom.findUnique({
    where: { id: input.dealRoomId },
    include: { agreement: { include: { activeDraft: true } } },
  });
  if (!room) throw new Error("NOT_FOUND");

  await prisma.$transaction(async (tx) => {
    if (input.priority) {
      await tx.dealRoom.update({
        where: { id: input.dealRoomId },
        data: { priority: input.priority.toUpperCase() as DbPriority },
      });
    }
    if (input.assignedTeamLabel) {
      await tx.dealRoom.update({
        where: { id: input.dealRoomId },
        data: { assignedTeamLabel: input.assignedTeamLabel.trim() },
      });
    }
    if (input.workflowStage) {
      await syncDealRoomWorkflowStageInTx(
        tx,
        input.dealRoomId,
        {
          status: room.status,
          currentStage: room.workflowStage,
          stageEnteredAt: room.stageEnteredAt,
          assignedOfficerId: room.assignedOfficerId,
          activeDraftStatus: room.agreement?.activeDraft?.status ?? null,
        },
        { changedByUserId: actorUserId, forceStage: input.workflowStage.toUpperCase() as DbWorkflowStage },
      );
    }
  });

  if (input.workflowStage) {
    await writeAuditLog({
      actorUserId,
      action: "DEAL_ROOM_STAGE_CHANGED",
      entityType: "DEAL_ROOM",
      entityId: input.dealRoomId,
      description: `Workflow stage changed to ${input.workflowStage}.`,
      metadata: { workflowStage: input.workflowStage },
    });
  }
}

export async function createDealRoomTask(actorUserId: string, input: CreateDealRoomTaskInput): Promise<DealRoomTaskRow> {
  await requireOpsUser(actorUserId);

  const task = await prisma.dealRoomTask.create({
    data: {
      dealRoomId: input.dealRoomId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      assignedToUserId: input.assignedToUserId ?? null,
      priority: (input.priority?.toUpperCase() ?? "MEDIUM") as DbPriority,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      createdByUserId: actorUserId,
    },
    include: {
      assignedTo: { select: { discordUsername: true } },
      createdBy: { select: { discordUsername: true } },
    },
  });

  if (task.assignedToUserId) {
    await createUserNotification({
      userId: task.assignedToUserId,
      type: "DEAL_ROOM_TASK_ASSIGNED",
      title: "Deal room task assigned",
      body: task.title,
      linkUrl: `/internal/lending/deal-rooms/${input.dealRoomId}`,
      metadata: { dealRoomId: input.dealRoomId, taskId: task.id },
    });
  }

  await writeAuditLog({
    actorUserId,
    action: "DEAL_ROOM_TASK_CREATED",
    entityType: "DEAL_ROOM",
    entityId: input.dealRoomId,
    description: `Task created: ${task.title}`,
    metadata: { taskId: task.id },
  });

  return mapTaskRow(task);
}

export async function updateDealRoomTask(actorUserId: string, input: UpdateDealRoomTaskInput): Promise<DealRoomTaskRow> {
  await requireOpsUser(actorUserId);

  const now = new Date();
  const task = await prisma.dealRoomTask.update({
    where: { id: input.taskId },
    data: {
      title: input.title?.trim(),
      description: input.description?.trim(),
      assignedToUserId: input.assignedToUserId,
      priority: input.priority ? (input.priority.toUpperCase() as DbPriority) : undefined,
      dueDate: input.dueDate === null ? null : input.dueDate ? new Date(input.dueDate) : undefined,
      status: input.status ? (input.status.toUpperCase() as DbTaskStatus) : undefined,
      completedByUserId: input.status === "completed" ? actorUserId : undefined,
      completedAt: input.status === "completed" ? now : input.status ? null : undefined,
    },
    include: {
      assignedTo: { select: { discordUsername: true } },
      createdBy: { select: { discordUsername: true } },
    },
  });

  if (input.status === "completed") {
    await prisma.$transaction(async (tx) => {
      await insertDealRoomSystemUpdateInTx(tx, task.dealRoomId, `Task completed: ${task.title}`, { actorUserId });
    });
    await writeAuditLog({
      actorUserId,
      action: "DEAL_ROOM_TASK_COMPLETED",
      entityType: "DEAL_ROOM",
      entityId: task.dealRoomId,
      description: `Task completed: ${task.title}`,
      metadata: { taskId: task.id },
    });
  }

  return mapTaskRow(task);
}

export async function getDealRoomTimeline(actorUserId: string, dealRoomId: string): Promise<DealRoomTimelineEvent[]> {
  await requireOpsUser(actorUserId);

  const [messages, offers, docs, requests, stageHistory, tasks, room] = await Promise.all([
    prisma.dealRoomMessage.findMany({ where: { dealRoomId }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.dealRoomOffer.findMany({ where: { dealRoomId }, orderBy: { createdAt: "desc" } }),
    prisma.dealRoomDocument.findMany({ where: { dealRoomId }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.dealRoomDocumentRequest.findMany({ where: { dealRoomId }, orderBy: { requestedAt: "desc" } }),
    prisma.dealRoomStageHistory.findMany({ where: { dealRoomId }, orderBy: { enteredAt: "desc" } }),
    prisma.dealRoomTask.findMany({ where: { dealRoomId, status: "COMPLETED" }, orderBy: { completedAt: "desc" } }),
    prisma.dealRoom.findUnique({
      where: { id: dealRoomId },
      include: { agreement: { include: { drafts: { orderBy: { versionNumber: "desc" } } } } },
    }),
  ]);

  const events: DealRoomTimelineEvent[] = [];

  for (const m of messages) {
    events.push({
      id: `msg-${m.id}`,
      kind: m.messageType === "SYSTEM_UPDATE" ? "system" : "message",
      title: m.messageType.replaceAll("_", " ").toLowerCase(),
      body: m.body,
      timestamp: m.createdAt.toISOString(),
      timestampLabel: formatActivityDateTime(m.createdAt),
    });
  }
  for (const o of offers) {
    events.push({
      id: `offer-${o.id}`,
      kind: "offer",
      title: `${o.offerType.replaceAll("_", " ")} · ${o.status}`,
      body: null,
      timestamp: o.createdAt.toISOString(),
      timestampLabel: formatActivityDateTime(o.createdAt),
    });
  }
  for (const d of docs) {
    events.push({
      id: `doc-${d.id}`,
      kind: "document",
      title: `Document uploaded · ${d.documentType}`,
      body: d.originalFileName,
      timestamp: d.createdAt.toISOString(),
      timestampLabel: formatActivityDateTime(d.createdAt),
    });
  }
  for (const r of requests) {
    events.push({
      id: `req-${r.id}`,
      kind: "document_request",
      title: `Document requested · ${r.documentType}`,
      body: r.requestNote ?? r.title,
      timestamp: r.requestedAt.toISOString(),
      timestampLabel: formatActivityDateTime(r.requestedAt),
    });
  }
  for (const s of stageHistory) {
    const code = WORKFLOW_STAGE_FROM_DB[s.stage];
    events.push({
      id: `stage-${s.id}`,
      kind: "stage",
      title: `Stage · ${WORKFLOW_STAGE_LABELS[code]}`,
      body: null,
      timestamp: s.enteredAt.toISOString(),
      timestampLabel: formatActivityDateTime(s.enteredAt),
    });
  }
  for (const t of tasks) {
    if (!t.completedAt) continue;
    events.push({
      id: `task-${t.id}`,
      kind: "task",
      title: `Task completed · ${t.title}`,
      body: null,
      timestamp: t.completedAt.toISOString(),
      timestampLabel: formatActivityDateTime(t.completedAt),
    });
  }
  if (room?.agreement) {
    for (const draft of room.agreement.drafts) {
      events.push({
        id: `draft-${draft.id}`,
        kind: "agreement",
        title: `Agreement draft V${draft.versionNumber} · ${draft.status}`,
        body: null,
        timestamp: (draft.generatedAt ?? draft.createdAt).toISOString(),
        timestampLabel: formatActivityDateTime(draft.generatedAt ?? draft.createdAt),
      });
    }
  }

  return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export async function notifyDealRoomStakeholders(
  dealRoomId: string,
  type: Parameters<typeof createUserNotification>[0]["type"],
  title: string,
  body: string,
  linkUrl?: string,
): Promise<void> {
  const room = await prisma.dealRoom.findUnique({
    where: { id: dealRoomId },
    select: { borrowerUserId: true, assignedOfficerId: true },
  });
  if (!room) return;
  const recipients = [room.borrowerUserId, room.assignedOfficerId].filter(Boolean) as string[];
  await createUserNotifications(recipients, { type, title, body, linkUrl, metadata: { dealRoomId } });
}

export async function touchSlaMilestone(
  dealRoomId: string,
  field:
    | "slaOfficerFirstResponseAt"
    | "slaDocumentsRequestedAt"
    | "slaDocumentsReceivedAt"
    | "slaAgreementGeneratedAt"
    | "slaBorrowerSignedAt"
    | "slaBankSignedAt"
    | "slaFundingCompletedAt",
): Promise<void> {
  const room = await prisma.dealRoom.findUnique({ where: { id: dealRoomId }, select: { [field]: true } });
  if (!room || (room as Record<string, Date | null>)[field]) return;
  await prisma.dealRoom.update({ where: { id: dealRoomId }, data: { [field]: new Date() } });
}
