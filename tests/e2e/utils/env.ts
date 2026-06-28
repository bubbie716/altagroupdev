export function getBaseUrl(): string {
  return process.env.E2E_BASE_URL ?? "http://localhost:3000";
}

export function isProductionEnvironment(): boolean {
  return process.env.NODE_ENV === "production";
}

export function isE2eTestMode(): boolean {
  return process.env.E2E_TEST_MODE === "true";
}

/** Safe to run tests that create/update/delete data. */
export function canRunMutations(): boolean {
  if (isProductionEnvironment()) return false;
  return isE2eTestMode();
}

export function mutationSkipReason(): string {
  if (isProductionEnvironment()) {
    return "Mutation tests skipped: NODE_ENV is production.";
  }
  if (!isE2eTestMode()) {
    return "Mutation tests skipped: set E2E_TEST_MODE=true to enable data-changing flows.";
  }
  return "";
}

export function hasDatabaseUrl(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function hasBlobStorage(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

export function assertSafeTestEnvironment(): void {
  if (isProductionEnvironment()) {
    throw new Error("E2E tests must not run with NODE_ENV=production.");
  }
  if (!hasDatabaseUrl()) {
    throw new Error("E2E tests require DATABASE_URL (local/test database).");
  }
}
