"use client";

import { useEffect } from "react";

function findScrollContainer(start: Element | null): Element | null {
  let node = start;
  while (node && node !== document.documentElement) {
    if (node instanceof HTMLElement) {
      const style = getComputedStyle(node);
      const overflowY = style.overflowY;
      const canScrollY =
        (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") &&
        node.scrollHeight > node.clientHeight + 1;
      if (canScrollY) return node;
    }
    node = node.parentElement;
  }
  return document.scrollingElement;
}

function applyWheelScroll(deltaX: number, deltaY: number, from: Element) {
  const container = findScrollContainer(from.parentElement);
  if (container instanceof HTMLElement) {
    container.scrollTop += deltaY;
    container.scrollLeft += deltaX;
    return;
  }
  window.scrollBy({ top: deltaY, left: deltaX, behavior: "auto" });
}

function shouldRedirectWheelFromField(active: Element | null): active is HTMLInputElement | HTMLTextAreaElement {
  if (active instanceof HTMLInputElement && active.type === "number") return true;
  if (active instanceof HTMLTextAreaElement && active.scrollHeight <= active.clientHeight + 1) {
    return true;
  }
  return false;
}

/** Block number spin on wheel, but forward scroll to the page or nearest scroll container. */
export function redirectWheelFromFocusedField(event: WheelEvent): boolean {
  const active = document.activeElement;
  if (!shouldRedirectWheelFromField(active)) return false;

  event.preventDefault();
  applyWheelScroll(event.deltaX, event.deltaY, active);
  return true;
}

/** Prevent mouse wheel from changing number inputs while still allowing page scroll. */
export function NumberInputScrollGuard() {
  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      redirectWheelFromFocusedField(event);
    };

    document.addEventListener("wheel", handleWheel, { passive: false });
    return () => document.removeEventListener("wheel", handleWheel);
  }, []);

  return null;
}

export function blockNumberInputWheel(event: React.WheelEvent<HTMLInputElement>) {
  if (event.currentTarget.type !== "number") return;
  event.preventDefault();
  applyWheelScroll(event.deltaX, event.deltaY, event.currentTarget);
}
