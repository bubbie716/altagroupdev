import type { CryptoOrderError } from "@/lib/terminal/crypto/crypto-order-types";

const SKIP_CUSTOMER_NOTIFY_CODES = new Set([
  "IDEMPOTENCY_CONFLICT",
  "REQUOTE_REQUIRED",
  "HIGH_PRICE_IMPACT_CONFIRMATION_REQUIRED",
  "QUOTE_EXPIRED",
  "RATE_LIMITED",
  "CONSENT_REQUIRED",
]);

const FAILED_CODES = new Set(["INTERNAL_FAILURE"]);

export function classifyCryptoOrderNotification(
  code: string,
): "rejected" | "failed" | "skip" {
  if (SKIP_CUSTOMER_NOTIFY_CODES.has(code)) return "skip";
  if (FAILED_CODES.has(code)) return "failed";
  return "rejected";
}

/**
 * Post-failure customer + staff notifications for crypto orders.
 * Fire-and-forget — never throw into the trading path.
 */
export function scheduleCryptoOrderFailureNotifications(input: {
  userId: string;
  portfolioId: string;
  symbol?: string;
  side?: string;
  error: CryptoOrderError;
  actorUserId?: string;
}): void {
  const kind = classifyCryptoOrderNotification(input.error.code);
  if (kind === "skip") return;

  const type =
    kind === "failed" ? "TERMINAL_CRYPTO_ORDER_FAILED" : "TERMINAL_CRYPTO_ORDER_REJECTED";
  const title = kind === "failed" ? "Crypto order failed" : "Crypto order rejected";
  const symbol = input.symbol?.trim() || "asset";
  const body =
    input.error.customerMessage?.trim() ||
    (kind === "failed"
      ? `Your ${symbol} order could not be completed. Please try again.`
      : `Your ${symbol} order was rejected.`);

  void (async () => {
    try {
      const { scheduleCreateUserNotification } = await import("@/server/notification.service");
      scheduleCreateUserNotification({
        userId: input.userId,
        type,
        title,
        body: body.slice(0, 4096),
        linkUrl: `/terminal/orders?portfolioId=${input.portfolioId}`,
        linkLabel: "View on Alta Terminal",
        metadata: {
          code: input.error.code,
          symbol: input.symbol,
          side: input.side,
          portfolioId: input.portfolioId,
        },
      });
    } catch {
      /* ignore */
    }

    try {
      const { writeAuditLog } = await import("@/server/audit.service");
      await writeAuditLog({
        actorUserId: input.actorUserId ?? input.userId,
        action: type,
        entityType: "TERMINAL_CRYPTO_ORDER",
        description: `${title}: ${input.error.code}`,
        targetUserId: input.userId,
        metadata: {
          source: "CUSTOMER",
          code: input.error.code,
          symbol: input.symbol,
          side: input.side,
          portfolioId: input.portfolioId,
          // Customer-safe reason only — never attach internal stack traces.
          customerMessage: body.slice(0, 200),
        },
      });
    } catch {
      /* ignore */
    }
  })();
}
