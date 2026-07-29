"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import {
  buildBreadcrumbs,
  useInternalShell,
  type InternalBreadcrumbItem,
} from "@/components/internal/console";

/**
 * Syncs page title / breadcrumbs / actions into the fixed shell header.
 * Updates only via layout effect on stable string keys (avoids max-update-depth
 * loops and SSR/client hydration mismatches from module-global title stores).
 * Does not reset on unmount — pathname scoping in the header ignores stale state.
 */
export function InternalPageShell({
  title,
  description: _description,
  breadcrumbs,
  actions,
  children,
  hideSearch: _hideSearch,
}: {
  title: string;
  /** @deprecated Descriptions removed from internal console chrome. */
  description?: string;
  breadcrumbs?: InternalBreadcrumbItem[];
  actions?: ReactNode;
  children: ReactNode;
  /** @deprecated Search lives in the fixed header. */
  hideSearch?: boolean;
}) {
  const { setPage } = useInternalShell();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const breadcrumbsRef = useRef(breadcrumbs);
  const actionsRef = useRef(actions);
  breadcrumbsRef.current = breadcrumbs;
  actionsRef.current = actions;

  const breadcrumbKey = (breadcrumbs ?? [{ label: title, to: undefined as string | undefined }])
    .map((b) => `${b.label}:${b.to ?? ""}`)
    .join("|");
  const actionsKey = actions == null ? "none" : "present";

  useLayoutEffect(() => {
    const resolved =
      breadcrumbsRef.current ?? buildBreadcrumbs([{ label: title }]);
    setPage({
      title,
      breadcrumbs: resolved,
      actions: actionsRef.current ?? null,
      pathname,
    });
  }, [title, breadcrumbKey, actionsKey, pathname, setPage]);

  return <div className="internal-page min-w-0">{children}</div>;
}
