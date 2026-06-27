import { createServerFn } from "@tanstack/react-start";
import type { GenerateAltaCardStatementInput } from "@/lib/bank/alta-card-types";

export const fetchCardStatements = createServerFn({ method: "GET" })
  .inputValidator((cardId: string) => cardId)
  .handler(async ({ data: cardId }) => {
    const { requireAuth } = await import("@/server/auth.service");
    const { listCardStatements } = await import("@/server/alta-card-statement.service");
    const user = await requireAuth();
    return listCardStatements(user.id, cardId);
  });

export const fetchCardStatementDetail = createServerFn({ method: "GET" })
  .inputValidator((input: { cardId: string; statementId: string }) => input)
  .handler(async ({ data }) => {
    const { requireAuth } = await import("@/server/auth.service");
    const { getCardStatementDetail } = await import("@/server/alta-card-statement.service");
    const user = await requireAuth();
    return getCardStatementDetail(user.id, data.cardId, data.statementId);
  });

export const generateAltaCardStatementForPeriod = createServerFn({ method: "POST" })
  .inputValidator((input: GenerateAltaCardStatementInput) => input)
  .handler(async ({ data }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { generateCardStatementForPeriod } = await import("@/server/alta-card-statement.service");
    const admin = await requireOperator();
    return generateCardStatementForPeriod(
      admin.id,
      data.cardId,
      data.periodStart,
      data.periodEnd,
    );
  });

export const generateAltaCardStatementRecord = createServerFn({ method: "POST" })
  .inputValidator((cardId: string) => cardId)
  .handler(async ({ data: cardId }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { generateStatement } = await import("@/server/alta-card-statement.service");
    const admin = await requireOperator();
    return generateStatement(admin.id, cardId);
  });

export const regenerateOpenAltaCardStatementRecord = createServerFn({ method: "POST" })
  .inputValidator((cardId: string) => cardId)
  .handler(async ({ data: cardId }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { regenerateOpenStatement } = await import("@/server/alta-card-statement.service");
    const admin = await requireOperator();
    return regenerateOpenStatement(admin.id, cardId);
  });

export const voidAltaCardStatementRecord = createServerFn({ method: "POST" })
  .inputValidator((statementId: string) => statementId)
  .handler(async ({ data: statementId }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { voidStatement } = await import("@/server/alta-card-statement.service");
    const admin = await requireOperator();
    return voidStatement(admin.id, statementId);
  });

export const downloadAltaCardStatementPdfRecord = createServerFn({ method: "GET" })
  .inputValidator((statementId: string) => statementId)
  .handler(async ({ data: statementId }) => {
    const { requireAuth } = await import("@/server/auth.service");
    await requireAuth();
    const { generateStatementPdf } = await import("@/server/alta-card-statement-pdf");
    return generateStatementPdf(statementId);
  });

export const runAltaCardStatementGenerationRecord = createServerFn({ method: "POST" }).handler(
  async () => {
    const { requireOperator } = await import("@/server/permissions.service");
    await requireOperator();
    const { generateStatementsForEligibleCards } = await import(
      "@/server/alta-card-statement.service"
    );
    return generateStatementsForEligibleCards();
  },
);
