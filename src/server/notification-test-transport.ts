/**
 * Test-safe customer notification transport.
 *
 * Production uses Discord DM delivery. Tests must never contact Discord, bots,
 * or production webhooks. This module fails closed when a live delivery path is
 * attempted under the test runtime marker.
 */

import { isDiscordTestRuntime } from "@/lib/discord/discord-delivery-guard";

export type RecordedNotificationMessage = {
  notificationId: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  linkUrl?: string;
  linkLabel?: string;
  recordedAt: string;
};

const recordedMessages: RecordedNotificationMessage[] = [];

/** Explicit runtime marker — do not rely only on inherited env vars. */
const TEST_RUNTIME_MARKER = Symbol.for("alta.notification.testRuntime");

type GlobalWithMarker = typeof globalThis & {
  [TEST_RUNTIME_MARKER]?: boolean;
  __ALTA_FORCE_LIVE_NOTIFICATION_TRANSPORT__?: boolean;
};

function globalMarker(): GlobalWithMarker {
  return globalThis as GlobalWithMarker;
}

/** Call from test setup (or rely on NODE_ENV/VITEST auto-detect). */
export function enableTestNotificationTransport(): void {
  globalMarker()[TEST_RUNTIME_MARKER] = true;
}

export function disableTestNotificationTransport(): void {
  delete globalMarker()[TEST_RUNTIME_MARKER];
}

export function isTestNotificationTransportActive(): boolean {
  const g = globalMarker();
  if (g[TEST_RUNTIME_MARKER] === true) return true;
  // Fail closed for common test runners even if NODE_ENV was not set (tsx --test).
  return isDiscordTestRuntime();
}

export function clearRecordedNotificationMessages(): void {
  recordedMessages.length = 0;
}

export function getRecordedNotificationMessages(): readonly RecordedNotificationMessage[] {
  return [...recordedMessages];
}

export function recordTestNotificationMessage(
  message: Omit<RecordedNotificationMessage, "recordedAt">,
): void {
  recordedMessages.push({
    ...message,
    recordedAt: new Date().toISOString(),
  });
}

/**
 * Throws if code under test tries to invoke the live Discord delivery implementation.
 * Production callers never hit this when the test transport is inactive.
 */
export function assertLiveNotificationTransportAllowed(context: string): void {
  if (!isTestNotificationTransportActive()) return;
  if (globalMarker().__ALTA_FORCE_LIVE_NOTIFICATION_TRANSPORT__ === true) return;
  throw new Error(
    `LIVE_NOTIFICATION_TRANSPORT_BLOCKED:${context} — commercial tests must use the in-memory test notification transport`,
  );
}
