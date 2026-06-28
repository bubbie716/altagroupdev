import type { GlobalSearchResult } from "@/lib/internal/ops-types";
import { formatOpsJobRunHealthDetail } from "@/lib/internal/ops-job-run-display";
import { prisma } from "@/server/db";
import { requireOperator } from "@/server/permissions.service";

function decimalToNumber(value: { toString(): string }): number {
  return Number(value.toString());
}

function florin(amount: number): string {
  return `ƒ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function isoDate(value: Date | string): string {
  const d = typeof value === "string" ? value : value.toISOString();
  return d.slice(0, 10);
}

function pushResult(
  results: GlobalSearchResult[],
  row: GlobalSearchResult,
  limit: number,
): void {
  if (results.length < limit) results.push(row);
}

export async function globalOpsSearch(query: string, limit = 30): Promise<GlobalSearchResult[]> {
  await requireOperator();
  const q = query.trim();
  if (!q) return [];

  const results: GlobalSearchResult[] = [];
  const perType = Math.max(2, Math.ceil(limit / 12));
  const idMatch = q.length >= 8 ? { contains: q } : undefined;

  const [
    users,
    companies,
    accounts,
    transactions,
    deposits,
    withdrawals,
    loans,
    statements,
    lendingApps,
    dealRooms,
    altaCards,
    altaCardApps,
    altaCardReviews,
    altaCardStatements,
    relationshipProfiles,
    companyProfiles,
    auditLogs,
    jobRuns,
  ] = await Promise.all([
    prisma.user.findMany({
      where: {
        OR: [
          { discordUsername: { contains: q, mode: "insensitive" } },
          { minecraftUsername: { contains: q, mode: "insensitive" } },
          { discordId: { contains: q } },
          { email: { contains: q, mode: "insensitive" } },
          ...(idMatch ? [{ id: idMatch }] : []),
        ],
      },
      include: { relationshipProfile: true },
      take: perType,
      orderBy: { lastLoginAt: "desc" },
    }),
    prisma.company.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { ticker: { contains: q, mode: "insensitive" } },
          ...(idMatch ? [{ id: idMatch }] : []),
        ],
      },
      include: { relationshipProfile: true },
      take: perType,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.bankAccount.findMany({
      where: {
        OR: [
          { accountNumber: { contains: q, mode: "insensitive" } },
          { accountName: { contains: q, mode: "insensitive" } },
          ...(idMatch ? [{ id: idMatch }] : []),
        ],
      },
      include: { user: true, company: true },
      take: perType,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.bankTransaction.findMany({
      where: {
        OR: [
          { referenceCode: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
          ...(idMatch ? [{ id: idMatch }] : []),
        ],
      },
      include: { bankAccount: { include: { user: true, company: true } } },
      take: perType,
      orderBy: { createdAt: "desc" },
    }),
    prisma.bankTransaction.findMany({
      where: {
        type: "DEPOSIT",
        OR: [
          { referenceCode: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      },
      include: { bankAccount: { include: { user: true, company: true } } },
      take: perType,
      orderBy: { createdAt: "desc" },
    }),
    prisma.bankTransaction.findMany({
      where: {
        type: "WITHDRAWAL",
        OR: [
          { referenceCode: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      },
      include: { bankAccount: { include: { user: true, company: true } } },
      take: perType,
      orderBy: { createdAt: "desc" },
    }),
    prisma.loan.findMany({
      where: idMatch ? { id: idMatch } : { id: { contains: q } },
      include: { borrowerUser: true, company: true },
      take: perType,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.bankStatement.findMany({
      where: {
        OR: [
          { statementNumber: { contains: q, mode: "insensitive" } },
          ...(idMatch ? [{ id: idMatch }] : []),
        ],
      },
      include: { bankAccount: { include: { user: true, company: true } } },
      take: perType,
      orderBy: { createdAt: "desc" },
    }),
    prisma.loanApplication.findMany({
      where: {
        OR: [
          { purpose: { contains: q, mode: "insensitive" } },
          ...(idMatch ? [{ id: idMatch }] : []),
        ],
      },
      include: { applicantUser: true, company: true },
      take: perType,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.dealRoom.findMany({
      where: idMatch ? { id: idMatch } : { id: { contains: q } },
      include: { borrowerUser: true, company: true, loanApplication: true },
      take: perType,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.altaCard.findMany({
      where: {
        OR: [
          { cardLastFour: { contains: q } },
          ...(idMatch ? [{ id: idMatch }] : []),
          { owner: { discordUsername: { contains: q, mode: "insensitive" } } },
          { company: { name: { contains: q, mode: "insensitive" } } },
        ],
      },
      include: { owner: true, company: true },
      take: perType,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.altaCardApplication.findMany({
      where: {
        OR: [
          ...(idMatch ? [{ id: idMatch }] : []),
          { applicant: { discordUsername: { contains: q, mode: "insensitive" } } },
          { company: { name: { contains: q, mode: "insensitive" } } },
        ],
      },
      include: { applicant: true, company: true },
      take: perType,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.altaCardReviewRequest.findMany({
      where: {
        OR: [
          ...(idMatch ? [{ id: idMatch }] : []),
          { applicantUser: { discordUsername: { contains: q, mode: "insensitive" } } },
        ],
      },
      include: { applicantUser: true, altaCard: true, company: true },
      take: perType,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.altaCardStatement.findMany({
      where: {
        OR: [
          ...(Number.isFinite(Number(q)) ? [{ statementNumber: Number(q) }] : []),
          ...(idMatch ? [{ id: idMatch }] : []),
          { altaCard: { cardLastFour: { contains: q } } },
        ],
      },
      include: { altaCard: { include: { owner: true, company: true } } },
      take: perType,
      orderBy: { createdAt: "desc" },
    }),
    prisma.relationshipProfile.findMany({
      where: {
        OR: [
          ...(idMatch ? [{ id: idMatch }, { userId: idMatch }] : []),
          { user: { discordUsername: { contains: q, mode: "insensitive" } } },
          { user: { discordId: { contains: q } } },
        ],
      },
      include: { user: true },
      take: perType,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.companyRelationshipProfile.findMany({
      where: {
        OR: [
          ...(idMatch ? [{ id: idMatch }, { companyId: idMatch }] : []),
          { company: { name: { contains: q, mode: "insensitive" } } },
          { company: { ticker: { contains: q, mode: "insensitive" } } },
        ],
      },
      include: { company: true },
      take: perType,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.auditLog.findMany({
      where: {
        OR: [
          { description: { contains: q, mode: "insensitive" } },
          { action: { contains: q, mode: "insensitive" } },
          ...(idMatch ? [{ id: idMatch }, { entityId: idMatch }] : []),
        ],
      },
      include: { actor: true },
      take: perType,
      orderBy: { createdAt: "desc" },
    }),
    prisma.opsJobRun.findMany({
      where: {
        OR: [
          { label: { contains: q, mode: "insensitive" } },
          { jobKey: { contains: q, mode: "insensitive" } },
        ],
      },
      take: perType,
      orderBy: { label: "asc" },
    }),
  ]);

  for (const u of users) {
    pushResult(results, {
      id: u.id,
      type: "user",
      label: u.discordUsername,
      sublabel: [u.discordId, u.relationshipProfile?.relationshipTier, "Customer"].filter(Boolean).join(" · "),
      href: `/internal/users/${u.id}`,
      status: u.accountStatus,
      date: u.lastLoginAt ? isoDate(u.lastLoginAt) : undefined,
    }, limit);
  }

  for (const c of companies) {
    pushResult(results, {
      id: c.id,
      type: "company",
      label: c.name,
      sublabel: [c.ticker, c.relationshipProfile?.relationshipTier, c.verificationStatus].filter(Boolean).join(" · "),
      href: `/internal/companies/${c.id}`,
      status: c.verificationStatus,
      date: isoDate(c.updatedAt),
    }, limit);
  }

  for (const a of accounts) {
    pushResult(results, {
      id: a.id,
      type: "account",
      label: `${a.accountName} •••• ${a.accountNumber.slice(-4)}`,
      sublabel: `${florin(decimalToNumber(a.balance))} · ${a.status} · ${a.company?.name ?? a.user.discordUsername}`,
      href: `/internal/bank/accounts/${a.id}`,
      status: a.status,
      amount: florin(decimalToNumber(a.balance)),
      date: isoDate(a.updatedAt),
    }, limit);
  }

  const seenTx = new Set<string>();
  for (const tx of transactions) {
    if (seenTx.has(tx.id)) continue;
    seenTx.add(tx.id);
    const isPay = tx.referenceCode.startsWith("PAY-");
    const owner = tx.bankAccount.company?.name ?? tx.bankAccount.user.discordUsername;
    pushResult(results, {
      id: tx.id,
      type: isPay ? "alta_pay" : "transaction",
      label: tx.description || tx.referenceCode,
      sublabel: `${florin(decimalToNumber(tx.amount))} · ${owner} · ${tx.referenceCode}`,
      href: isPay
        ? `/internal/bank/alta-pay?ref=${encodeURIComponent(tx.referenceCode.replace(/-OUT$|-IN$/, ""))}`
        : `/internal/bank/transactions/${tx.id}`,
      status: tx.status,
      amount: florin(decimalToNumber(tx.amount)),
      date: isoDate(tx.createdAt),
    }, limit);
  }

  for (const tx of deposits) {
    if (seenTx.has(tx.id)) continue;
    seenTx.add(tx.id);
    pushResult(results, {
      id: tx.id,
      type: "deposit",
      label: tx.description || `Deposit ${tx.referenceCode}`,
      sublabel: `${florin(decimalToNumber(tx.amount))} · ${tx.bankAccount.accountNumber}`,
      href: `/internal/bank/transactions/${tx.id}`,
      status: tx.status,
      amount: florin(decimalToNumber(tx.amount)),
      date: isoDate(tx.createdAt),
    }, limit);
  }

  for (const tx of withdrawals) {
    if (seenTx.has(tx.id)) continue;
    seenTx.add(tx.id);
    pushResult(results, {
      id: tx.id,
      type: "withdrawal",
      label: tx.description || `Withdrawal ${tx.referenceCode}`,
      sublabel: `${florin(decimalToNumber(tx.amount))} · ${tx.bankAccount.accountNumber}`,
      href: `/internal/bank/transactions/${tx.id}`,
      status: tx.status,
      amount: florin(decimalToNumber(tx.amount)),
      date: isoDate(tx.createdAt),
    }, limit);
  }

  for (const l of loans) {
    pushResult(results, {
      id: l.id,
      type: "loan",
      label: l.company?.name ?? l.borrowerUser?.discordUsername ?? l.id.slice(0, 12),
      sublabel: `${florin(decimalToNumber(l.principalAmount))} · ${l.status}`,
      href: `/internal/lending/loans/${l.id}`,
      status: l.status,
      amount: florin(decimalToNumber(l.principalAmount)),
      date: isoDate(l.updatedAt),
    }, limit);
  }

  for (const s of statements) {
    const owner = s.bankAccount.company?.name ?? s.bankAccount.user.discordUsername;
    pushResult(results, {
      id: s.id,
      type: "statement",
      label: s.statementNumber,
      sublabel: `${s.bankAccount.accountNumber} · ${owner}`,
      href: `/internal/bank/accounts/${s.bankAccountId}?tab=statements`,
      status: s.status,
      date: isoDate(s.createdAt),
    }, limit);
  }

  for (const app of lendingApps) {
    pushResult(results, {
      id: app.id,
      type: "lending_application",
      label: app.applicantUser.discordUsername,
      sublabel: `${florin(decimalToNumber(app.requestedAmount))} · ${app.productType} · ${app.status}`,
      href: `/internal/lending/applications/${app.id}`,
      status: app.status,
      amount: florin(decimalToNumber(app.requestedAmount)),
      date: isoDate(app.createdAt),
    }, limit);
  }

  for (const dr of dealRooms) {
    const href = dr.loanApplicationId
      ? `/internal/lending/applications/${dr.loanApplicationId}/thread`
      : `/internal/users/${dr.borrowerUserId}`;
    pushResult(results, {
      id: dr.id,
      type: "deal_room",
      label: dr.company?.name ?? dr.borrowerUser.discordUsername,
      sublabel: `${dr.workflowStage} · ${dr.status}`,
      href,
      status: dr.status,
      amount: florin(decimalToNumber(dr.currentRequestedAmount)),
      date: isoDate(dr.updatedAt),
    }, limit);
  }

  for (const card of altaCards) {
    const owner = card.company?.name ?? card.owner?.discordUsername ?? "—";
    pushResult(results, {
      id: card.id,
      type: "alta_card",
      label: `${card.tier.replace(/_/g, " ")} •••• ${card.cardLastFour}`,
      sublabel: `${florin(decimalToNumber(card.currentBalance))} balance · ${card.status} · ${owner}`,
      href: `/internal/alta-card/${card.id}`,
      status: card.status,
      amount: florin(decimalToNumber(card.currentBalance)),
      date: isoDate(card.updatedAt),
    }, limit);
  }

  for (const app of altaCardApps) {
    pushResult(results, {
      id: app.id,
      type: "alta_card_application",
      label: app.applicant.discordUsername,
      sublabel: `${app.requestedTier} · ${app.cardType} · ${app.status}`,
      href: `/internal/alta-card/applications/${app.id}`,
      status: app.status,
      date: isoDate(app.createdAt),
    }, limit);
  }

  for (const review of altaCardReviews) {
    pushResult(results, {
      id: review.id,
      type: "alta_card_review",
      label: review.applicantUser.discordUsername,
      sublabel: `•••• ${review.altaCard.cardLastFour} · ${review.status}`,
      href: `/internal/alta-card/reviews/${review.id}`,
      status: review.status,
      date: isoDate(review.createdAt),
    }, limit);
  }

  for (const stmt of altaCardStatements) {
    const owner = stmt.altaCard.company?.name ?? stmt.altaCard.owner?.discordUsername ?? "—";
    pushResult(results, {
      id: stmt.id,
      type: "alta_card_statement",
      label: `Statement #${stmt.statementNumber}`,
      sublabel: `•••• ${stmt.altaCard.cardLastFour} · ${owner}`,
      href: `/internal/alta-card/${stmt.altaCardId}?tab=statements`,
      status: stmt.status,
      date: isoDate(stmt.createdAt),
    }, limit);
  }

  for (const rp of relationshipProfiles) {
    pushResult(results, {
      id: rp.userId,
      type: "relationship_profile",
      label: rp.user.discordUsername,
      sublabel: `${rp.relationshipTier} · score ${rp.relationshipScore}`,
      href: `/internal/users/${rp.userId}?tab=relationship`,
      status: rp.relationshipTier,
      date: isoDate(rp.lastCalculatedAt),
    }, limit);
  }

  for (const cp of companyProfiles) {
    pushResult(results, {
      id: cp.companyId,
      type: "company_relationship",
      label: cp.company.name,
      sublabel: `${cp.relationshipTier} · score ${cp.relationshipScore}`,
      href: `/internal/companies/${cp.companyId}?tab=relationship`,
      status: cp.relationshipTier,
      date: isoDate(cp.lastCalculatedAt),
    }, limit);
  }

  for (const log of auditLogs) {
    pushResult(results, {
      id: log.id,
      type: "audit",
      label: log.action,
      sublabel: log.description.slice(0, 80),
      href: `/internal/audit?entityType=${log.entityType}${log.entityId ? `&entityId=${log.entityId}` : ""}`,
      status: log.entityType,
      date: isoDate(log.createdAt),
    }, limit);
  }

  for (const job of jobRuns) {
    const lastRun = job.lastSuccessAt ?? job.lastFailureAt;
    pushResult(results, {
      id: job.jobKey,
      type: "job_run",
      label: job.label,
      sublabel: formatOpsJobRunHealthDetail(job.jobKey, job.lastMessage, job.label),
      href: "/internal/jobs",
      status: job.lastStatus ?? "UNKNOWN",
      date: lastRun ? isoDate(lastRun) : undefined,
    }, limit);
  }

  return results.slice(0, limit);
}
