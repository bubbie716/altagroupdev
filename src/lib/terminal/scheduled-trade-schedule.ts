import type { TerminalScheduledTradeFrequency } from "@prisma/client";

/** All schedule timestamps are stored and interpreted as UTC. */
export const TERMINAL_SCHEDULED_TRADE_TIME_ZONE_POLICY = "UTC" as const;

export const TERMINAL_SCHEDULED_TRADE_UTC_HELP =
  "Schedule times use UTC. Your local time may differ — confirm the start time before saving.";

const MS_PER_DAY = 86_400_000;

/** Month-add with day clamp (Jan 31 + 1 month → Feb 28/29). Copied from commercial billing to avoid cross-domain coupling. */
export function addUtcMonths(date: Date, months = 1): Date {
  if (!Number.isFinite(months)) {
    throw new Error("BAD_REQUEST:Month offset must be a finite number.");
  }

  const sourceYear = date.getUTCFullYear();
  const sourceMonth = date.getUTCMonth();
  const sourceDay = date.getUTCDate();
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const seconds = date.getUTCSeconds();
  const milliseconds = date.getUTCMilliseconds();

  const absoluteMonth = sourceYear * 12 + sourceMonth + Math.trunc(months);
  const targetYear = Math.floor(absoluteMonth / 12);
  const targetMonth = ((absoluteMonth % 12) + 12) % 12;
  const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const targetDay = Math.min(sourceDay, daysInTargetMonth);

  return new Date(
    Date.UTC(targetYear, targetMonth, targetDay, hours, minutes, seconds, milliseconds),
  );
}

export function computeNextRunAt(
  from: Date,
  frequency: TerminalScheduledTradeFrequency,
): Date {
  switch (frequency) {
    case "WEEKLY":
      return new Date(from.getTime() + 7 * MS_PER_DAY);
    case "BIWEEKLY":
      return new Date(from.getTime() + 14 * MS_PER_DAY);
    case "MONTHLY":
      return addUtcMonths(from, 1);
    default: {
      const _exhaustive: never = frequency;
      throw new Error(`Unsupported frequency: ${_exhaustive}`);
    }
  }
}

export function normalizeStartAtMustBeFuture(startAt: Date, now: Date): Date {
  if (!(startAt instanceof Date) || Number.isNaN(startAt.getTime())) {
    throw new Error("BAD_REQUEST:Enter a valid start date and time.");
  }
  if (startAt.getTime() <= now.getTime()) {
    throw new Error("BAD_REQUEST:Start time must be in the future.");
  }
  return startAt;
}

export function isPastEndDate(endAt: Date | null | undefined, candidate: Date): boolean {
  if (!endAt) return false;
  return candidate.getTime() > endAt.getTime();
}

export function calculateResumeNextRunAt(
  instruction: {
    scheduleType: "ONE_TIME" | "RECURRING";
    startAt: Date;
    nextRunAt: Date | null;
    endAt: Date | null;
    frequency: TerminalScheduledTradeFrequency | null;
  },
  now: Date,
): Date | null {
  if (instruction.scheduleType === "ONE_TIME") {
    return instruction.startAt.getTime() > now.getTime() ? instruction.startAt : null;
  }
  if (!instruction.frequency) return null;

  let candidate = instruction.nextRunAt ?? instruction.startAt;
  while (candidate.getTime() <= now.getTime()) {
    if (isPastEndDate(instruction.endAt, candidate)) return null;
    candidate = computeNextRunAt(candidate, instruction.frequency);
  }
  if (isPastEndDate(instruction.endAt, candidate)) return null;
  return candidate;
}

export function buildOccurrenceIdempotencyKey(occurrenceId: string): string {
  return `scheduled-trade-occurrence:${occurrenceId}`;
}

export function buildPredeterminedOccurrenceIdempotencyKey(
  instructionId: string,
  scheduledRunAt: Date,
): string {
  return `scheduled-trade-occurrence:${instructionId}:${scheduledRunAt.toISOString()}`;
}
