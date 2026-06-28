"use client";

import { useEffect, type ReactNode } from "react";
import {
  buildBreadcrumbs,
  useInternalShell,
  type InternalBreadcrumbItem,
} from "@/components/internal/console";

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
  const { setPage, resetPage } = useInternalShell();
  const breadcrumbKey =
    breadcrumbs?.map((b) => `${b.label}:${b.to ?? ""}`).join("|") ?? `title:${title}`;

  useEffect(() => {
    setPage({
      title,
      breadcrumbs: breadcrumbs ?? buildBreadcrumbs([{ label: title }]),
      actions: actions ?? null,
    });
    return () => resetPage();
  }, [title, breadcrumbKey, setPage, resetPage, breadcrumbs, actions]);

  return <div className="internal-page min-w-0">{children}</div>;
}
