import { createServerFn } from "@tanstack/react-start";
import type { InternalNoteTargetType } from "@prisma/client";

async function actorId(): Promise<string> {
  const { requireOperator } = await import("@/server/permissions.service");
  const user = await requireOperator();
  return user.id;
}

export const fetchInternalNotes = createServerFn({ method: "GET" })
  .inputValidator((input: { targetType: InternalNoteTargetType; targetId: string }) => input)
  .handler(async ({ data }) => {
    const { listInternalNotes } = await import("@/server/internal-note.service");
    return listInternalNotes(data.targetType, data.targetId);
  });

export const createInternalNoteRecord = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { targetType: InternalNoteTargetType; targetId: string; note: string }) => input,
  )
  .handler(async ({ data }) => {
    const { createInternalNote } = await import("@/server/internal-note.service");
    const userId = await actorId();
    return createInternalNote(userId, data.targetType, data.targetId, data.note);
  });
