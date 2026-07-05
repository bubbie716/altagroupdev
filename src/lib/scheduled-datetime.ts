export const BANK_TIMEZONE = "America/New_York";

/** Default run time when only a date is provided (9:00 AM Eastern). */
export const DEFAULT_SCHEDULED_TIME_ET = "09:00";

type WallClock = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function toDateKey(w: Pick<WallClock, "year" | "month" | "day">): string {
  return `${w.year}-${pad2(w.month)}-${pad2(w.day)}`;
}

function toTimeKey(w: Pick<WallClock, "hour" | "minute">): string {
  return `${pad2(w.hour)}:${pad2(w.minute)}`;
}

export function wallClockInBankTz(instant: Date): WallClock {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BANK_TIMEZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(instant);

  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour") % 24,
    minute: read("minute"),
  };
}

/** Convert a civil date + wall-clock time in Eastern to a UTC `Date`. */
export function parseBankScheduledDateTime(datePart: string, timePart = DEFAULT_SCHEDULED_TIME_ET): Date {
  const dateMatch = datePart.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const timeMatch = timePart.trim().match(/^(\d{2}):(\d{2})$/);
  if (!dateMatch || !timeMatch) {
    throw new Error("BAD_REQUEST:Invalid scheduled date or time.");
  }

  const desired: WallClock = {
    year: Number(dateMatch[1]),
    month: Number(dateMatch[2]),
    day: Number(dateMatch[3]),
    hour: Number(timeMatch[1]),
    minute: Number(timeMatch[2]),
  };

  if (
    !Number.isFinite(desired.year) ||
    !Number.isFinite(desired.month) ||
    !Number.isFinite(desired.day) ||
    desired.hour < 0 ||
    desired.hour > 23 ||
    desired.minute < 0 ||
    desired.minute > 59
  ) {
    throw new Error("BAD_REQUEST:Invalid scheduled date or time.");
  }

  let utcMs = Date.UTC(desired.year, desired.month - 1, desired.day, desired.hour + 5, desired.minute);

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const got = wallClockInBankTz(new Date(utcMs));
    const diffMinutes =
      (desired.year - got.year) * 525_600 +
      (desired.month - got.month) * 43_200 +
      (desired.day - got.day) * 1_440 +
      (desired.hour - got.hour) * 60 +
      (desired.minute - got.minute);

    if (diffMinutes === 0) {
      return new Date(utcMs);
    }

    utcMs += diffMinutes * 60_000;
  }

  throw new Error("BAD_REQUEST:Could not resolve scheduled time in Eastern Time.");
}

export function resolveScheduledInputDateTime(
  scheduledDate?: string,
  scheduledTime?: string,
): Date | null {
  if (!scheduledDate?.trim()) return null;

  const trimmed = scheduledDate.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return parseBankScheduledDateTime(trimmed, scheduledTime?.trim() || DEFAULT_SCHEDULED_TIME_ET);
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("BAD_REQUEST:Invalid scheduled date or time.");
  }
  return parsed;
}

export function calculateNextRunDate(
  frequency: "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY",
  from: Date,
): Date {
  const wall = wallClockInBankTz(from);
  let { year, month, day } = wall;
  const { hour, minute } = wall;

  switch (frequency) {
    case "WEEKLY":
      day += 7;
      break;
    case "BIWEEKLY":
      day += 14;
      break;
    case "MONTHLY":
      month += 1;
      break;
    case "QUARTERLY":
      month += 3;
      break;
    case "YEARLY":
      year += 1;
      break;
  }

  const rolled = new Date(Date.UTC(year, month - 1, day));
  return parseBankScheduledDateTime(
    toDateKey({
      year: rolled.getUTCFullYear(),
      month: rolled.getUTCMonth() + 1,
      day: rolled.getUTCDate(),
    }),
    toTimeKey({ hour, minute }),
  );
}

export function formatScheduledTimeForInput(iso: string | Date | null | undefined): string {
  if (!iso) return DEFAULT_SCHEDULED_TIME_ET;
  const instant = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(instant.getTime())) return DEFAULT_SCHEDULED_TIME_ET;
  const wall = wallClockInBankTz(instant);
  return toTimeKey(wall);
}

export function formatScheduledDateForInput(iso: string | Date | null | undefined): string {
  if (!iso) return "";
  const instant = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(instant.getTime())) return "";
  const wall = wallClockInBankTz(instant);
  return toDateKey(wall);
}
