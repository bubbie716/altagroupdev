import type { TimelineEvent } from "@/lib/internal/ops-types";
import { florin } from "@/lib/bank/api";
import { prisma } from "@/server/db";
import { requireOperator } from "@/server/permissions.service";
import { isMissingOpsV1TableError } from "@/server/ops-prisma-guard";

function decimalToNumber(value: { toString(): string } | null | undefined): number {
  return value ? Number(value.toString()) : 0;
}

function pushUnique(events: TimelineEvent[], event: TimelineEvent, seen: Set<string>) {
  const key = `${event.kind}:${event.id}`;
  if (seen.has(key)) return;
  seen.add(key);
  events.push(event);
}

export async function buildUniversalCustomerTimeline(userId: string, limit = 60): Promise<TimelineEvent[]> {
  await requireOperator();
  const events: TimelineEvent[] = [];
  const seen = new Set<string>();

  const [
    riEvents,
    bankTxs,
    loanApps,
    loans,
    altaCardApps,
    altaCardReviews,
    statements,
    companies,
  ] = await Promise.all([
    prisma.relationshipTimelineEvent.findMany({
      where: { userId },
      orderBy: { occurredAt: "desc" },
      take: limit,
    }),
    prisma.bankTransaction.findMany({
      where: { bankAccount: { userId }, status: "APPROVED" },
      orderBy: { createdAt: "desc" },
      take: 40,
      include: { bankAccount: true },
    }),
    prisma.loanApplication.findMany({
      where: { applicantUserId: userId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.loan.findMany({
      where: { borrowerUserId: userId },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
    prisma.altaCardApplication.findMany({
      where: { applicantUserId: userId },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
    prisma.altaCardReviewRequest.findMany({
      where: { applicantUserId: userId },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
    prisma.bankStatement.findMany({
      where: { bankAccount: { userId } },
      orderBy: { createdAt: "desc" },
      take: 12,
      include: { bankAccount: true },
    }),
    prisma.companyMembership.findMany({
      where: { userId, company: { verificationStatus: "VERIFIED" } },
      include: { company: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const accountIds = (
    await prisma.bankAccount.findMany({ where: { userId }, select: { id: true } })
  ).map((a) => a.id);
  const loanIds = loans.map((l) => l.id);
  const cardIds = (
    await prisma.altaCard.findMany({ where: { ownerUserId: userId }, select: { id: true } })
  ).map((c) => c.id);

  const allFlags = await loadTimelineFlags([
    { targetType: "USER", targetId: userId },
    ...(accountIds.length ? [{ targetType: "BANK_ACCOUNT" as const, targetId: { in: accountIds } }] : []),
    ...(loanIds.length ? [{ targetType: "LOAN" as const, targetId: { in: loanIds } }] : []),
    ...(cardIds.length ? [{ targetType: "ALTA_CARD" as const, targetId: { in: cardIds } }] : []),
  ]);

  for (const e of riEvents) {
    pushUnique(
      events,
      {
        id: e.id,
        kind: e.eventType,
        title: e.title,
        detail: e.description ?? "",
        actorLabel: null,
        createdAt: e.occurredAt.toISOString(),
        href: e.relatedEntityId ? timelineHref(e.relatedEntityType, e.relatedEntityId) : null,
        accountLabel: null,
        accountId: null,
      },
      seen,
    );
  }

  for (const tx of bankTxs) {
    const label = txTypeLabel(tx.type);
    pushUnique(
      events,
      {
        id: tx.id,
        kind: tx.type,
        title: `${label} · ${tx.referenceCode}`,
        detail: `${florin(decimalToNumber(tx.amount))} · ${tx.description}`,
        actorLabel: null,
        createdAt: (tx.reviewedAt ?? tx.createdAt).toISOString(),
        href: `/internal/bank/transactions/${tx.id}`,
        accountLabel: `${tx.bankAccount.accountName} · ${tx.bankAccount.accountNumber}`,
        accountId: tx.bankAccountId,
      },
      seen,
    );
  }

  for (const app of loanApps) {
    pushUnique(
      events,
      {
        id: app.id,
        kind: "LOAN_APPLICATION",
        title: `Loan application · ${app.status.replace(/_/g, " ")}`,
        detail: app.productType.replace(/_/g, " "),
        actorLabel: null,
        createdAt: app.createdAt.toISOString(),
        href: `/internal/lending/applications/${app.id}`,
        accountLabel: null,
        accountId: null,
      },
      seen,
    );
  }

  for (const loan of loans) {
    if (loan.approvedAt) {
      pushUnique(
        events,
        {
          id: `loan-approved-${loan.id}`,
          kind: "LOAN_APPROVED",
          title: "Loan approved",
          detail: florin(decimalToNumber(loan.principalAmount)),
          actorLabel: null,
          createdAt: loan.approvedAt.toISOString(),
          href: `/internal/lending/loans/${loan.id}`,
          accountLabel: null,
          accountId: null,
        },
        seen,
      );
    }
  }

  for (const app of altaCardApps) {
    pushUnique(
      events,
      {
        id: app.id,
        kind: "ALTA_CARD_APPLICATION",
        title: `Alta Card application · ${app.status.replace(/_/g, " ")}`,
        detail: app.cardType,
        actorLabel: null,
        createdAt: app.createdAt.toISOString(),
        href: `/internal/alta-card/applications/${app.id}`,
        accountLabel: null,
        accountId: null,
      },
      seen,
    );
    if (app.status === "APPROVED" && app.reviewedAt) {
      pushUnique(
        events,
        {
          id: `ac-approved-${app.id}`,
          kind: "ALTA_CARD_APPROVED",
          title: "Alta Card approved",
          detail: app.approvedTier ?? app.requestedTier,
          actorLabel: null,
          createdAt: app.reviewedAt.toISOString(),
          href: `/internal/alta-card/applications/${app.id}`,
          accountLabel: null,
          accountId: null,
        },
        seen,
      );
    }
  }

  for (const review of altaCardReviews) {
    pushUnique(
      events,
      {
        id: review.id,
        kind: "ALTA_CARD_REVIEW",
        title: `Alta Card review · ${review.status.replace(/_/g, " ")}`,
        detail: review.requestLimitIncrease ? "Limit increase" : "Review request",
        actorLabel: null,
        createdAt: review.createdAt.toISOString(),
        href: `/internal/alta-card/reviews/${review.id}`,
        accountLabel: null,
        accountId: null,
      },
      seen,
    );
  }

  for (const st of statements) {
    pushUnique(
      events,
      {
        id: st.id,
        kind: "STATEMENT_GENERATED",
        title: "Statement generated",
        detail: `${st.bankAccount.accountNumber} · ${st.periodStart.toISOString().slice(0, 10)}`,
        actorLabel: null,
        createdAt: (st.generatedAt ?? st.createdAt).toISOString(),
        href: null,
        accountLabel: st.bankAccount.accountNumber,
        accountId: st.bankAccountId,
      },
      seen,
    );
  }

  for (const m of companies) {
    pushUnique(
      events,
      {
        id: `company-verified-${m.companyId}`,
        kind: "COMPANY_VERIFIED",
        title: "Company verified",
        detail: m.company.name,
        actorLabel: null,
        createdAt: m.company.updatedAt.toISOString(),
        href: `/internal/companies/${m.companyId}`,
        accountLabel: null,
        accountId: null,
      },
      seen,
    );
  }

  for (const flag of allFlags) {
    pushUnique(
      events,
      {
        id: flag.id,
        kind: "OPS_REVIEW_FLAG",
        title: flag.status === "ACTIVE" ? "Fraud flag added" : "Fraud flag resolved",
        detail: flag.customReason ?? flag.reason.replace(/_/g, " "),
        actorLabel: flag.createdBy.discordUsername,
        createdAt: flag.createdAt.toISOString(),
        href: null,
        accountLabel: null,
        accountId: null,
      },
      seen,
    );
    if (flag.resolvedAt) {
      pushUnique(
        events,
        {
          id: `${flag.id}-resolved`,
          kind: "OPS_REVIEW_FLAG_RESOLVED",
          title: "Fraud flag resolved",
          detail: flag.resolveReason ?? "",
          actorLabel: flag.resolvedBy?.discordUsername ?? null,
          createdAt: flag.resolvedAt.toISOString(),
          href: null,
          accountLabel: null,
          accountId: null,
        },
        seen,
      );
    }
  }

  return events.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}

export async function buildUniversalCompanyTimeline(companyId: string, limit = 60): Promise<TimelineEvent[]> {
  await requireOperator();
  const events: TimelineEvent[] = [];
  const seen = new Set<string>();

  const [riEvents, bankTxs, loanApps, loans, altaCardApps, statements, company] = await Promise.all([
    prisma.companyRelationshipTimelineEvent.findMany({
      where: { companyId },
      orderBy: { occurredAt: "desc" },
      take: limit,
    }),
    prisma.bankTransaction.findMany({
      where: { bankAccount: { companyId }, status: "APPROVED" },
      orderBy: { createdAt: "desc" },
      take: 40,
      include: { bankAccount: true },
    }),
    prisma.loanApplication.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.loan.findMany({
      where: { companyId },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
    prisma.altaCardApplication.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
    prisma.bankStatement.findMany({
      where: { bankAccount: { companyId } },
      orderBy: { generatedAt: "desc" },
      take: 12,
      include: { bankAccount: true },
    }),
    prisma.company.findUnique({ where: { id: companyId } }),
  ]);

  const accountIds = (
    await prisma.bankAccount.findMany({ where: { companyId }, select: { id: true } })
  ).map((a) => a.id);

  const allFlags = await loadTimelineFlags([
    { targetType: "COMPANY", targetId: companyId },
    ...(accountIds.length ? [{ targetType: "BANK_ACCOUNT" as const, targetId: { in: accountIds } }] : []),
  ]);

  for (const e of riEvents) {
    pushUnique(
      events,
      {
        id: e.id,
        kind: e.eventType,
        title: e.title,
        detail: e.description ?? "",
        actorLabel: null,
        createdAt: e.occurredAt.toISOString(),
        href: e.relatedEntityId ? timelineHref(e.relatedEntityType, e.relatedEntityId) : null,
        accountLabel: null,
        accountId: null,
      },
      seen,
    );
  }

  if (company?.verificationStatus === "VERIFIED") {
    pushUnique(
      events,
      {
        id: `verified-${companyId}`,
        kind: "COMPANY_VERIFIED",
        title: "Company verified",
        detail: company.name,
        actorLabel: null,
        createdAt: company.updatedAt.toISOString(),
        href: `/internal/companies/${companyId}`,
        accountLabel: null,
        accountId: null,
      },
      seen,
    );
  }

  for (const tx of bankTxs) {
    pushUnique(
      events,
      {
        id: tx.id,
        kind: tx.type,
        title: `${txTypeLabel(tx.type)} · ${tx.referenceCode}`,
        detail: `${florin(decimalToNumber(tx.amount))} · ${tx.description}`,
        actorLabel: null,
        createdAt: (tx.reviewedAt ?? tx.createdAt).toISOString(),
        href: `/internal/bank/transactions/${tx.id}`,
        accountLabel: tx.bankAccount.accountNumber,
        accountId: tx.bankAccountId,
      },
      seen,
    );
  }

  for (const app of loanApps) {
    pushUnique(
      events,
      {
        id: app.id,
        kind: "LOAN_APPLICATION",
        title: `Loan application · ${app.status.replace(/_/g, " ")}`,
        detail: "",
        actorLabel: null,
        createdAt: app.createdAt.toISOString(),
        href: `/internal/lending/applications/${app.id}`,
        accountLabel: null,
        accountId: null,
      },
      seen,
    );
  }

  for (const loan of loans) {
    if (loan.approvedAt) {
      pushUnique(
        events,
        {
          id: `loan-approved-${loan.id}`,
          kind: "LOAN_FUNDED",
          title: "Loan funded",
          detail: florin(decimalToNumber(loan.principalAmount)),
          actorLabel: null,
          createdAt: loan.approvedAt.toISOString(),
          href: `/internal/lending/loans/${loan.id}`,
          accountLabel: null,
          accountId: null,
        },
        seen,
      );
    }
  }

  for (const app of altaCardApps) {
    pushUnique(
      events,
      {
        id: app.id,
        kind: "ALTA_CARD_APPLICATION",
        title: `Alta Card application · ${app.status.replace(/_/g, " ")}`,
        detail: app.cardType,
        actorLabel: null,
        createdAt: app.createdAt.toISOString(),
        href: `/internal/alta-card/applications/${app.id}`,
        accountLabel: null,
        accountId: null,
      },
      seen,
    );
  }

  for (const st of statements) {
    pushUnique(
      events,
      {
        id: st.id,
        kind: "STATEMENT_GENERATED",
        title: "Statement generated",
        detail: st.bankAccount.accountNumber,
        actorLabel: null,
        createdAt: (st.generatedAt ?? st.createdAt).toISOString(),
        href: null,
        accountLabel: st.bankAccount.accountNumber,
        accountId: st.bankAccountId,
      },
      seen,
    );
  }

  for (const flag of allFlags) {
    pushUnique(
      events,
      {
        id: flag.id,
        kind: "OPS_REVIEW_FLAG",
        title: flag.status === "ACTIVE" ? "Fraud flag added" : "Fraud flag resolved",
        detail: flag.customReason ?? flag.reason.replace(/_/g, " "),
        actorLabel: flag.createdBy.discordUsername,
        createdAt: flag.createdAt.toISOString(),
        href: null,
        accountLabel: null,
        accountId: null,
      },
      seen,
    );
  }

  return events.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}

function txTypeLabel(type: string): string {
  switch (type) {
    case "DEPOSIT":
      return "Deposit";
    case "WITHDRAWAL":
      return "Withdrawal";
    case "ADJUSTMENT":
      return "Manual adjustment";
    case "INTEREST_CREDIT":
      return "Interest payment";
    case "LOAN_PAYMENT":
      return "Loan payment";
    default:
      return type.replace(/_/g, " ");
  }
}

async function loadTimelineFlags(
  orClauses: Array<
    | { targetType: "USER" | "COMPANY" | "BANK_ACCOUNT" | "LOAN" | "ALTA_CARD"; targetId: string }
    | { targetType: "BANK_ACCOUNT" | "LOAN" | "ALTA_CARD"; targetId: { in: string[] } }
  >,
) {
  if (orClauses.length === 0) return [];
  try {
    return await prisma.opsReviewFlag.findMany({
      where: { OR: orClauses },
      include: { createdBy: true, resolvedBy: true },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
  } catch (error) {
    if (isMissingOpsV1TableError(error)) return [];
    throw error;
  }
}

function timelineHref(entityType: string | null, entityId: string): string | null {
  if (!entityType || !entityId) return null;
  switch (entityType) {
    case "BANK_ACCOUNT":
      return `/internal/bank/accounts/${entityId}`;
    case "LOAN":
      return `/internal/lending/loans/${entityId}`;
    case "ALTA_CARD":
      return `/internal/alta-card/cards/${entityId}`;
    default:
      return null;
  }
}
