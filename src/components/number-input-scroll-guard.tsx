"use client";

import { useEffect } from "react";

/** Prevent mouse wheel from incrementing/decrementing focused number inputs site-wide. */
export function NumberInputScrollGuard() {
  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      const active = document.activeElement;
      if (active instanceof HTMLInputElement && active.type === "number") {
        event.preventDefault();
      }
    };

    document.addEventListener("wheel", handleWheel, { passive: false });
    return () => document.removeEventListener("wheel", handleWheel);
  }, []);

  return null;
}

export function blockNumberInputWheel(event: React.WheelEvent<HTMLInputElement>) {
  if (event.currentTarget.type === "number") {
    event.preventDefault();
  }
}
