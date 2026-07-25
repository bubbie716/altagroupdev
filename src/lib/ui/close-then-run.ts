/**
 * Close a transient overlay, wait until the closed state has painted, then run
 * an action (usually navigation). Ensures Radix portals are gone before the
 * destination route renders.
 */
import { flushSync } from "react-dom";

function afterPaint(fn: () => void): void {
  if (typeof requestAnimationFrame === "undefined") {
    queueMicrotask(fn);
    return;
  }
  requestAnimationFrame(() => {
    requestAnimationFrame(fn);
  });
}

export function closeThenRun(close: () => void, action: () => void): void {
  flushSync(() => {
    close();
  });
  afterPaint(action);
}

/**
 * Radix DropdownMenuItem `onSelect` helper for navigation menus.
 * Does not call preventDefault on the select event (that would keep the menu open).
 * Focus restoration is blocked separately via `onCloseAutoFocus`.
 */
export function selectThenNavigate(
  _event: Event,
  close: () => void,
  navigate: () => void,
): void {
  closeThenRun(close, navigate);
}
