"use client";

import { useLayoutEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { rememberSiteReturnPath } from "@/lib/navigation/site-return-path";

/** Keeps session memory of the last public page before internal console use. */
export function SiteReturnPathTracker() {
  const { pathname, searchStr } = useRouterState({
    select: (s) => ({
      pathname: s.location.pathname,
      searchStr: s.location.searchStr,
    }),
  });

  useLayoutEffect(() => {
    rememberSiteReturnPath(pathname, searchStr);
  }, [pathname, searchStr]);

  return null;
}
