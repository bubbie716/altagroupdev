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
import { TerminalSubNav } from "@/components/terminal/terminal-sub-nav";
import {
  ALTA_TERMINAL_EYEBROW,
  ALTA_TERMINAL_TAGLINE,
  terminalPageDescription,
} from "@/lib/branding/alta-products";

export type TerminalPageMetaProps = {
  title?: string;
  description: string;
  action?: ReactNode;
};

const defaultMeta: TerminalPageMetaProps = {
  title: ALTA_TERMINAL_TAGLINE,
  description: "",
};

function metaFieldsEqual(a: TerminalPageMetaProps, b: TerminalPageMetaProps): boolean {
  return a.title === b.title && a.description === b.description && a.action === b.action;
}

type TerminalPageLayoutContextValue = {
  setMeta: (meta: TerminalPageMetaProps) => void;
};

const TerminalPageLayoutContext = createContext<TerminalPageLayoutContextValue | null>(null);

export function TerminalLayoutNav() {
  return <TerminalSubNav />;
}

/** Registers page hero metadata for the persistent /terminal layout shell. */
export function TerminalPageMeta(props: TerminalPageMetaProps) {
  const ctx = useContext(TerminalPageLayoutContext);
  useLayoutEffect(() => {
    ctx?.setMeta(props);
  }, [ctx, props.title, props.description, props.action]);
  return null;
}

function TerminalChromeLayoutInner() {
  const [meta, setMetaState] = useState<TerminalPageMetaProps>(defaultMeta);
  const setMeta = useCallback((next: TerminalPageMetaProps) => {
    setMetaState((prev) => (metaFieldsEqual(prev, next) ? prev : next));
  }, []);
  const layoutValue = useMemo(() => ({ setMeta }), [setMeta]);

  return (
    <TerminalPageLayoutContext.Provider value={layoutValue}>
      <PageShell
        eyebrow={ALTA_TERMINAL_EYEBROW}
        title={meta.title ?? ALTA_TERMINAL_TAGLINE}
        description={terminalPageDescription(meta.description)}
        action={meta.action}
        animateHero={false}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <TerminalLayoutNav />
          <div className="route-page-content">
            <Outlet />
          </div>
        </div>
      </PageShell>
    </TerminalPageLayoutContext.Provider>
  );
}

export function TerminalRouteLayout() {
  return <TerminalChromeLayoutInner />;
}

/** Page content wrapper when using the persistent /terminal layout. */
export function TerminalPageShell({
  title = ALTA_TERMINAL_TAGLINE,
  description,
  children,
}: {
  title?: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <>
      <TerminalPageMeta title={title} description={description} />
      {children}
    </>
  );
}

export { ALTA_TERMINAL_TAGLINE, terminalPageDescription };
