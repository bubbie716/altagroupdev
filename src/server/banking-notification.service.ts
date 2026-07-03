import { formatFlorin } from "@/lib/bank/format";
import { createUserNotification } from "@/server/notification.service";

function reviewNoteLine(reviewNote?: string | null): string {
  const note = reviewNote?.trim();
  return note ? `\n\nNote: ${note.slice(0, 400)}` : "";
}

export async function notifyDepositApproved(
  userId: string,
  amount: number,
  referenceCode: string,
  reviewNote?: string | null,
): Promise<void> {
  await createUserNotification({
    userId,
    type: "DEPOSIT_APPROVED",
    title: "Deposit approved",
    body: `Your deposit of ${formatFlorin(amount)} (${referenceCode}) has been approved and credited to your account.${reviewNoteLine(reviewNote)}`,
    linkUrl: "/bank",
    metadata: { referenceCode, amount },
  });
}

export async function notifyDepositDenied(
  userId: string,
  amount: number,
  referenceCode: string,
  reviewNote?: string | null,
): Promise<void> {
  await createUserNotification({
    userId,
    type: "DEPOSIT_DENIED",
    title: "Deposit declined",
    body: `Your deposit of ${formatFlorin(amount)} (${referenceCode}) was declined.${reviewNoteLine(reviewNote)}`,
    linkUrl: "/bank",
    metadata: { referenceCode, amount },
  });
}

export async function notifyWithdrawalApproved(
  userId: string,
  amount: number,
  referenceCode: string,
  reviewNote?: string | null,
): Promise<void> {
  await createUserNotification({
    userId,
    type: "WITHDRAWAL_APPROVED",
    title: "Withdrawal approved",
    body: `Your withdrawal of ${formatFlorin(amount)} (${referenceCode}) has been approved.${reviewNoteLine(reviewNote)}`,
    linkUrl: "/bank",
    metadata: { referenceCode, amount },
  });
}

export async function notifyWithdrawalDenied(
  userId: string,
  amount: number,
  referenceCode: string,
  reviewNote?: string | null,
): Promise<void> {
  await createUserNotification({
    userId,
    type: "WITHDRAWAL_DENIED",
    title: "Withdrawal declined",
    body: `Your withdrawal of ${formatFlorin(amount)} (${referenceCode}) was declined.${reviewNoteLine(reviewNote)}`,
    linkUrl: "/bank",
    metadata: { referenceCode, amount },
  });
}

export async function notifyLoanApplicationApproved(
  userId: string,
  applicationId: string,
  principalAmount: number,
): Promise<void> {
  await createUserNotification({
    userId,
    type: "LOAN_APPLICATION_APPROVED",
    title: "Loan application approved",
    body: `Your lending application was approved for ${formatFlorin(principalAmount)}.`,
    linkUrl: `/bank/lending/applications/${applicationId}`,
    metadata: { applicationId, principalAmount },
  });
}

export async function notifyLoanApplicationDenied(
  userId: string,
  applicationId: string,
  reviewNote?: string | null,
): Promise<void> {
  await createUserNotification({
    userId,
    type: "LOAN_APPLICATION_DENIED",
    title: "Loan application declined",
    body: `Your lending application was declined.${reviewNoteLine(reviewNote)}`,
    linkUrl: `/bank/lending/applications/${applicationId}`,
    metadata: { applicationId },
  });
}

export async function notifyAltaCardApplicationApproved(
  userId: string,
  applicationId: string,
  tier: string,
  approvedLimit: number,
): Promise<void> {
  await createUserNotification({
    userId,
    type: "ALTA_CARD_APPLICATION_APPROVED",
    title: "Alta Card application approved",
    body: `Your Alta Card application was approved (${tier}, limit ${formatFlorin(approvedLimit)}).`,
    linkUrl: "/bank/alta-card",
    metadata: { applicationId, tier, approvedLimit },
  });
}

export async function notifyAltaCardApplicationDenied(
  userId: string,
  applicationId: string,
  denialReason: string,
): Promise<void> {
  await createUserNotification({
    userId,
    type: "ALTA_CARD_APPLICATION_DENIED",
    title: "Alta Card application declined",
    body: `Your Alta Card application was declined.${reviewNoteLine(denialReason)}`,
    linkUrl: "/bank/alta-card",
    metadata: { applicationId },
  });
}
