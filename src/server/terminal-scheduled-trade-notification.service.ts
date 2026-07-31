import type { ScheduledTradeInstructionRow } from "@/lib/terminal/scheduled-trade-types";
import { scheduleCreateUserNotification } from "@/server/notification.service";

function scheduleLink(instructionId: string): string {
  return `/terminal/orders?tab=scheduled&instructionId=${instructionId}`;
}

export function notifyTerminalScheduledTradeCreated(
  userId: string,
  row: ScheduledTradeInstructionRow,
): void {
  scheduleCreateUserNotification({
    userId,
    type: "TERMINAL_SCHEDULED_TRADE_CREATED",
    title: "Scheduled trade created",
    body: `${row.side.toUpperCase()} ${row.quantity} ${row.symbol} · ${row.portfolioName}`,
    linkUrl: scheduleLink(row.id),
    metadata: { instructionId: row.id, portfolioId: row.portfolioId },
  });
}

export function notifyTerminalScheduledTradePaused(userId: string, row: ScheduledTradeInstructionRow): void {
  scheduleCreateUserNotification({
    userId,
    type: "TERMINAL_SCHEDULED_TRADE_PAUSED",
    title: "Scheduled trade paused",
    body: `${row.symbol} schedule paused for ${row.portfolioName}.`,
    linkUrl: scheduleLink(row.id),
    metadata: { instructionId: row.id },
  });
}

export function notifyTerminalScheduledTradeResumed(userId: string, row: ScheduledTradeInstructionRow): void {
  scheduleCreateUserNotification({
    userId,
    type: "TERMINAL_SCHEDULED_TRADE_RESUMED",
    title: "Scheduled trade resumed",
    body: `${row.symbol} schedule resumed for ${row.portfolioName}.`,
    linkUrl: scheduleLink(row.id),
    metadata: { instructionId: row.id },
  });
}

export function notifyTerminalScheduledTradeCancelled(userId: string, row: ScheduledTradeInstructionRow): void {
  scheduleCreateUserNotification({
    userId,
    type: "TERMINAL_SCHEDULED_TRADE_CANCELLED",
    title: "Scheduled trade cancelled",
    body: `${row.symbol} schedule cancelled for ${row.portfolioName}.`,
    linkUrl: scheduleLink(row.id),
    metadata: { instructionId: row.id },
  });
}

export function notifyTerminalScheduledTradeOrderSubmitted(
  userId: string,
  input: { instructionId: string; symbol: string; side: string; quantity: number; orderId?: string },
): void {
  scheduleCreateUserNotification({
    userId,
    type: "TERMINAL_SCHEDULED_TRADE_ORDER_SUBMITTED",
    title: "Scheduled trade order submitted",
    body: `${input.side.toUpperCase()} ${input.quantity} ${input.symbol} was submitted.`,
    linkUrl: scheduleLink(input.instructionId),
    metadata: { instructionId: input.instructionId, orderId: input.orderId ?? null },
  });
}

export function notifyTerminalScheduledTradeAttemptFailed(
  userId: string,
  input: { instructionId: string; symbol: string; summary: string; paused?: boolean },
): void {
  scheduleCreateUserNotification({
    userId,
    type: "TERMINAL_SCHEDULED_TRADE_ATTEMPT_FAILED",
    title: input.paused ? "Scheduled trade paused after failures" : "Scheduled trade attempt failed",
    body: `${input.symbol}: ${input.summary}`,
    linkUrl: scheduleLink(input.instructionId),
    metadata: { instructionId: input.instructionId, paused: Boolean(input.paused) },
  });
}

export function notifyTerminalScheduledTradeAttemptSkipped(
  userId: string,
  input: { instructionId: string; symbol: string; summary: string },
): void {
  scheduleCreateUserNotification({
    userId,
    type: "TERMINAL_SCHEDULED_TRADE_ATTEMPT_SKIPPED",
    title: "Scheduled trade deferred",
    body: `${input.symbol}: ${input.summary}`,
    linkUrl: scheduleLink(input.instructionId),
    metadata: { instructionId: input.instructionId },
  });
}

export function notifyTerminalScheduledTradeCompleted(
  userId: string,
  input: { instructionId: string; symbol: string },
): void {
  scheduleCreateUserNotification({
    userId,
    type: "TERMINAL_SCHEDULED_TRADE_COMPLETED",
    title: "Scheduled trade completed",
    body: `${input.symbol} one-time schedule finished.`,
    linkUrl: scheduleLink(input.instructionId),
    metadata: { instructionId: input.instructionId },
  });
}

export function notifyTerminalScheduledTradeEnded(
  userId: string,
  input: { instructionId: string; symbol: string },
): void {
  scheduleCreateUserNotification({
    userId,
    type: "TERMINAL_SCHEDULED_TRADE_ENDED",
    title: "Scheduled trade ended",
    body: `${input.symbol} recurring schedule reached its end date.`,
    linkUrl: scheduleLink(input.instructionId),
    metadata: { instructionId: input.instructionId },
  });
}
