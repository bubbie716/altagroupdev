"use client";

import { useEffect, type RefObject } from "react";

/** Default glow anchor for SSR/hydration parity and static fallbacks. */
export const TERMINAL_POINTER_GLOW_DEFAULT = {
  x: "62%",
  y: "38%",
} as const;

/**
 * Drives `--terminal-pointer-x` / `--terminal-pointer-y` on a root element via
 * ref + requestAnimationFrame. Never schedules React state updates on pointermove.
 *
 * Tracking is enabled only for fine pointers when reduced motion is off and the
 * document is visible. Coarse-pointer / reduced-motion environments keep the
 * stable default position (CSS also supplies a static ambient fallback).
 */
export function useTerminalPointerGlow(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof window === "undefined") return;

    root.style.setProperty("--terminal-pointer-x", TERMINAL_POINTER_GLOW_DEFAULT.x);
    root.style.setProperty("--terminal-pointer-y", TERMINAL_POINTER_GLOW_DEFAULT.y);

    const finePointer = window.matchMedia("(pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    let frameId = 0;
    let pendingX = TERMINAL_POINTER_GLOW_DEFAULT.x;
    let pendingY = TERMINAL_POINTER_GLOW_DEFAULT.y;
    let listening = false;

    const flush = () => {
      frameId = 0;
      root.style.setProperty("--terminal-pointer-x", pendingX);
      root.style.setProperty("--terminal-pointer-y", pendingY);
    };

    const onPointerMove = (event: PointerEvent) => {
      pendingX = `${event.clientX}px`;
      pendingY = `${event.clientY}px`;
      if (frameId !== 0) return;
      frameId = window.requestAnimationFrame(flush);
    };

    const canTrack = () =>
      finePointer.matches &&
      !reducedMotion.matches &&
      document.visibilityState === "visible";

    const stop = () => {
      if (!listening) return;
      window.removeEventListener("pointermove", onPointerMove);
      listening = false;
      if (frameId !== 0) {
        window.cancelAnimationFrame(frameId);
        frameId = 0;
      }
    };

    const start = () => {
      if (listening || !canTrack()) return;
      window.addEventListener("pointermove", onPointerMove, { passive: true });
      listening = true;
    };

    const sync = () => {
      if (canTrack()) {
        start();
        return;
      }
      stop();
      root.style.setProperty("--terminal-pointer-x", TERMINAL_POINTER_GLOW_DEFAULT.x);
      root.style.setProperty("--terminal-pointer-y", TERMINAL_POINTER_GLOW_DEFAULT.y);
    };

    sync();
    finePointer.addEventListener("change", sync);
    reducedMotion.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);

    return () => {
      stop();
      finePointer.removeEventListener("change", sync);
      reducedMotion.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [rootRef]);
}
