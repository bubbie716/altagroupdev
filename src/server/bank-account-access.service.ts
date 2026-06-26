import type { Prisma } from "@prisma/client";
import type { AltaUser } from "@/lib/auth/types";
import { canManageBusinessTreasury, canViewBusinessTreasury } from "@/lib/auth/permissions";
import { prisma } from "@/server/db";
import { mapDbUserToAltaUser, userWithMembershipsInclude } from "@/server/user-mapper";

export type CompanyBankAccountAccess = "view" | "manage";

function forbidden(): never {
  throw new Error("FORBIDDEN");
}

export function companyIdsForBankAccess(user: AltaUser, access: CompanyBankAccountAccess): string[] {
  return user.companyMemberships
    .filter((membership) =>
      access === "manage"
        ? canManageBusinessTreasury(user, { companyId: membership.companyId })
        : canViewBusinessTreasury(user, { companyId: membership.companyId }),
    )
    .map((membership) => membership.companyId);
}

export function bankAccountAccessWhere(
  user: AltaUser,
  access: CompanyBankAccountAccess,
): Prisma.BankAccountWhereInput {
  const companyIds = companyIdsForBankAccess(user, access);
  return {
    OR: [
      { userId: user.id, companyId: null },
      ...(companyIds.length > 0 ? [{ companyId: { in: companyIds } }] : []),
    ],
  };
}

export async function loadAltaUserOrThrow(userId: string): Promise<AltaUser> {
  const userRecord = await prisma.user.findUnique({
    where: { id: userId },
    include: userWithMembershipsInclude,
  });
  if (!userRecord) forbidden();
  return mapDbUserToAltaUser(userRecord);
}

export async function findAccessibleBankAccount(
  userId: string,
  accountId: string,
  access: CompanyBankAccountAccess = "view",
) {
  const user = await loadAltaUserOrThrow(userId);
  return prisma.bankAccount.findFirst({
    where: { id: accountId, ...bankAccountAccessWhere(user, access) },
  });
}

export async function isBankAccountAccessibleByUser(
  userId: string,
  accountId: string,
  access: CompanyBankAccountAccess = "view",
): Promise<boolean> {
  const account = await findAccessibleBankAccount(userId, accountId, access);
  return !!account;
}
