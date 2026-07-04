import { prisma } from "@/server/db";
import { writeAuditLog } from "@/server/audit.service";
import { sendStaffAuditMessage } from "@/server/staff-audit-notification.service";
import { resolveSystemActorUserId } from "@/server/system-actor.service";

const WARNING_DAYS = 7;
const ESCALATION_DAYS = 14;

export type QueueEscalationItem = {
  queue: string;
  entityId: string;
  ageDays: number;
  level: "warning" | "escalation";
  description: string;
  internalLink?: string;
};

export type QueueEscalationResult = {
  warnings: QueueEscalationItem[];
  escalations: QueueEscalationItem[];
  expired: QueueEscalationItem[];
};

function ageDays(from: Date, now: Date): number {
  return Math.floor((now.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

function classifyAge(from: Date, now: Date): "ok" | "warning" | "escalation" {
  const days = ageDays(from, now);
  if (days >= ESCALATION_DAYS) return "escalation";
  if (days >= WARNING_DAYS) return "warning";
  return "ok";
}

export async function runQueueEscalationJob(now = new Date()): Promise<QueueEscalationResult> {
  const warnings: QueueEscalationItem[] = [];
  const escalations: QueueEscalationItem[] = [];
  const expired: QueueEscalationItem[] = [];

  const [
    pendingDeposits,
    pendingWithdrawals,
    pendingInterbank,
    pendingCompanies,
    pendingPrivateInvites,
  ] = await Promise.all([
    prisma.bankTransaction.findMany({
      where: { type: "DEPOSIT", status: "PENDING" },
      select: { id: true, referenceCode: true, createdAt: true },
    }),
    prisma.bankTransaction.findMany({
      where: { type: "WITHDRAWAL", status: "PENDING" },
      select: { id: true, referenceCode: true, createdAt: true },
    }),
    prisma.scheduledPayment.findMany({
      where: { transferScope: "INTERBANK", status: "PENDING_REVIEW" },
      select: { id: true, label: true, createdAt: true },
    }),
    prisma.company.findMany({
      where: { verificationStatus: { in: ["UNVERIFIED", "PENDING"] } },
      select: { id: true, name: true, updatedAt: true },
    }),
    prisma.altaPrivateInvitation.findMany({
      where: { status: "PENDING" },
      select: { id: true, createdAt: true },
    }),
  ]);

  const moneyMovementQueues = [
    ...pendingDeposits.map((r) => ({
      queue: "pending_deposit",
      entityId: r.id,
      createdAt: r.createdAt,
      description: `Pending deposit ${r.referenceCode}`,
      internalLink: `/internal/bank/transactions/${r.id}`,
    })),
    ...pendingWithdrawals.map((r) => ({
      queue: "pending_withdrawal",
      entityId: r.id,
      createdAt: r.createdAt,
      description: `Pending withdrawal ${r.referenceCode}`,
      internalLink: `/internal/bank/transactions/${r.id}`,
    })),
    ...pendingInterbank.map((r) => ({
      queue: "pending_interbank",
      entityId: r.id,
      createdAt: r.createdAt,
      description: `Pending interbank transfer ${r.label}`,
      internalLink: `/internal/queues/scheduled-transfers`,
    })),
  ];

  for (const item of moneyMovementQueues) {
    const level = classifyAge(item.createdAt, now);
    const days = ageDays(item.createdAt, now);
    if (level === "warning") {
      warnings.push({ ...item, ageDays: days, level: "warning" });
    } else if (level === "escalation") {
      escalations.push({ ...item, ageDays: days, level: "escalation" });
    }
  }

  for (const company of pendingCompanies) {
    const level = classifyAge(company.updatedAt, now);
    const days = ageDays(company.updatedAt, now);
    const base = {
      queue: "company_verification",
      entityId: company.id,
      ageDays: days,
      description: `Pending company verification: ${company.name}`,
      internalLink: `/internal/companies/${company.id}`,
    };
    if (level === "warning") warnings.push({ ...base, level: "warning" });
    else if (level === "escalation") escalations.push({ ...base, level: "escalation" });
  }

  for (const invite of pendingPrivateInvites) {
    const level = classifyAge(invite.createdAt, now);
    const days = ageDays(invite.createdAt, now);
    const base = {
      queue: "alta_private_invitation",
      entityId: invite.id,
      ageDays: days,
      description: `Pending Alta Private invitation`,
      internalLink: `/internal/queues/private-banking`,
    };
    if (level === "warning") warnings.push({ ...base, level: "warning" });
    else if (level === "escalation") {
      escalations.push({ ...base, level: "escalation" });
      if (days >= ESCALATION_DAYS) {
        await prisma.altaPrivateInvitation.updateMany({
          where: { id: invite.id, status: "PENDING" },
          data: { status: "EXPIRED", updatedAt: now },
        });
        expired.push({ ...base, level: "escalation" });
      }
    }
  }

  if (warnings.length > 0 || escalations.length > 0) {
    const actorUserId = await resolveSystemActorUserId();
    await writeAuditLog({
      actorUserId,
      action: "OPS_QUEUE_AGING_ALERT",
      entityType: "PLATFORM",
      description: `Queue aging: ${warnings.length} warning(s), ${escalations.length} escalation(s)`,
      metadata: {
        source: "CRON",
        severity: escalations.length > 0 ? "critical" : "warning",
        warningCount: warnings.length,
        escalationCount: escalations.length,
        expiredCount: expired.length,
        warnings,
        escalations,
        expired,
        requiresAction: true,
      },
    });

    if (escalations.length > 0) {
      sendStaffAuditMessage({
        product: "Operations",
        action: "Aged queue escalation",
        details: `${escalations.length} item(s) pending ≥ ${ESCALATION_DAYS} days`,
        internalUrl: "/internal",
        severity: "CRITICAL",
        requiresAction: true,
        dedupeKey: `queue-escalation:${now.toISOString().slice(0, 10)}`,
      });
    } else if (warnings.length > 0) {
      sendStaffAuditMessage({
        product: "Operations",
        action: "Aged queue warning",
        details: `${warnings.length} item(s) pending ≥ ${WARNING_DAYS} days`,
        internalUrl: "/internal",
        severity: "WARNING",
        requiresAction: true,
        dedupeKey: `queue-warning:${now.toISOString().slice(0, 10)}`,
      });
    }
  }

  return { warnings, escalations, expired };
}

export async function getQueueEscalationSummary(now = new Date()): Promise<{
  warningCount: number;
  escalationCount: number;
}> {
  const result = await runQueueEscalationJob(now);
  return {
    warningCount: result.warnings.length,
    escalationCount: result.escalations.length,
  };
}
