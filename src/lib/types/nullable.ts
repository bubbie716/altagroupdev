/** Coerce Prisma nullable strings for optional API fields. */
export function undefinedIfNull<T>(value: T | null | undefined): T | undefined {
  return value ?? undefined;
}
