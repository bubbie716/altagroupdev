import type { PaymentFrequencyCode } from "@/lib/bank/business-banking-types";
import { DEFAULT_SCHEDULED_TIME_ET, parseBankScheduledDateTime, wallClockInBankTz } from "@/lib/scheduled-datetime";

export const WEEKDAY_PAY_DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export const MONTHLY_PAY_DAYS = ["first_of_month", "last_of_month", "15th"] as const;

export const QUARTERLY_PAY_DAYS = ["first_of_quarter", "last_of_quarter"] as const;

export type WeekdayPayDay = (typeof WEEKDAY_PAY_DAYS)[number];
export type MonthlyPayDay = (typeof MONTHLY_PAY_DAYS)[number];
export type QuarterlyPayDay = (typeof QUARTERLY_PAY_DAYS)[number];
export type PayDayCode = WeekdayPayDay | MonthlyPayDay | QuarterlyPayDay;

const WEEKDAY_LABELS: Record<WeekdayPayDay, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

const MONTHLY_LABELS: Record<MonthlyPayDay, string> = {
  first_of_month: "First of the month",
  last_of_month: "Last day of the month",
  "15th": "15th of the month",
};

const QUARTERLY_LABELS: Record<QuarterlyPayDay, string> = {
  first_of_quarter: "First day of the quarter",
  last_of_quarter: "Last day of the quarter",
};

