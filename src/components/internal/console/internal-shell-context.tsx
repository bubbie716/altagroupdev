"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { InternalBreadcrumbItem } from "@/components/internal/console/internal-breadcrumbs";

export type InternalShellPageState = {
  title: string;
  breadcrumbs: InternalBreadcrumbItem[];
  actions: ReactNode;
  /** Route pathname this page state belongs to — ignores stale titles after navigation. */
  pathname: string;
};

const DEFAULT_PAGE: InternalShellPageState = {
  title: "",
  breadcrumbs: [],
  actions: null,
  pathname: "",
};

type InternalShellContextValue = {
  page: InternalShellPageState;
  setPage: (page: Partial<InternalShellPageState> & { pathname: string }) => void;
  resetPage: () => void;
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
};

const InternalShellContext = createContext<InternalShellContextValue | null>(null);

export function InternalShellProvider({ children }: { children: ReactNode }) {
  const [page, setPageState] = useState<InternalShellPageState>(DEFAULT_PAGE);
  const [mobileNavOpen, setMobileNavOpenState] = useState(false);

  const setPage = useCallback((next: Partial<InternalShellPageState> & { pathname: string }) => {
    setPageState((prev) => {
      const pathname = next.pathname;
      const title = next.title !== undefined ? next.title : prev.pathname === pathname ? prev.title : "";
      const breadcrumbs =
        next.breadcrumbs !== undefined
          ? next.breadcrumbs
          : prev.pathname === pathname
            ? prev.breadcrumbs
            : [];
      const actions =
        next.actions !== undefined ? next.actions : prev.pathname === pathname ? prev.actions : null;
      const samePath = pathname === prev.pathname;
      const sameTitle = title === prev.title;
      const sameActions = actions === prev.actions;
      const sameBreadcrumbs =
        breadcrumbs === prev.breadcrumbs ||
        (breadcrumbs.length === prev.breadcrumbs.length &&
          breadcrumbs.every(
            (b, i) => b.label === prev.breadcrumbs[i]?.label && b.to === prev.breadcrumbs[i]?.to,
          ));
      if (samePath && sameTitle && sameActions && sameBreadcrumbs) return prev;
      return { title, breadcrumbs, actions, pathname };
    });
  }, []);

  const resetPage = useCallback(() => {
    setPageState(DEFAULT_PAGE);
  }, []);

  const setMobileNavOpen = useCallback((open: boolean) => {
    setMobileNavOpenState(open);
  }, []);

  const value = useMemo(
    () => ({ page, setPage, resetPage, mobileNavOpen, setMobileNavOpen }),
    [page, setPage, resetPage, mobileNavOpen, setMobileNavOpen],
  );

  return <InternalShellContext.Provider value={value}>{children}</InternalShellContext.Provider>;
}

export function useInternalShell() {
  const ctx = useContext(InternalShellContext);
  if (!ctx) {
    throw new Error("useInternalShell must be used within InternalShellProvider");
  }
  return ctx;
}
