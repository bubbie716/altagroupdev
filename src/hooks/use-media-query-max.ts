"use client";

import { useEffect, useState } from "react";

/** True when viewport is below the given Tailwind-style breakpoint (default: lg = 1024). */
export function useMediaQueryMax(maxWidthPx: number): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(`(max-width: ${maxWidthPx - 1}px)`).matches;
  });

  useEffect(() => {
    const media = window.matchMedia(`(max-width: ${maxWidthPx - 1}px)`);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [maxWidthPx]);

  return matches;
}
