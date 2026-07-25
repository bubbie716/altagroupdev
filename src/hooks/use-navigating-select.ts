import { useCallback, useEffect, useRef, useState } from "react";
import { closeThenRun } from "@/lib/ui/close-then-run";
import { registerTransientOverlay } from "@/lib/ui/transient-overlay-registry";

/**
 * Controlled Radix Select for values that trigger navigation or heavy refresh.
 * Updates the displayed value immediately, closes the portal, then navigates.
 */
export function useNavigatingSelect(value: string, onNavigate: (next: string) => void) {
  const [open, setOpen] = useState(false);
  const [displayValue, setDisplayValue] = useState(value);
  const navigatingRef = useRef(false);

  useEffect(() => {
    setDisplayValue(value);
  }, [value]);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => registerTransientOverlay(close), [close]);

  const onOpenChange = useCallback((next: boolean) => {
    if (!next) {
      setOpen(false);
      return;
    }
    if (navigatingRef.current) return;
    setOpen(true);
  }, []);

  const onValueChange = useCallback(
    (next: string) => {
      if (next === displayValue) {
        setOpen(false);
        return;
      }
      if (navigatingRef.current) return;
      navigatingRef.current = true;
      setDisplayValue(next);
      closeThenRun(close, () => {
        try {
          onNavigate(next);
        } finally {
          queueMicrotask(() => {
            navigatingRef.current = false;
          });
        }
      });
    },
    [close, displayValue, onNavigate],
  );

  return {
    open,
    onOpenChange,
    value: displayValue,
    onValueChange,
    isNavigating: () => navigatingRef.current,
  };
}
