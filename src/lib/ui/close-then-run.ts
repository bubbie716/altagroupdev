/**
 * Close a menu/dialog first, then run a side effect (usually navigation).
 * Keeps Radix portals from lingering over the destination page during SPA transitions.
 */
export function closeThenRun(close: () => void, action: () => void): void {
  close();
  queueMicrotask(action);
}

/**
 * Radix `onSelect` helper: close controlled menu state, then navigate.
 * Call from DropdownMenuItem `onSelect` — do not use with `asChild` + Link
 * unless you also prevent the default link navigation and run it here.
 */
export function selectThenNavigate(
  event: Event,
  close: () => void,
  navigate: () => void,
): void {
  // Prevent Radix from restoring focus to the trigger mid-navigation.
  event.preventDefault();
  closeThenRun(close, navigate);
}
