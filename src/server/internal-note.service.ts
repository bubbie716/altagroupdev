import type { InternalNoteTargetType } from "@prisma/client";
import { prisma } from "@/server/db";
import { requireOperator } from "@/server/permissions.service";

export type InternalNoteRow = {
  id: string;
  authorUserId: string;
  authorUsername: string;
  targetType: InternalNoteTargetType;
  targetId: string;
  note: string;
  createdAt: string;
};

export async function listInternalNotes(
  targetType: InternalNoteTargetType,
  targetId: string,
): Promise<InternalNoteRow[]> {
  await requireOperator();
  const rows = await prisma.internalNote.findMany({
    where: { targetType, targetId },
    include: { author: { select: { discordUsername: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return rows.map((row) => ({
    id: row.id,
    authorUserId: row.authorUserId,
    authorUsername: row.author.discordUsername,
    targetType: row.targetType,
    targetId: row.targetId,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function createInternalNote(
  authorUserId: string,
  targetType: InternalNoteTargetType,
  targetId: string,
  note: string,
): Promise<InternalNoteRow> {
  const trimmed = note.trim();
  if (!trimmed) throw new Error("BAD_REQUEST:Note is required.");

  const row = await prisma.internalNote.create({
    data: {
      authorUserId,
      targetType,
      targetId,
      note: trimmed,
    },
    include: { author: { select: { discordUsername: true } } },
  });

  return {
    id: row.id,
    authorUserId: row.authorUserId,
    authorUsername: row.author.discordUsername,
    targetType: row.targetType,
    targetId: row.targetId,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
  };
}
