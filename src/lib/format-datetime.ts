import { wallClockInBankTz } from "@/lib/scheduled-datetime";

export const NY_TIMEZONE = "America/New_York";

const ACTIVITY_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  timeZone: NY_TIMEZONE,
  month: "short",
  day: "numeric",
  year: "numeric",
};

const ACTIVITY_TIME_FORMAT: Intl.DateTimeFormatOptions = {
  timeZone: NY_TIMEZONE,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
};

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function parseDisplayDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value.trim());
}

function formatCalendarDateInNewYork(year: number, month: number, day: number): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: NY_TIMEZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day, 12, 0, 0)));
}

function formatCalendarDateInNewYorkWithOptions(
  year: number,
  month: number,
  day: number,
  options: Intl.DateTimeFormatOptions,
  locale = "en-US",
): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: NY_TIMEZONE,
    ...options,
  }).format(new Date(Date.UTC(year, month - 1, day, 12, 0, 0)));
}

/** Format any instant or calendar date for display in America/New_York. */
export function formatInNewYork(
  value: string | Date,
  options: Intl.DateTimeFormatOptions,
  locale = "en-US",
): string {
  if (typeof value === "string") {
    const trimmed = value.trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [year, month, day] = trimmed.split("-").map(Number);
      return formatCalendarDateInNewYorkWithOptions(year, month, day, options, locale);
    }
  }

  const date = parseDisplayDate(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat(locale, {
    timeZone: NY_TIMEZONE,
    ...options,
  }).format(date);
}

/** Format the UTC calendar date embedded in an ISO timestamp (for date-only business fields). */
export function formatUtcCalendarDate(value: string | Date): string {
  const date = parseDisplayDate(value);
  if (Number.isNaN(date.getTime())) return "—";
  return formatCalendarDateInNewYork(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
  );
}

/** Calendar due date in America/New_York. */
export function formatDueDate(value: string | Date): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [year, month, day] = trimmed.split("-").map(Number);
      return formatCalendarDateInNewYork(year, month, day);
    }
  }

  const date = parseDisplayDate(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-US", ACTIVITY_DATE_FORMAT).format(date);
}

/** Long-form calendar date in America/New_York. */
export function formatActivityDateLong(value: string | Date): string {
  return formatInNewYork(value, { month: "long", day: "numeric", year: "numeric" });
}

/** Date range in America/New_York. */
export function formatActivityDateRange(
  start: string | Date,
  end: string | Date,
  options: Intl.DateTimeFormatOptions = ACTIVITY_DATE_FORMAT,
): string {
  return `${formatInNewYork(start, options)} – ${formatInNewYork(end, options)}`;
}

/** Time of day in America/New_York. */
export function formatActivityTime(value: string | Date, withZone = false): string {
  const date = parseDisplayDate(value);
  if (Number.isNaN(date.getTime())) return "—";

  const time = new Intl.DateTimeFormat("en-US", ACTIVITY_TIME_FORMAT).format(date);
  return withZone ? `${time} ET` : time;
}

/** Month and year in America/New_York. */
export function formatMonthYear(value: string | Date): string {
  return formatInNewYork(value, { month: "long", year: "numeric" });
}

/** Weekday + short date in America/New_York. */
export function formatWeekdayDate(value: string | Date): string {
  return formatInNewYork(value, { weekday: "short", month: "short", day: "numeric" });
}

/** Compact date + time in America/New_York. */
export function formatShortDateTime(value: string | Date): string {
  return formatInNewYork(value, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getDateKeyInNewYork(value: string | Date): string {
  const wall = wallClockInBankTz(parseDisplayDate(value));
  return `${wall.year}-${pad2(wall.month)}-${pad2(wall.day)}`;
}

export function getHourInNewYork(now = new Date()): number {
  return wallClockInBankTz(now).hour % 24;
}

export function isSameCalendarDayInNewYork(a: Date, b: Date): boolean {
  return getDateKeyInNewYork(a) === getDateKeyInNewYork(b);
}

export function isYesterdayInNewYork(date: Date, now = new Date()): boolean {
  const nowWall = wallClockInBankTz(now);
  const yesterdayKey = getDateKeyInNewYork(
    new Date(Date.UTC(nowWall.year, nowWall.month - 1, nowWall.day - 1, 12, 0, 0)),
  );
  return getDateKeyInNewYork(date) === yesterdayKey;
}

/** Today, Yesterday, or weekday date label in America/New_York. */
export function formatRelativeDayLabel(value: string | Date, now = new Date()): string {
  const date = parseDisplayDate(value);
  if (Number.isNaN(date.getTime())) return "—";
  if (isSameCalendarDayInNewYork(date, now)) return "Today";
  if (isYesterdayInNewYork(date, now)) return "Yesterday";
  return formatWeekdayDate(date);
}

/** Activity tables: date and time in America/New_York (ET/EDT). */
export function formatActivityDateTime(value: string | Date): string {
  if (typeof value === "string") {
    const trimmed = value.trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [year, month, day] = trimmed.split("-").map(Number);
      return `${formatCalendarDateInNewYork(year, month, day)}, 12:00 PM ET`;
    }

    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(trimmed)) {
      const [datePart, timePart] = trimmed.split(" ");
      const [year, month, day] = datePart.split("-").map(Number);
      const [hour24, minute] = timePart.split(":").map(Number);
      const hour12 = hour24 % 12 || 12;
      const dayPeriod = hour24 >= 12 ? "PM" : "AM";
      return `${formatCalendarDateInNewYork(year, month, day)}, ${hour12}:${minute.toString().padStart(2, "0")} ${dayPeriod} ET`;
    }
  }

  const date = parseDisplayDate(value);
  if (Number.isNaN(date.getTime())) return typeof value === "string" ? value : "—";

  const datePart = new Intl.DateTimeFormat("en-US", ACTIVITY_DATE_FORMAT).format(date);
  const timePart = new Intl.DateTimeFormat("en-US", ACTIVITY_TIME_FORMAT).format(date);
  return `${datePart}, ${timePart} ET`;
}
