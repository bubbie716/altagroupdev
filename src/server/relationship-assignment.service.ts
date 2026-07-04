import type {
  DocumentSubjectType,
  PrivateBankingRelationshipStatus,
  Prisma,
  StaffAssignmentStatus,
  StaffAssignmentSubjectType,
  StaffAssignmentType,
} from "@prisma/client";
import { prisma } from "@/server/db";

export async function assignPrivateBanker(input: {
  customerUserId: string;
  bankerUserId: string;
  assignedByUserId?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}) {
  await prisma.privateBankingRelationship.updateMany({
    where: { customerUserId: input.customerUserId, status: "ACTIVE" },
    data: { status: "INACTIVE", updatedAt: new Date() },
  });

  return prisma.privateBankingRelationship.create({
    data: {
      customerUserId: input.customerUserId,
      bankerUserId: input.bankerUserId,
      assignedByUserId: input.assignedByUserId ?? null,
      notes: input.notes ?? null,
      status: "ACTIVE",
      metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}

export async function getActivePrivateBankingRelationship(customerUserId: string) {
  return prisma.privateBankingRelationship.findFirst({
    where: { customerUserId, status: "ACTIVE" },
    include: {
      banker: { select: { id: true, discordUsername: true } },
      customer: { select: { id: true, discordUsername: true } },
    },
    orderBy: { assignedAt: "desc" },
  });
}

export async function createStaffAssignment(input: {
  staffUserId: string;
  subjectType: StaffAssignmentSubjectType;
  subjectId: string;
  assignmentType: StaffAssignmentType;
  assignedByUserId?: string;
  status?: StaffAssignmentStatus;
  metadata?: Record<string, unknown>;
}) {
  return prisma.staffAssignment.create({
    data: {
      staffUserId: input.staffUserId,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      assignmentType: input.assignmentType,
      assignedByUserId: input.assignedByUserId ?? null,
      status: input.status ?? "ACTIVE",
      metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}

export async function listActiveStaffAssignments(input: {
  subjectType: StaffAssignmentSubjectType;
  subjectId: string;
  assignmentType?: StaffAssignmentType;
}) {
  return prisma.staffAssignment.findMany({
    where: {
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      status: "ACTIVE",
      ...(input.assignmentType ? { assignmentType: input.assignmentType } : {}),
    },
    include: { staffUser: { select: { id: true, discordUsername: true } } },
    orderBy: { assignedAt: "desc" },
  });
}

export async function createDocumentRecord(input: {
  subjectType: DocumentSubjectType;
  subjectId: string;
  documentKind: string;
  fileName: string;
  storageKey: string;
  mimeType?: string;
  sizeBytes?: number;
  uploadedByUserId?: string;
  metadata?: Record<string, unknown>;
}) {
  return prisma.document.create({
    data: {
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      documentKind: input.documentKind,
      fileName: input.fileName,
      storageKey: input.storageKey,
      mimeType: input.mimeType ?? null,
      sizeBytes: input.sizeBytes ?? null,
      uploadedByUserId: input.uploadedByUserId ?? null,
      metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}

export type PrivateBankingRelationshipStatusFilter = PrivateBankingRelationshipStatus;
