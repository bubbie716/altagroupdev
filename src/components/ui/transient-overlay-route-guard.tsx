"use client";

import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";
import { closeAllTransientOverlays } from "@/lib/ui/transient-overlay-registry";

/**
 * Force-closes registered menus/selects when the location changes.
 * Complements per-component controlled open state.
 */
export function TransientOverlayRouteGuard() {
  const locationKey = useRouterState({
    select: (s) => `${s.location.pathname}?${s.location.searchStr}`,
  });
  const previousKey = useRef(locationKey);

  useEffect(() => {
    if (previousKey.current === locationKey) return;
    previousKey.current = locationKey;
    closeAllTransientOverlays();
  }, [locationKey]);

  return null;
}
