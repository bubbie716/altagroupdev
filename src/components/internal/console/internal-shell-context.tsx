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
};

const DEFAULT_PAGE: InternalShellPageState = {
  title: "Internal",
  breadcrumbs: [{ label: "Dashboard", to: "/internal" }],
  actions: null,
};

type InternalShellContextValue = {
  page: InternalShellPageState;
  setPage: (page: Partial<InternalShellPageState>) => void;
  resetPage: () => void;
};

const InternalShellContext = createContext<InternalShellContextValue | null>(null);

export function InternalShellProvider({ children }: { children: ReactNode }) {
  const [page, setPageState] = useState<InternalShellPageState>(DEFAULT_PAGE);

  const setPage = useCallback((next: Partial<InternalShellPageState>) => {
    setPageState((prev) => ({ ...prev, ...next }));
  }, []);

  const resetPage = useCallback(() => {
    setPageState(DEFAULT_PAGE);
  }, []);

  const value = useMemo(
    () => ({ page, setPage, resetPage }),
    [page, setPage, resetPage],
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