const WEEKDAY_TO_JS: Record<WeekdayPayDay, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function toDateKey(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function atDefaultTime(dateKey: string): Date {
  return parseBankScheduledDateTime(dateKey, DEFAULT_SCHEDULED_TIME_ET);
}

export function getDefaultPayDay(frequency: PaymentFrequencyCode): PayDayCode {
  switch (frequency) {
    case "weekly":
    case "biweekly":
      return "friday";
    case "monthly":
      return "first_of_month";
    case "quarterly":
      return "first_of_quarter";
  }
}

export function getPayDayOptions(
  frequency: PaymentFrequencyCode,
): { value: PayDayCode; label: string }[] {
  switch (frequency) {
    case "weekly":
    case "biweekly":
      return WEEKDAY_PAY_DAYS.map((value) => ({ value, label: WEEKDAY_LABELS[value] }));
    case "monthly":
      return MONTHLY_PAY_DAYS.map((value) => ({ value, label: MONTHLY_LABELS[value] }));
    case "quarterly":
      return QUARTERLY_PAY_DAYS.map((value) => ({ value, label: QUARTERLY_LABELS[value] }));
  }
}

export function formatPayDayLabel(payDay: string, frequency: PaymentFrequencyCode): string {
  if ((WEEKDAY_PAY_DAYS as readonly string[]).includes(payDay)) {
    return WEEKDAY_LABELS[payDay as WeekdayPayDay];
  }
  if ((MONTHLY_PAY_DAYS as readonly string[]).includes(payDay)) {
    return MONTHLY_LABELS[payDay as MonthlyPayDay];
  }
  if ((QUARTERLY_PAY_DAYS as readonly string[]).includes(payDay)) {
    return QUARTERLY_LABELS[payDay as QuarterlyPayDay];
  }
  return payDay;
}

export function isValidPayDay(frequency: PaymentFrequencyCode, payDay: string): payDay is PayDayCode {
  switch (frequency) {
    case "weekly":
    case "biweekly":
      return (WEEKDAY_PAY_DAYS as readonly string[]).includes(payDay);
    case "monthly":
      return (MONTHLY_PAY_DAYS as readonly string[]).includes(payDay);
    case "quarterly":
      return (QUARTERLY_PAY_DAYS as readonly string[]).includes(payDay);
  }
}

function nextWeeklyDate(weekday: WeekdayPayDay, from: Date, strictlyAfter: boolean): Date {
  const target = WEEKDAY_TO_JS[weekday];
  const wall = wallClockInBankTz(from);
  let { year, month, day } = wall;

  for (let i = 0; i < 8; i += 1) {
    const candidateKey = toDateKey(year, month, day);
    const candidate = atDefaultTime(candidateKey);
    const candidateWall = wallClockInBankTz(candidate);
    const jsDay = new Date(Date.UTC(candidateWall.year, candidateWall.month - 1, candidateWall.day)).getUTCDay();

    if (jsDay === target) {
      if (!strictlyAfter || candidate.getTime() > from.getTime()) {
        return candidate;
      }
    }

    day += 1;
    const rolled = new Date(Date.UTC(year, month - 1, day));
    year = rolled.getUTCFullYear();
    month = rolled.getUTCMonth() + 1;
    day = rolled.getUTCDate();
  }

  return atDefaultTime(toDateKey(wall.year, wall.month, wall.day + 7));
}

function nextBiweeklyDate(
  weekday: WeekdayPayDay,
  anchor: Date,
  from: Date,
  strictlyAfter: boolean,
): Date {
  let candidate = nextWeeklyDate(weekday, anchor, false);

  while (strictlyAfter ? candidate.getTime() <= from.getTime() : candidate.getTime() < from.getTime()) {
    const wall = wallClockInBankTz(candidate);
    const rolled = new Date(Date.UTC(wall.year, wall.month - 1, wall.day + 14));
    candidate = nextWeeklyDate(
      weekday,
      atDefaultTime(toDateKey(rolled.getUTCFullYear(), rolled.getUTCMonth() + 1, rolled.getUTCDate())),
      false,
    );
  }

  return candidate;
}

function nextMonthlyDate(payDay: MonthlyPayDay, from: Date, strictlyAfter: boolean): Date {
  const wall = wallClockInBankTz(from);
  let year = wall.year;
  let month = wall.month;

  for (let attempt = 0; attempt < 24; attempt += 1) {
    let day: number;
    if (payDay === "first_of_month") {
      day = 1;
    } else if (payDay === "last_of_month") {
      day = lastDayOfMonth(year, month);
    } else {
      day = 15;
    }

    const candidate = atDefaultTime(toDateKey(year, month, day));
    if (!strictlyAfter || candidate.getTime() > from.getTime()) {
      return candidate;
    }

    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return atDefaultTime(toDateKey(year, month, 1));
}

function nextQuarterlyDate(payDay: QuarterlyPayDay, from: Date, strictlyAfter: boolean): Date {
  const quarters = [
    { firstMonth: 1, lastMonth: 3 },
    { firstMonth: 4, lastMonth: 6 },
    { firstMonth: 7, lastMonth: 9 },
    { firstMonth: 10, lastMonth: 12 },
  ];
  const wall = wallClockInBankTz(from);

  for (let year = wall.year; year <= wall.year + 2; year += 1) {
    for (const quarter of quarters) {
      const month = payDay === "first_of_quarter" ? quarter.firstMonth : quarter.lastMonth;
      const day = payDay === "first_of_quarter" ? 1 : lastDayOfMonth(year, month);
      const candidate = atDefaultTime(toDateKey(year, month, day));
      if (!strictlyAfter || candidate.getTime() > from.getTime()) {
        return candidate;
      }
    }
  }

  return atDefaultTime(toDateKey(wall.year, 10, 1));
}

export function computeNextPayDate(
  frequency: PaymentFrequencyCode,
  payDay: PayDayCode,
  from: Date,
  strictlyAfter = false,
  anchor?: Date | null,
): Date {
  switch (frequency) {
    case "weekly":
      return nextWeeklyDate(payDay as WeekdayPayDay, from, strictlyAfter);
    case "biweekly":
      return nextBiweeklyDate(payDay as WeekdayPayDay, anchor ?? from, from, strictlyAfter);
    case "monthly":
      return nextMonthlyDate(payDay as MonthlyPayDay, from, strictlyAfter);
    case "quarterly":
      return nextQuarterlyDate(payDay as QuarterlyPayDay, from, strictlyAfter);
  }
}
