import { createServerFn } from "@tanstack/react-start";
import type {
  AltaCardAutopayAuditRow,
  AltaCardAutopayContext,
  AltaCardAutopaySettings,
  UpdateAltaCardAutopayInput,
} from "@/lib/bank/alta-card-autopay-types";
import type { RunAutopayForCardResult } from "@/server/alta-card-autopay.service";

async function actorId(): Promise<string> {
  const { requireAuth } = await import("@/server/auth.service");
  const user = await requireAuth();
  return user.id;
}

function parseServiceError(error: unknown): never {
  if (error instanceof Error && error.message.startsWith("BAD_REQUEST:")) {
    throw new Error(error.message.slice("BAD_REQUEST:".length));
  }
  if (error instanceof Error && error.message === "FORBIDDEN") {
    throw new Error("FORBIDDEN");
  }
  throw error;
}

export const fetchAltaCardAutopayContext = createServerFn({ method: "GET" })
  .inputValidator((cardId: string) => cardId)
  .handler(async ({ data: cardId }): Promise<AltaCardAutopayContext> => {
    const { getAutopayContext } = await import("@/server/alta-card-autopay.service");
    const userId = await actorId();
    try {
      return await getAutopayContext(cardId, userId);
    } catch (error) {
      parseServiceError(error);
    }
  });

export const updateAltaCardAutopaySettings = createServerFn({ method: "POST" })
  .inputValidator((input: UpdateAltaCardAutopayInput & { cardId: string }) => input)
  .handler(async ({ data }): Promise<AltaCardAutopaySettings> => {
    const { updateAutopaySettings } = await import("@/server/alta-card-autopay.service");
    const userId = await actorId();
    const { cardId, ...input } = data;
    try {
      return await updateAutopaySettings(cardId, input, userId);
    } catch (error) {
      parseServiceError(error);
    }
  });

export const fetchInternalAltaCardAutopayContext = createServerFn({ method: "GET" })
  .inputValidator((cardId: string) => cardId)
  .handler(
    async ({
      data: cardId,
    }): Promise<{ context: AltaCardAutopayContext; audit: AltaCardAutopayAuditRow[] }> => {
      const { requireOperator } = await import("@/server/permissions.service");
      const { getAutopayContext, listAutopayAuditHistory } = await import(
        "@/server/alta-card-autopay.service"
      );
      const user = await requireOperator();
      const [context, auditRows] = await Promise.all([
        getAutopayContext(cardId, user.id),
        listAutopayAuditHistory(cardId),
      ]);
      return {
        context: { ...context, settings: { ...context.settings, canManage: true } },
        audit: auditRows.map((row) => ({
          id: row.id,
          action: row.action,
          description: row.description,
          actorUsername: row.actor.discordUsername,
          createdAt: row.createdAt.toISOString(),
          metadata:
            row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
              ? (row.metadata as Record<string, unknown>)
              : null,
        })),
      };
    },
  );

export const runAltaCardAutopayManualRecord = createServerFn({ method: "POST" })
  .inputValidator((input: { cardId: string; reason: string }) => input)
  .handler(async ({ data }): Promise<RunAutopayForCardResult> => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { runAutopayForCard } = await import("@/server/alta-card-autopay.service");
    const user = await requireOperator();
    if (!data.reason.trim()) throw new Error("Reason is required");
    return runAutopayForCard(data.cardId, user.id, {
      force: true,
      manualReason: data.reason.trim(),
    });
  });

export type {
  AltaCardAutopayContext,
  AltaCardAutopaySettings,
  AltaCardAutopayAuditRow,
  UpdateAltaCardAutopayInput,
  RunAutopayForCardResult,
};
