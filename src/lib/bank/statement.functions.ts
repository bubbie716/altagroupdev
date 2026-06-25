import { createServerFn } from "@tanstack/react-start";
import type { GenerateStatementInput } from "@/lib/bank/statement-types";

async function actorId(): Promise<string> {
  const { requireAuth } = await import("@/server/auth.service");
  return (await requireAuth()).id;
}

export const fetchPersonalStatements = createServerFn({ method: "GET" }).handler(async () => {
  const { listPersonalStatements } = await import("@/server/statement.service");
  return listPersonalStatements(await actorId());
});

export const fetchStatementCenterStatements = createServerFn({ method: "GET" }).handler(async () => {
  const { listStatementCenterStatements } = await import("@/server/statement.service");
  return listStatementCenterStatements(await actorId());
});

export const fetchAccountStatements = createServerFn({ method: "GET" })
  .inputValidator((accountId: string) => accountId)
  .handler(async ({ data: accountId }) => {
    const { listAccountStatements } = await import("@/server/statement.service");
    return listAccountStatements(await actorId(), accountId);
  });

export const fetchBusinessStatements = createServerFn({ method: "GET" })
  .inputValidator((companyId: string) => companyId)
  .handler(async ({ data: companyId }) => {
    const { listBusinessStatements } = await import("@/server/statement.service");
    const { requireAuth } = await import("@/server/auth.service");
    const user = await requireAuth();
    return listBusinessStatements(user, companyId);
  });

export const fetchStatementDetail = createServerFn({ method: "GET" })
  .inputValidator((statementId: string) => statementId)
  .handler(async ({ data: statementId }) => {
    const { getStatementDetail } = await import("@/server/statement.service");
    return getStatementDetail(await actorId(), statementId);
  });

export const generateAccountStatement = createServerFn({ method: "POST" })
  .inputValidator((input: GenerateStatementInput) => input)
  .handler(async ({ data }) => {
    const { generateStatementForUser } = await import("@/server/statement.service");
    return generateStatementForUser(await actorId(), data);
  });

export const fetchInternalStatementOps = createServerFn({ method: "GET" }).handler(async () => {
  const { requireOperator } = await import("@/server/permissions.service");
  await requireOperator();
  const { getInternalStatementOps } = await import("@/server/statement.service");
  return getInternalStatementOps();
});

export const generateMonthlyStatementsBatch = createServerFn({ method: "POST" }).handler(async () => {
  const { requireOperator } = await import("@/server/permissions.service");
  await requireOperator();
  const { generateMonthlyStatementsPreview } = await import("@/server/statement.service");
  return generateMonthlyStatementsPreview();
});

export const fetchPreviousStatementPeriod = createServerFn({ method: "GET" }).handler(async () => {
  const { previousCalendarMonthRange } = await import("@/server/statement.service");
  return previousCalendarMonthRange();
});

export const fetchStatementGeneratableAccounts = createServerFn({ method: "GET" }).handler(async () => {
  const { listStatementGeneratableAccountsForUser } = await import("@/server/statement.service");
  return listStatementGeneratableAccountsForUser(await actorId());
});

export const generateAccountStatementsBatch = createServerFn({ method: "POST" })
  .inputValidator((input: import("@/lib/bank/statement-types").GenerateStatementsBatchInput) => input)
  .handler(async ({ data }) => {
    const { generateStatementsForUserBatch } = await import("@/server/statement.service");
    return generateStatementsForUserBatch(await actorId(), data);
  });
