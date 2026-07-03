import { formatFlorin } from "@/lib/bank/format";
import { createUserNotification } from "@/server/notification.service";

export async function notifyDepositSubmitted(
  userId: string,
  amount: number,
  referenceCode: string,
  accountName: string,
): Promise<void> {
  await createUserNotification({
    userId,
    type: "DEPOSIT_SUBMITTED",
    title: "Deposit submitted",
    body: `Your deposit of ${formatFlorin(amount)} to ${accountName} (${referenceCode}) is pending Alta review.`,
    linkUrl: "/bank",
    metadata: { referenceCode, amount, accountName },
  });
}

export async function notifyDepositApproved(
  userId: string,
  amount: number,
  referenceCode: string,
): Promise<void> {
  await createUserNotification({
    userId,
    type: "DEPOSIT_APPROVED",
    title: "Deposit approved",
    body: `Your deposit of ${formatFlorin(amount)} (${referenceCode}) has been approved and credited to your account.`,
    linkUrl: "/bank",
    metadata: { referenceCode, amount },
  });
}

export async function notifyDepositDenied(
  userId: string,
  amount: number,
  referenceCode: string,
): Promise<void> {
  await createUserNotification({
    userId,
    type: "DEPOSIT_DENIED",
    title: "Deposit denied",
    body: `Your deposit of ${formatFlorin(amount)} (${referenceCode}) was denied.`,
    linkUrl: "/bank",
    metadata: { referenceCode, amount },
  });
}

export async function notifyWithdrawalSubmitted(
  userId: string,
  amount: number,
  referenceCode: string,
  accountName: string,
): Promise<void> {
  await createUserNotification({
    userId,
    type: "WITHDRAWAL_SUBMITTED",
    title: "Withdrawal submitted",
    body: `Your withdrawal of ${formatFlorin(amount)} from ${accountName} (${referenceCode}) is pending Alta processing.`,
    linkUrl: "/bank",
    metadata: { referenceCode, amount, accountName },
  });
}

export async function notifyWithdrawalApproved(
  userId: string,
  amount: number,
  referenceCode: string,
): Promise<void> {
  await createUserNotification({
    userId,
    type: "WITHDRAWAL_APPROVED",
    title: "Withdrawal approved",
    body: `Your withdrawal of ${formatFlorin(amount)} (${referenceCode}) has been approved.`,
    linkUrl: "/bank",
    metadata: { referenceCode, amount },
  });
}

export async function notifyWithdrawalDenied(
  userId: string,
  amount: number,
  referenceCode: string,
): Promise<void> {
  await createUserNotification({
    userId,
    type: "WITHDRAWAL_DENIED",
    title: "Withdrawal denied",
    body: `Your withdrawal of ${formatFlorin(amount)} (${referenceCode}) was denied.`,
    linkUrl: "/bank",
    metadata: { referenceCode, amount },
  });
}

export async function notifyTransferCompleted(
  userId: string,
  amount: number,
  referenceCode: string,
  fromAccountName: string,
  toAccountName: string,
): Promise<void> {
  await createUserNotification({
    userId,
    type: "TRANSFER_COMPLETED",
    title: "Transfer complete",
    body: `Moved ${formatFlorin(amount)} from ${fromAccountName} to ${toAccountName}. Reference \`${referenceCode}\`.`,
    linkUrl: "/bank/transfers/intrabank",
    metadata: { referenceCode, amount, fromAccountName, toAccountName },
  });
}

export async function notifyAltaPaySent(
  userId: string,
  amount: number,
  referenceCode: string,
  payeeName: string,
  fundingSourceLabel: string,
): Promise<void> {
  await createUserNotification({
    userId,
    type: "ALTA_PAY_SENT",
    title: "Alta Pay sent",
    body: `Paid ${formatFlorin(amount)} to ${payeeName} from ${fundingSourceLabel}. Reference \`${referenceCode}\`.`,
    linkUrl: "/bank/pay",
    metadata: { referenceCode, amount, payeeName, fundingSourceLabel },
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
): Promise<void> {
  await createUserNotification({
    userId,
    type: "LOAN_APPLICATION_DENIED",
    title: "Loan application declined",
    body: "Your lending application was declined.",
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
): Promise<void> {
  await createUserNotification({
    userId,
    type: "ALTA_CARD_APPLICATION_DENIED",
    title: "Alta Card application declined",
    body: "Your Alta Card application was declined.",
    linkUrl: "/bank/alta-card",
    metadata: { applicationId },
  });
}
