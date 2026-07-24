import { useCallback, useRef, useState } from "react";
import { closeThenRun } from "@/lib/ui/close-then-run";

/**
 * Controlled open state for dropdown/select-style menus that navigate on pick.
 * Closes immediately, then runs the action on the next microtask.
 */
export function useControlledMenu(defaultOpen = false) {
  const [open, setOpen] = useState(defaultOpen);
  const navigatingRef = useRef(false);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  const runAfterClose = useCallback(
    (action: () => void) => {
      if (navigatingRef.current) return;
      navigatingRef.current = true;
      closeThenRun(close, () => {
        try {
          action();
        } finally {
          navigatingRef.current = false;
        }
      });
    },
    [close],
  );

  return {
    open,
    setOpen,
    close,
    runAfterClose,
    isNavigating: () => navigatingRef.current,
  };
}
