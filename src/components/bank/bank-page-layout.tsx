"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Outlet, useRouterState } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";
import { BankSubNav } from "@/components/bank/bank-sub-nav";
import { useResolvedPathname } from "@/components/navigation/use-resolved-pathname";

export type BankPageMetaProps = {
  eyebrow: string;
  title: string;
  description?: string;
  /** Subtle line beneath the title. */
  subtitle?: string;
  action?: ReactNode;
  printDocument?: boolean;
};

const defaultMeta: BankPageMetaProps = {
  eyebrow: "Alta Bank",
  title: "Banking",
};

function metaFieldsEqual(a: BankPageMetaProps, b: BankPageMetaProps): boolean {
  return (
    a.eyebrow === b.eyebrow &&
    a.title === b.title &&
    a.description === b.description &&
    a.subtitle === b.subtitle &&
    a.action === b.action &&
    a.printDocument === b.printDocument
  );
}

type BankPageLayoutContextValue = {
  setMeta: (meta: BankPageMetaProps) => void;
};

const BankPageLayoutContext = createContext<BankPageLayoutContextValue | null>(null);

/** Registers page hero metadata for the persistent /bank layout shell. */
export function BankPageMeta(props: BankPageMetaProps) {
  const ctx = useContext(BankPageLayoutContext);
  useLayoutEffect(() => {
    ctx?.setMeta(props);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
  }, [
    ctx,
    props.eyebrow,
    props.title,
    props.description,
    props.subtitle,
    props.action,
    props.printDocument,
  ]);

  return null;
}

export function isChromelessBankPath(pathname: string): boolean {
  return (
    pathname.startsWith("/bank/account/") ||
    pathname.startsWith("/bank/accounts/") ||
    pathname.startsWith("/bank/admin/")
  );
}

/** Full-screen bank routes (deal room threads) — no shared bank chrome at all. */
export function isFullScreenBankPath(pathname: string): boolean {
  return pathname.includes("/thread");
}

function BankChromeLayout({ showBankSubNav }: { showBankSubNav: boolean }) {
  const [meta, setMetaState] = useState<BankPageMetaProps>(defaultMeta);
  const setMeta = useCallback((next: BankPageMetaProps) => {
    setMetaState((prev) => (metaFieldsEqual(prev, next) ? prev : next));
  }, []);
  const layoutValue = useMemo(() => ({ setMeta }), [setMeta]);

  return (
    <BankPageLayoutContext.Provider value={layoutValue}>
      <PageShell {...meta} animateHero={false}>
        <div className="flex min-h-0 flex-1 flex-col">
          {showBankSubNav ? <BankSubNav /> : null}
          <div className="route-page-content">
            <Outlet />
          </div>
        </div>
      </PageShell>
    </BankPageLayoutContext.Provider>
  );
}

export function BankRouteLayout() {
  const locationPathname = useRouterState({ select: (s) => s.location.pathname });
  const resolvedPathname = useResolvedPathname();

  if (isFullScreenBankPath(locationPathname)) {
    return <Outlet />;
  }

  return <BankChromeLayout showBankSubNav={!isChromelessBankPath(resolvedPathname)} />;
}
