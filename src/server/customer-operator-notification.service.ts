import type { OperatorCustomerNotificationKind } from "@/lib/bank/customer-operator-notification-copy";
import {
  buildOperatorAccountLink,
  buildOperatorActivityLink,
  buildOperatorCustomerNotificationCopy,
  buildOperatorTransactionLink,
} from "@/lib/bank/customer-operator-notification-copy";
import {
  buildOperatorNotificationAuditMetadata,
  shouldNotifyCustomer,
  type OperatorNotificationOptions,
} from "@/lib/internal/operator-notification-options";
import { prisma } from "@/server/db";

const COMPANY_INCOMING_NOTIFY_ROLES = ["OWNER", "EXECUTIVE", "FINANCE_MANAGER"] as const;

function logDelivery(message: string, meta?: Record<string, unknown>): void {
  if (process.env.NODE_ENV === "test") return;
  console.info(`[customer-operator-notification] ${message}`, meta ?? {});
}

export type SendCustomerOperatorNotificationInput = {
  userId: string;
  kind: OperatorCustomerNotificationKind;
  accountId?: string;
  accountNumber?: string;
  transactionId?: string;
  amount?: number;
  /** Customer-safe explanation only — never internal staff notes. */
  customerFacingReason?: string | null;
  source?: string;
  metadata?: Record<string, unknown>;
};

async function listCompanyTreasuryNotifyUserIds(companyId: string): Promise<string[]> {
  const rows = await prisma.companyMembership.findMany({
    where: {
      companyId,
      role: { in: [...COMPANY_INCOMING_NOTIFY_ROLES] },
    },
    select: { userId: true },
  });
  return [...new Set(rows.map((row) => row.userId))];
}

export async function resolveBankAccountNotifyUserIds(input: {
  userId: string;
  companyId: string | null;
}): Promise<string[]> {
  if (input.companyId) {
    const companyUserIds = await listCompanyTreasuryNotifyUserIds(input.companyId);
    if (companyUserIds.length > 0) return companyUserIds;
  }
  return input.userId ? [input.userId] : [];
}

export async function notifyBankAccountCustomersBestEffort(input: {
  account: { id: string; accountNumber: string; userId: string; companyId: string | null };
  kind: OperatorCustomerNotificationKind;
  amount?: number;
  transactionId?: string;
  customerFacingReason?: string | null;
  source?: string;
  metadata?: Record<string, unknown>;
  silentNotification?: boolean;
}): Promise<boolean> {
  if (!shouldNotifyCustomer(input)) return false;

  const userIds = await resolveBankAccountNotifyUserIds(input.account);
  if (userIds.length === 0) return false;

  const linkUrl = input.transactionId
    ? buildOperatorTransactionLink(input.transactionId)
    : buildOperatorAccountLink(input.account.id);

  await notifyCustomerOperatorUsersBestEffort({
    userIds,
    kind: input.kind,
    accountNumber: input.account.accountNumber,
    accountId: input.account.id,
    transactionId: input.transactionId,
    amount: input.amount,
    customerFacingReason: input.customerFacingReason,
    linkUrl,
    source: input.source,
    metadata: input.metadata,
  });
  return true;
}

export async function notifyCustomerOperatorUsersBestEffort(input: {
  userIds: string[];
  kind: OperatorCustomerNotificationKind;
  accountNumber: string;
  accountId?: string;
  transactionId?: string;
  amount?: number;
  customerFacingReason?: string | null;
  linkUrl?: string;
  source?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const uniqueUserIds = [...new Set(input.userIds.filter(Boolean))];
  if (uniqueUserIds.length === 0) return;

  const copy = buildOperatorCustomerNotificationCopy({
    kind: input.kind,
    accountNumber: input.accountNumber,
    amount: input.amount,
    customerFacingReason: input.customerFacingReason,
  });

  const linkUrl =
    input.linkUrl ??
    (input.transactionId
      ? buildOperatorTransactionLink(input.transactionId)
      : input.accountId
        ? buildOperatorAccountLink(input.accountId)
        : buildOperatorActivityLink());

  const linkLabel =
    input.kind === "transaction_under_review" || input.kind === "transaction_released"
      ? "View activity"
      : "View account";

  for (const userId of uniqueUserIds) {
    await sendCustomerOperatorDiscordNotification({
      userId,
      title: copy.title,
      body: copy.body,
      linkUrl,
      linkLabel,
      source: input.source,
      metadata: {
        kind: input.kind,
        accountId: input.accountId,
        transactionId: input.transactionId,
        ...input.metadata,
      },
    });
  }
}

/** Sends a customer-safe operator action DM. Never throws — failures are logged only. */
export async function sendCustomerOperatorDiscordNotification(input: {
  userId: string;
  title: string;
  body: string;
  linkUrl: string;
  linkLabel?: string;
  source?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ sent: boolean; reason?: string }> {
  try {
    const { dispatchNotificationDm } = await import(
      "@/server/notification-discord-dispatch.service"
    );
    const result = await dispatchNotificationDm({
      userId: input.userId,
      title: `[Alta Bank] ${input.title}`,
      body: input.body,
      linkUrl: input.linkUrl,
      linkLabel: input.linkLabel ?? "View on Alta Bank",
    });

    if (!result.sent) {
      logDelivery("DM not sent", {
        userId: input.userId,
        title: input.title,
        reason: result.reason,
        source: input.source,
        metadata: input.metadata,
      });
      return { sent: false, reason: result.reason };
    }

    logDelivery("DM sent", { userId: input.userId, title: input.title, source: input.source });
    return { sent: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logDelivery("DM delivery failed", {
      userId: input.userId,
      title: input.title,
      error: message,
      source: input.source,
    });
    return { sent: false, reason: message };
  }
}

/** Runs a customer notification unless silent; returns whether a notification was attempted and sent. */
export async function deliverOperatorCustomerNotification(input: {
  actorUserId: string;
  notificationOptions?: OperatorNotificationOptions;
  deliver: () => Promise<boolean>;
}): Promise<{ customerNotificationSent: boolean; auditMetadata: Record<string, boolean | string | null> }> {
  let customerNotificationSent = false;
  if (shouldNotifyCustomer(input.notificationOptions)) {
    try {
      customerNotificationSent = await input.deliver();
    } catch (error) {
      console.error("[customer-operator-notification] delivery failed", error);
      customerNotificationSent = false;
    }
  }
  return {
    customerNotificationSent,
    auditMetadata: buildOperatorNotificationAuditMetadata(
      input.actorUserId,
      input.notificationOptions,
      customerNotificationSent,
    ),
  };
}
