/** Polling intervals for Secure Thread live updates. */
export const SECURE_THREAD_LIVE_ACTIVE_INTERVAL_MS = 8_000;
export const SECURE_THREAD_LIVE_INACTIVE_INTERVAL_MS = 60_000;

/** Distance from bottom (px) treated as "at bottom" for auto-scroll. */
export const SECURE_THREAD_SCROLL_BOTTOM_THRESHOLD_PX = 80;

export type SecureThreadLiveMessage = {
  id: string;
  createdAt?: string;
};

export type MergeThreadMessagesResult<T extends SecureThreadLiveMessage> = {
  merged: T[];
  hasChanges: boolean;
  hasNewMessages: boolean;
  removedCount: number;
};

/** Merge server messages into local state — server list is source of truth (handles deletes). */
export function mergeThreadMessages<T extends SecureThreadLiveMessage>(
  current: T[],
  incoming: T[],
): MergeThreadMessagesResult<T> {
  const currentIds = new Set(current.map((message) => message.id));
  const incomingIds = new Set(incoming.map((message) => message.id));

  const hasNewMessages = incoming.some((message) => !currentIds.has(message.id));
  const removedCount = current.filter((message) => !incomingIds.has(message.id)).length;

  let hasChanges = hasNewMessages || removedCount > 0 || current.length !== incoming.length;
  if (!hasChanges) {
    const incomingById = new Map(incoming.map((message) => [message.id, message]));
    hasChanges = current.some((message) => {
      const next = incomingById.get(message.id);
      return next != null && JSON.stringify(next) !== JSON.stringify(message);
    });
  }

  return {
    merged: incoming,
    hasChanges,
    hasNewMessages,
    removedCount,
  };
}

export function isScrollContainerNearBottom(
  element: HTMLElement,
  thresholdPx = SECURE_THREAD_SCROLL_BOTTOM_THRESHOLD_PX,
): boolean {
  return element.scrollHeight - element.scrollTop - element.clientHeight <= thresholdPx;
}

export function scrollScrollContainerToBottom(element: HTMLElement): void {
  element.scrollTop = element.scrollHeight;
}
