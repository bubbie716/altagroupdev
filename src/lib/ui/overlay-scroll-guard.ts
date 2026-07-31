import { useCallback, useRef } from "react";

type AutoFocusHandler = (event: Event) => void;

type ViewportPosition = {
  x: number;
  y: number;
  pathname: string;
};

function readViewportPosition(): ViewportPosition | null {
  if (typeof window === "undefined") return null;
  return {
    x: window.scrollX,
    y: window.scrollY,
    pathname: window.location.pathname,
  };
}

function restoreViewportPosition(position: ViewportPosition | null): void {
  if (!position || typeof window === "undefined") return;
  if (window.location.pathname !== position.pathname) return;
  if (window.scrollX === position.x && window.scrollY === position.y) return;
  window.scrollTo({ left: position.x, top: position.y, behavior: "instant" });
}

function restoreAfterFocus(position: ViewportPosition | null): void {
  if (!position) return;
  queueMicrotask(() => restoreViewportPosition(position));
  if (typeof requestAnimationFrame !== "undefined") {
    requestAnimationFrame(() => restoreViewportPosition(position));
  }
}

/**
 * Prevent Radix auto-focus and focus restoration from moving the document.
 * Shared by Dialog and Sheet so every overlay using the site primitives gets
 * identical viewport behavior.
 */
export function useOverlayScrollGuard(
  onOpenAutoFocus?: AutoFocusHandler,
  onCloseAutoFocus?: AutoFocusHandler,
) {
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const handleOpenAutoFocus = useCallback(
    (event: Event) => {
      const position = readViewportPosition();
      const active = document.activeElement;
      returnFocusRef.current = active instanceof HTMLElement ? active : null;
      onOpenAutoFocus?.(event);
      restoreAfterFocus(position);
    },
    [onOpenAutoFocus],
  );

  const handleCloseAutoFocus = useCallback(
    (event: Event) => {
      const position = readViewportPosition();
      onCloseAutoFocus?.(event);
      const consumerOwnsFocus = event.defaultPrevented;

      // Radix's default trigger focus can scroll a long page. Restore focus
      // ourselves with preventScroll unless the consumer chose a destination.
      event.preventDefault();
      queueMicrotask(() => {
        const target = returnFocusRef.current;
        if (!consumerOwnsFocus && target?.isConnected) {
          target.focus({ preventScroll: true });
        }
        restoreViewportPosition(position);
      });
      restoreAfterFocus(position);
    },
    [onCloseAutoFocus],
  );

  return { handleOpenAutoFocus, handleCloseAutoFocus };
}
