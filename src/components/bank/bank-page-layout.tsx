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
import type { FooterVariant } from "@/lib/platform/footer-variant";

export type BankPageMetaProps = {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
  hideFooter?: boolean;
  footerVariant?: FooterVariant;
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
    a.action === b.action &&
    a.hideFooter === b.hideFooter &&
    a.footerVariant === b.footerVariant &&
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
  }, [
    ctx,
    props.eyebrow,
    props.title,
    props.description,
    props.action,
    props.hideFooter,
    props.footerVariant,
    props.printDocument,
  ]);
  return null;
}

function BankChromeLayout() {
  const [meta, setMetaState] = useState<BankPageMetaProps>(defaultMeta);
  const setMeta = useCallback((next: BankPageMetaProps) => {
    setMetaState((prev) => (metaFieldsEqual(prev, next) ? prev : next));
  }, []);
  const value = useMemo(() => ({ setMeta }), [setMeta]);

  return (
    <BankPageLayoutContext.Provider value={value}>
      <PageShell {...meta} animateHero={false}>
        <BankSubNav />
        <Outlet />
      </PageShell>
    </BankPageLayoutContext.Provider>
  );
}

export function isChromelessBankPath(pathname: string): boolean {
  return (
    pathname.startsWith("/bank/account/") ||
    pathname.startsWith("/bank/accounts/") ||
    pathname.startsWith("/bank/admin/") ||
    pathname.includes("/thread")
  );
}

export function BankRouteLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (isChromelessBankPath(pathname)) {
    return <Outlet />;
  }
  return <BankChromeLayout />;
}
