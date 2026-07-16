import { createHash, randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";

export const NCC_DEFAULT_CURRENCY = "FLR";

/** Serialize Decimal (or number) for API/UI only — never for authoritative math. */
export function decimalToNumber(value: { toString(): string } | number): number {
  return typeof value === "number" ? value : Number(value.toString());
}

export function toMoneyDecimal(amount: number | string | Prisma.Decimal): Prisma.Decimal {
  const d =
    amount instanceof Prisma.Decimal
      ? amount
      : typeof amount === "string"
        ? new Prisma.Decimal(amount)
        : new Prisma.Decimal(amount.toFixed(2));
  if (d.lte(0)) throw new Error("INVALID_AMOUNT");
  return d.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export function assertPositiveMoneyAmount(amount: number | string | Prisma.Decimal): Prisma.Decimal {
  const d = toMoneyDecimal(amount);
  if (d.lte(0)) throw new Error("INVALID_AMOUNT");
  return d;
}

export function moneyAdd(a: Prisma.Decimal, b: Prisma.Decimal): Prisma.Decimal {
  return a.add(b).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export function moneySub(a: Prisma.Decimal, b: Prisma.Decimal): Prisma.Decimal {
  return a.sub(b).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export function moneyEq(a: Prisma.Decimal, b: Prisma.Decimal): boolean {
  return a.toDecimalPlaces(2).eq(b.toDecimalPlaces(2));
}

export function moneyLt(a: Prisma.Decimal, b: Prisma.Decimal): boolean {
  return a.lt(b);
}

export function moneyGte(a: Prisma.Decimal, b: Prisma.Decimal): boolean {
  return a.gte(b);
}

export function asDecimal(value: { toString(): string } | Prisma.Decimal | number | string): Prisma.Decimal {
  if (value instanceof Prisma.Decimal) return value;
  if (typeof value === "number") return new Prisma.Decimal(value.toFixed(2));
  return new Prisma.Decimal(value.toString());
}

export function hashSettlementPayload(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function generateSettlementPublicReference(): string {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const suffix = randomBytes(3).toString("hex").toUpperCase();
  return `NCC-${stamp}-${suffix}`;
}

/** Controlled NCC routing number allocation — not UI-generated. */
export function allocateRoutingNumberCandidate(prefixDigits: string, sequence: number): string {
  const prefix = prefixDigits.replace(/\D/g, "").padStart(3, "0").slice(0, 3);
  const body = String(sequence).padStart(6, "0").slice(-6);
  return `${prefix}${body}`;
}

export function slugifyInstitutionName(input: string): string {
  const slug = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || `institution-${randomBytes(3).toString("hex")}`;
}
