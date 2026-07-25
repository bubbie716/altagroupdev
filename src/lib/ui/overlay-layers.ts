/**
 * Shared overlay stacking. Nested menus must sit above Bank action dialogs
 * but below critical confirmations.
 */
export const OVERLAY_LAYER = {
  siteNav: 100,
  /** Default menus, selects, popovers on normal pages / under standard dialogs. */
  menu: 110,
  /** Standard dialogs and sheets. */
  dialog: 110,
  /** Bank transactional dialog / mobile sheet. */
  bankAction: 130,
  /**
   * Portaled Select / Dropdown / Popover content.
   * Must stay above bankAction so choosing an option does not count as
   * an outside interaction on the parent workflow.
   */
  nestedPortal: 140,
  /** Destructive / ops confirmations. */
  critical: 160,
} as const;

export type OverlayLayer = keyof typeof OVERLAY_LAYER;

/** Tailwind-safe z-index class for a named overlay layer. */
export function overlayZClass(layer: OverlayLayer): string {
  return `z-[${OVERLAY_LAYER[layer]}]`;
}

/** Mark portaled menu surfaces so parent dialogs can ignore outside events. */
export const NESTED_OVERLAY_ATTR = "data-alta-overlay";
export const NESTED_OVERLAY_VALUE = "nested";

export function isNestedOverlayElement(target: EventTarget | null): boolean {
  if (typeof Element === "undefined") return false;
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(`[${NESTED_OVERLAY_ATTR}="${NESTED_OVERLAY_VALUE}"]`),
  );
}

/** True when a nested Select/Dropdown/Popover is currently open. */
export function hasOpenNestedOverlay(): boolean {
  if (typeof document === "undefined") return false;
  return Boolean(
    document.querySelector(
      `[${NESTED_OVERLAY_ATTR}="${NESTED_OVERLAY_VALUE}"][data-state="open"]`,
    ),
  );
}
