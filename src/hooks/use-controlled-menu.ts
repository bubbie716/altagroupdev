import { useCallback, useEffect, useRef, useState } from "react";
import { closeThenRun } from "@/lib/ui/close-then-run";
import { registerTransientOverlay } from "@/lib/ui/transient-overlay-registry";

/**
 * Controlled open state for dropdown menus that navigate or mutate on pick.
 * Closes synchronously (flushSync), then runs the action after paint.
 */
export function useControlledMenu(defaultOpen = false) {
  const [open, setOpen] = useState(defaultOpen);
  const navigatingRef = useRef(false);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => registerTransientOverlay(close), [close]);

  const runAfterClose = useCallback(
    (action: () => void) => {
      if (navigatingRef.current) return;
      navigatingRef.current = true;
      closeThenRun(close, () => {
        try {
          action();
        } finally {
          // Keep navigating flag briefly so onCloseAutoFocus can suppress focus restore.
          queueMicrotask(() => {
            navigatingRef.current = false;
          });
        }
      });
    },
    [close],
  );

  const onOpenChange = useCallback(
    (next: boolean) => {
      // Ignore reopen while a navigation dismiss is in flight.
      if (!next) {
        setOpen(false);
        return;
      }
      if (navigatingRef.current) return;
      setOpen(true);
    },
    [],
  );

  return {
    open,
    setOpen: onOpenChange,
    close,
    runAfterClose,
    isNavigating: () => navigatingRef.current,
  };
}
