import { Prisma } from "@prisma/client";

/** Safe Decimal ↔ domain number conversion at the application boundary. */

export function decimalToNumber(value: Prisma.Decimal | number | string | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return value.toNumber();
}

export function decimalToNumberOrNull(
  value: Prisma.Decimal | number | string | null | undefined,
): number | null {
  if (value == null) return null;
  return decimalToNumber(value);
}

export function toDecimal(value: number | string | Prisma.Decimal): Prisma.Decimal {
  if (value instanceof Prisma.Decimal) return value;
  return new Prisma.Decimal(value);
}

/** Serialize money for JSON responses without floating binary artifacts when possible. */
export function serializeMoney(value: Prisma.Decimal | number | string): number {
  const n = decimalToNumber(value);
  return Number(n.toFixed(2));
}

export function serializeQuantity(value: Prisma.Decimal | number | string): number {
  const n = decimalToNumber(value);
  return Number(n.toFixed(8));
}

export function serializePrice(value: Prisma.Decimal | number | string | null | undefined): number | null {
  if (value == null) return null;
  const n = decimalToNumber(value);
  return Number(n.toFixed(6));
}

export function normalizeTerminalSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}
