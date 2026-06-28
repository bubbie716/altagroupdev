import { getInternalUserDetail } from "@/server/internal-user-management.service";
import { prisma } from "@/server/db";
import { requireOperator } from "@/server/permissions.service";
import { buildUniversalCustomerTimeline } from "@/server/ops-universal-timeline.service";
import { listInternalNotes } from "@/server/internal-note.service";

function decimalToNumber(value: { toString(): string }): number {
  return Number(value.toString());
}

export async function getInternalCustomer360(userId: string) {
  await requireOperator();
  const [user, notes, timeline, altaPaySent, altaPayReceived] = await Promise.all([
    getInternalUserDetail(userId),
    listInternalNotes("USER", userId),
    buildUniversalCustomerTimeline(userId, 60),
    prisma.bankTransaction.findMany({
      where: {
        bankAccount: { userId },
        description: { contains: "Alta Pay", mode: "insensitive" },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { bankAccount: true },
    }),
    prisma.bankTransaction.findMany({
      where: {
        bankAccount: { company: { memberships: { some: { userId } } } },
        type: "DEPOSIT",
        description: { contains: "Alta Pay", mode: "insensitive" },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { bankAccount: { include: { company: true } } },
    }),
  ]);

  const isPrivateClient = user.tags.includes("private_client");

  return {
    user,
    notes,
    timeline,
    isPrivateClient,
    altaPayActivity: [
      ...altaPaySent.map((tx) => ({
        id: tx.id,
        accountId: tx.bankAccountId,
        accountName: tx.bankAccount.accountName,
        direction: "sent" as const,
        referenceCode: tx.referenceCode,
        amount: decimalToNumber(tx.amount),
        accountNumber: tx.bankAccount.accountNumber,
        description: tx.description,
        createdAt: tx.createdAt.toISOString(),
      })),
      ...altaPayReceived.map((tx) => ({
        id: tx.id,
        accountId: tx.bankAccountId,
        accountName: tx.bankAccount.accountName,
        direction: "received" as const,
        referenceCode: tx.referenceCode,
        amount: decimalToNumber(tx.amount),
        accountNumber: tx.bankAccount.accountNumber,
        description: tx.description,
        createdAt: tx.createdAt.toISOString(),
      })),
    ].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  };
}
