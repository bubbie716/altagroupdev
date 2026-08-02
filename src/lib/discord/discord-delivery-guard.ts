/**
 * Fail-closed Discord live-delivery guard for unit/integration tests.
 *
 * `tsx --test` does not set NODE_ENV=test, so callers must not rely on that alone.
 * Test scripts also preload this module via `forceDisableDiscordLiveDelivery()`.
 */

const LIVE_DELIVERY_DISABLED_MARKER = Symbol.for("alta.discord.liveDeliveryDisabled");

type GlobalWithMarker = typeof globalThis & {
  [LIVE_DELIVERY_DISABLED_MARKER]?: boolean;
};

function globalMarker(): GlobalWithMarker {
  return globalThis as GlobalWithMarker;
}

function isTruthyFlag(raw: string | undefined): boolean {
  const value = raw?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

/** True when argv/execArgv looks like `node --test` / `tsx --test`. */
export function isNodeTestRunnerArgv(
  argv: readonly string[] = process.argv,
  execArgv: readonly string[] = process.execArgv,
): boolean {
  if (argv.includes("--test")) return true;
  // Child workers under --test-isolation=process often lose bare `--test` but keep
  // flags like `--test-isolation=process`, `--test-concurrency=…`, etc.
  if (
    execArgv.some(
      (arg) => arg === "--test" || arg.startsWith("--test=") || arg.startsWith("--test-"),
    )
  ) {
    return true;
  }
  return false;
}

/** Node's built-in test runner sets NODE_TEST_CONTEXT in worker/child processes. */
export function isNodeTestContextEnv(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return Boolean(env.NODE_TEST_CONTEXT?.trim());
}

function isNpmTestLifecycle(): boolean {
  const event = process.env.npm_lifecycle_event?.trim();
  if (!event) return false;
  return event === "test" || event.startsWith("test:") || event.includes(":test");
}

function isUiLabMode(): boolean {
  return isTruthyFlag(process.env.VITE_UI_LAB_MODE);
}

/** Explicit test-only flag (never allowed in production). */
export function isDiscordTestModeFlag(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return isTruthyFlag(env.DISCORD_TEST_MODE);
}

/**
 * Production must fail closed if DISCORD_TEST_MODE is set.
 * Throws so misconfigured deploys cannot silently skip Discord delivery.
 */
export function assertDiscordTestModeSafeForRuntime(
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (env.NODE_ENV === "production" && isDiscordTestModeFlag(env)) {
    throw new Error(
      "DISCORD_TEST_MODE must not be set when NODE_ENV=production (fail closed)",
    );
  }
}

/**
 * Force-disable live Discord delivery for the current process.
 * Safe to call multiple times (idempotent).
 */
export function forceDisableDiscordLiveDelivery(): void {
  globalMarker()[LIVE_DELIVERY_DISABLED_MARKER] = true;
  process.env.DISCORD_LIVE_DELIVERY_DISABLED = "1";
  process.env.STAFF_AUDIT_DISCORD_DISABLED = "1";
  process.env.DISCORD_TEST_MODE = "1";
  if (!process.env.NODE_ENV?.trim()) {
    process.env.NODE_ENV = "test";
  }
}

/**
 * True in test runners / when live Discord is explicitly disabled for the process.
 * Does not include staff-audit-only ops flags.
 */
export function isDiscordTestRuntime(): boolean {
  assertDiscordTestModeSafeForRuntime();
  if (globalMarker()[LIVE_DELIVERY_DISABLED_MARKER] === true) return true;
  if (process.env.DISCORD_LIVE_DELIVERY_DISABLED === "1") return true;
  if (isDiscordTestModeFlag()) return true;
  if (process.env.NODE_ENV === "test") return true;
  if (process.env.VITEST === "true") return true;
  if (isUiLabMode()) return true;
  // Primary signal for `tsx --test` / `node --test` (NODE_ENV is often unset).
  if (isNodeTestContextEnv()) return true;
  if (isNodeTestRunnerArgv()) return true;
  if (isNpmTestLifecycle()) return true;
  return false;
}

/**
 * Whether any automated Discord REST/bot delivery must be skipped.
 * Includes test runtime plus the staff-audit disable flag (fail closed in tests).
 */
export function isDiscordLiveDeliveryDisabled(): boolean {
  assertDiscordTestModeSafeForRuntime();
  if (isDiscordTestRuntime()) return true;
  if (process.env.STAFF_AUDIT_DISCORD_DISABLED === "1") return true;
  return false;
}
