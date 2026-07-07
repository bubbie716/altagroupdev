"use client";

import { useLayoutEffect } from "react";
import type { SiteKey } from "@/config/sites";

/** Keeps document-level NCC chrome in sync after client navigations (e.g. ?site=ncc on localhost). */
export function NccSiteChrome({ siteKey }: { siteKey: SiteKey }) {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    if (siteKey === "ncc") {
      root.classList.add("ncc-site");
      root.classList.remove("dark");
      root.style.backgroundColor = "#ffffff";
      body.style.backgroundColor = "#ffffff";
      return;
    }

    root.classList.remove("ncc-site");
    root.style.backgroundColor = "";
    body.style.backgroundColor = "";
  }, [siteKey]);

  return null;
}
