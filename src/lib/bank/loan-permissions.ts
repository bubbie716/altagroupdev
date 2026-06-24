import type { AltaUser } from "@/lib/auth/types";
import { canManageBusinessTreasury, canViewBusinessTreasury } from "@/lib/auth/permissions";

export function canUserPayLoan(
  user: AltaUser,
  loan: { borrowerUserId: string | null; companyId: string | null; applicantUserId?: string },
): boolean {
  if (loan.companyId) {
    return canManageBusinessTreasury(user, { companyId: loan.companyId });
  }
  if (loan.borrowerUserId === user.id) return true;
  if (loan.applicantUserId === user.id) return true;
  return false;
}

export function canUserViewLoan(
  user: AltaUser,
  loan: { borrowerUserId: string | null; companyId: string | null; applicantUserId?: string },
): boolean {
  if (loan.companyId && canViewBusinessTreasury(user, { companyId: loan.companyId })) {
    return true;
  }
  return canUserPayLoan(user, loan);
}
