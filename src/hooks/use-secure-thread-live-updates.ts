import { useCallback, useEffect, useRef, useState } from "react";
import {
  isScrollContainerNearBottom,
  mergeThreadMessages,
  scrollScrollContainerToBottom,
  SECURE_THREAD_LIVE_ACTIVE_INTERVAL_MS,
  SECURE_THREAD_LIVE_INACTIVE_INTERVAL_MS,
  type SecureThreadLiveMessage,
} from "@/lib/bank/secure-thread-live";

export type SecureThreadLiveSnapshot<TContext, TMessage extends SecureThreadLiveMessage> = {
  context: TContext;
  messages: TMessage[];
};

export type UseSecureThreadLiveUpdatesOptions<
  TContext,
  TMessage extends SecureThreadLiveMessage,
> = {
  /** Unique key — reset when navigating to a different thread. */
  threadKey: string;
  enabled?: boolean;
  fetchSnapshot: () => Promise<SecureThreadLiveSnapshot<TContext, TMessage>>;
  initialContext: TContext;
  initialMessages: TMessage[];
  onContextChange: (context: TContext) => void;
  onMessagesChange: (messages: TMessage[]) => void;
  /** Current message list — keeps merge baseline in sync after local sends. */
  messages: TMessage[];
  scrollerRef: React.RefObject<HTMLElement | null>;
  /** When true, polling is paused (e.g. message send or attachment upload in progress). */
  isBusyRef?: React.RefObject<boolean>;
  /** After local send, force scroll to latest on next message update. */
  scrollToLatestOnNextUpdateRef?: React.RefObject<boolean>;
};

export type UseSecureThreadLiveUpdatesResult = {
  newMessagesAvailable: boolean;
  scrollToLatest: () => void;
  isPolling: boolean;
  lastSyncedAt: Date | null;
  refreshNow: () => Promise<void>;
};

export function useSecureThreadLiveUpdates<
  TContext,
  TMessage extends SecureThreadLiveMessage,
>({
  threadKey,
  enabled = true,
  fetchSnapshot,
  initialContext,
  initialMessages,
  onContextChange,
  onMessagesChange,
  messages,
  scrollerRef,
  isBusyRef,
  scrollToLatestOnNextUpdateRef,
}: UseSecureThreadLiveUpdatesOptions<TContext, TMessage>): UseSecureThreadLiveUpdatesResult {
  const [newMessagesAvailable, setNewMessagesAvailable] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  const messagesRef = useRef(initialMessages);
  const isNearBottomRef = useRef(true);
  const isVisibleRef = useRef(
    typeof document !== "undefined" ? document.visibilityState === "visible" : true,
  );
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollInFlightRef = useRef(false);
  const threadKeyRef = useRef(threadKey);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    threadKeyRef.current = threadKey;
    onContextChange(initialContext);
    onMessagesChange(initialMessages);
    messagesRef.current = initialMessages;
    setNewMessagesAvailable(false);
    isNearBottomRef.current = true;

    const el = scrollerRef.current;
    if (el) {
      requestAnimationFrame(() => scrollScrollContainerToBottom(el));
    }
  }, [threadKey]); // eslint-disable-line react-hooks/exhaustive-deps -- reset only when thread changes

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const container = el;

    function onScroll() {
      isNearBottomRef.current = isScrollContainerNearBottom(container);
      if (isNearBottomRef.current) {
        setNewMessagesAvailable(false);
      }
    }

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, [scrollerRef, threadKey]);

  const scrollToLatest = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    scrollScrollContainerToBottom(el);
    isNearBottomRef.current = true;
    setNewMessagesAvailable(false);
  }, [scrollerRef]);

  const applySnapshot = useCallback(
    (snapshot: SecureThreadLiveSnapshot<TContext, TMessage>) => {
      if (threadKeyRef.current !== threadKey) return;

      onContextChange(snapshot.context);

      const { merged, hasChanges, hasNewMessages } = mergeThreadMessages(
        messagesRef.current,
        snapshot.messages,
      );

      if (!hasChanges) {
        setLastSyncedAt(new Date());
        return;
      }

      messagesRef.current = merged;
      onMessagesChange(merged);
      setLastSyncedAt(new Date());

      const forceScroll = scrollToLatestOnNextUpdateRef?.current === true;
      if (scrollToLatestOnNextUpdateRef) {
        scrollToLatestOnNextUpdateRef.current = false;
      }

      const el = scrollerRef.current;
      if (!el) return;

      if (forceScroll || isNearBottomRef.current) {
        requestAnimationFrame(() => scrollScrollContainerToBottom(el));
        isNearBottomRef.current = true;
        setNewMessagesAvailable(false);
        return;
      }

      if (hasNewMessages) {
        setNewMessagesAvailable(true);
      }
    },
    [
      onContextChange,
      onMessagesChange,
      scrollerRef,
      scrollToLatestOnNextUpdateRef,
      threadKey,
    ],
  );

  const pollOnce = useCallback(async () => {
    if (!enabled || pollInFlightRef.current) return;
    if (isBusyRef?.current) return;

    pollInFlightRef.current = true;
    setIsPolling(true);
    try {
      const snapshot = await fetchSnapshot();
      applySnapshot(snapshot);
    } catch {
      // Keep last good state — next poll will retry.
    } finally {
      pollInFlightRef.current = false;
      setIsPolling(false);
    }
  }, [applySnapshot, enabled, fetchSnapshot, isBusyRef]);

  const refreshNow = useCallback(async () => {
    await pollOnce();
  }, [pollOnce]);

  const scheduleNextPoll = useCallback(
    (delayMs: number) => {
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
      }
      pollTimerRef.current = setTimeout(async () => {
        await pollOnce();
        if (!enabled) return;
        const nextDelay =
          isVisibleRef.current
            ? SECURE_THREAD_LIVE_ACTIVE_INTERVAL_MS
            : SECURE_THREAD_LIVE_INACTIVE_INTERVAL_MS;
        scheduleNextPoll(nextDelay);
      }, delayMs);
    },
    [enabled, pollOnce],
  );

  useEffect(() => {
    if (!enabled) {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      return;
    }

    void pollOnce();
    scheduleNextPoll(SECURE_THREAD_LIVE_ACTIVE_INTERVAL_MS);

    function onVisibilityChange() {
      const visible = document.visibilityState === "visible";
      isVisibleRef.current = visible;

      if (visible) {
        void pollOnce();
        scheduleNextPoll(SECURE_THREAD_LIVE_ACTIVE_INTERVAL_MS);
      } else {
        scheduleNextPoll(SECURE_THREAD_LIVE_INACTIVE_INTERVAL_MS);
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, [enabled, pollOnce, scheduleNextPoll, threadKey]);

  return {
    newMessagesAvailable,
    scrollToLatest,
    isPolling,
    lastSyncedAt,
    refreshNow,
  };
}
