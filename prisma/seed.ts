/**
 * Intentional no-op.
 *
 * Production and staging databases must stay fresh — no mock companies,
 * fake users, or test settlement liquidity. Schema comes from migrations only.
 * Alta Bank / Terminal NCC bootstrap (if needed) is done by authorized ops,
 * not by this seed.
 */
if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
  console.error("Refusing to run database seed in production.");
  process.exit(1);
}

console.log("Database seed is disabled. Migrations only — no mock data.");
process.exit(0);
