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
import { Outlet } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";
import { ExchangeSubNav } from "@/components/exchange/exchange-sub-nav";
import { ALTA_EXCHANGE_TAGLINE } from "@/lib/branding/alta-products";
import type { FooterVariant } from "@/lib/platform/footer-variant";

export type ExchangePageMetaProps = {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
  hideFooter?: boolean;
  footerVariant?: FooterVariant;
};

const defaultMeta: ExchangePageMetaProps = {
  eyebrow: "Alta Exchange",
  title: ALTA_EXCHANGE_TAGLINE,
  description:
    "Alta Exchange operates Newport's primary market infrastructure for listings, price discovery, execution, market data, and Alta Terminal.",
};

function metaFieldsEqual(a: ExchangePageMetaProps, b: ExchangePageMetaProps): boolean {
  return (
    a.eyebrow === b.eyebrow &&
    a.title === b.title &&
    a.description === b.description &&
    a.action === b.action &&
    a.hideFooter === b.hideFooter &&
    a.footerVariant === b.footerVariant
  );
}

type ExchangePageLayoutContextValue = {
  setMeta: (meta: ExchangePageMetaProps) => void;
};

const ExchangePageLayoutContext = createContext<ExchangePageLayoutContextValue | null>(null);

/** Registers page hero metadata for the persistent /exchange layout shell. */
export function ExchangePageMeta(props: ExchangePageMetaProps) {
  const ctx = useContext(ExchangePageLayoutContext);
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
  ]);
  return null;
}

function ExchangeChromeLayoutInner() {
  const [meta, setMetaState] = useState<ExchangePageMetaProps>(defaultMeta);
  const setMeta = useCallback((next: ExchangePageMetaProps) => {
    setMetaState((prev) => (metaFieldsEqual(prev, next) ? prev : next));
  }, []);
  const layoutValue = useMemo(() => ({ setMeta }), [setMeta]);

  return (
    <ExchangePageLayoutContext.Provider value={layoutValue}>
      <PageShell {...meta} animateHero={false}>
        <ExchangeSubNav />
        <div className="route-page-content">
          <Outlet />
        </div>
      </PageShell>
    </ExchangePageLayoutContext.Provider>
  );
}

export function ExchangeRouteLayout() {
  return <ExchangeChromeLayoutInner />;
}
