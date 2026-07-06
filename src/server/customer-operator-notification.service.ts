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
import {
  assertSilentNotificationAllowed,
  isSilentNotificationForbidden,
  silentNotificationForbiddenMessage,
} from "@/lib/internal/silent-notification-restrictions";
import type { SilentForbiddenAction } from "@/lib/internal/silent-notification-restrictions";
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
  actorUserId?: string;
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
  actorUserId?: string;
}): Promise<boolean> {
  if (!shouldNotifyCustomer(input)) return false;

  const userIds = await resolveBankAccountNotifyUserIds(input.account);
  if (userIds.length === 0) return false;

  const linkUrl = input.transactionId
    ? buildOperatorTransactionLink(input.transactionId)
    : buildOperatorAccountLink(input.account.id);

  const { sent } = await notifyCustomerOperatorUsersBestEffort({
    userIds,
    kind: input.kind,
    accountNumber: input.account.accountNumber,
    accountId: input.account.id,
    transactionId: input.transactionId,
    amount: input.amount,
    customerFacingReason: input.customerFacingReason,
    linkUrl,
    source: input.source,
    actorUserId: input.actorUserId,
    metadata: input.metadata,
  });
  return sent > 0;
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
  actorUserId?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ attempted: number; sent: number }> {
  const uniqueUserIds = [...new Set(input.userIds.filter(Boolean))];
  if (uniqueUserIds.length === 0) return { attempted: 0, sent: 0 };

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

  let sent = 0;
  for (const userId of uniqueUserIds) {
    scheduleSendCustomerOperatorDiscordNotification({
      userId,
      title: copy.title,
      body: copy.body,
      linkUrl,
      linkLabel,
      source: input.source,
      actorUserId: input.actorUserId,
      metadata: {
        kind: input.kind,
        accountId: input.accountId,
        transactionId: input.transactionId,
        ...input.metadata,
      },
    });
    sent += 1;
  }
  return { attempted: uniqueUserIds.length, sent };
}

/** Sends a customer-safe operator action DM. Never throws — failures are logged only. */
async function deliverCustomerOperatorDiscordNotification(input: {
  userId: string;
  title: string;
  body: string;
  linkUrl: string;
  linkLabel?: string;
  source?: string;
  actorUserId?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ sent: boolean; reason?: string }> {
  try {
    const { dispatchNotificationDm } = await import(
      "@/server/notification-discord-dispatch.service"
    );
    const result = await dispatchNotificationDm({
      userId: input.userId,
      title: input.title,
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

      const actorUserId = input.actorUserId ?? input.userId;
      const { recordCustomerDmDeliveryFailure } = await import(
        "@/server/notification-delivery-audit.service"
      );
      const { isRetryableDeliveryFailure } = await import(
        "@/server/notification-delivery-audit.service"
      );
      const retryable = isRetryableDeliveryFailure(result.reason);
      await recordCustomerDmDeliveryFailure({
        actorUserId,
        userId: input.userId,
        title: input.title,
        reason: result.reason ?? "not_sent",
        retryable,
        source: input.source,
        sourceAction: typeof input.metadata?.kind === "string" ? input.metadata.kind : undefined,
        metadata: input.metadata,
      });

      if (retryable) {
        const kind = typeof input.metadata?.kind === "string" ? input.metadata.kind : "generic";
        const entityId =
          typeof input.metadata?.transactionId === "string"
            ? input.metadata.transactionId
            : input.linkUrl;
        const { enqueueCustomerDmRetry } = await import("@/server/notification-retry-queue.service");
        await enqueueCustomerDmRetry({
          userId: input.userId,
          payload: {
            title: input.title,
            body: input.body,
            linkUrl: input.linkUrl,
            linkLabel: input.linkLabel,
          },
          dedupeKey: `customer-dm:${input.userId}:${kind}:${entityId}`,
          sourceAction: kind,
          sourceEntityId: entityId,
          reason: result.reason,
        });
      }

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

/** Discord API calls must not block banking UX — deliver in the background. */
export function scheduleSendCustomerOperatorDiscordNotification(input: {
  userId: string;
  title: string;
  body: string;
  linkUrl: string;
  linkLabel?: string;
  source?: string;
  actorUserId?: string;
  metadata?: Record<string, unknown>;
}): void {
  void deliverCustomerOperatorDiscordNotification(input).catch((error) => {
    logDelivery("background operator DM failed", {
      userId: input.userId,
      title: input.title,
      error: error instanceof Error ? error.message : String(error),
      source: input.source,
    });
  });
}

/** @deprecated Prefer scheduleSendCustomerOperatorDiscordNotification for request paths. */
export async function sendCustomerOperatorDiscordNotification(input: {
  userId: string;
  title: string;
  body: string;
  linkUrl: string;
  linkLabel?: string;
  source?: string;
  actorUserId?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ sent: boolean; reason?: string }> {
  return deliverCustomerOperatorDiscordNotification(input);
}

/** Runs a customer notification unless silent; returns whether a notification was attempted and sent. */
export async function deliverOperatorCustomerNotification(input: {
  actorUserId: string;
  notificationOptions?: OperatorNotificationOptions;
  silentRestriction?: {
    kind?: OperatorCustomerNotificationKind;
    action?: SilentForbiddenAction;
  };
  deliver: () => Promise<boolean>;
}): Promise<{ customerNotificationSent: boolean; auditMetadata: Record<string, boolean | string | null> }> {
  if (
    isSilentNotificationForbidden(input.silentRestriction ?? {}, input.notificationOptions)
  ) {
    const { recordFailedAction } = await import("@/server/failed-action-audit.service");
    await recordFailedAction({
      actorUserId: input.actorUserId,
      actionAttempted: "SILENT_NOTIFICATION",
      auditAction: "OPS_SILENT_NOTIFICATION_REJECTED",
      failureReason: silentNotificationForbiddenMessage(input.silentRestriction ?? {}),
      entityType: "USER",
      source: "INTERNAL",
    });
    throw new Error(
      `BAD_REQUEST:${silentNotificationForbiddenMessage(input.silentRestriction ?? {})}`,
    );
  }

  if (input.silentRestriction) {
    assertSilentNotificationAllowed(input.silentRestriction, input.notificationOptions);
  }

  let customerNotificationSent = false;
  if (shouldNotifyCustomer(input.notificationOptions)) {
    customerNotificationSent = true;
    void input.deliver().catch((error) => {
      console.error("[customer-operator-notification] delivery failed", error);
    });
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
