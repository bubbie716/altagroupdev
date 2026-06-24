const NY_TIMEZONE = "America/New_York";

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

function formatCalendarDateInNewYork(year: number, month: number, day: number): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: NY_TIMEZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day, 12, 0, 0)));
}

/** Calendar due date in America/New_York. */
export function formatDueDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: NY_TIMEZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
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

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return typeof value === "string" ? value : "—";

  const datePart = new Intl.DateTimeFormat("en-US", ACTIVITY_DATE_FORMAT).format(date);
  const timePart = new Intl.DateTimeFormat("en-US", ACTIVITY_TIME_FORMAT).format(date);
  return `${datePart}, ${timePart} ET`;
}
