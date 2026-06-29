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
import {
  AltaPrivateClientProvider,
  useAltaPrivateClientContext,
} from "@/hooks/use-alta-private-client-context";
import type { AltaPrivateClientContext } from "@/lib/bank/alta-private-client.types";
import { EMPTY_ALTA_PRIVATE_CLIENT_CONTEXT } from "@/lib/bank/alta-private-client.types";
import type { FooterVariant } from "@/lib/platform/footer-variant";

export type BankPageMetaProps = {
  eyebrow: string;
  title: string;
  description?: string;
  /** Subtle line beneath the title — used for Alta Private Client recognition. */
  subtitle?: string;
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
    a.subtitle === b.subtitle &&
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
    props.subtitle,
    props.action,
    props.hideFooter,
    props.footerVariant,
    props.printDocument,
  ]);
  return null;
}

function BankChromeLayoutInner() {
  const [meta, setMetaState] = useState<BankPageMetaProps>(defaultMeta);
  const setMeta = useCallback((next: BankPageMetaProps) => {
    setMetaState((prev) => (metaFieldsEqual(prev, next) ? prev : next));
  }, []);
  const layoutValue = useMemo(() => ({ setMeta }), [setMeta]);
  const privateClient = useAltaPrivateClientContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const showDefaultPrivateSubtitle =
    privateClient.isMember &&
    !meta.subtitle &&
    !pathname.startsWith("/bank/private");

  const shellMeta = showDefaultPrivateSubtitle
    ? { ...meta, subtitle: "Alta Private Client" }
    : meta;

  return (
    <BankPageLayoutContext.Provider value={layoutValue}>
      <PageShell {...shellMeta} animateHero={false}>
        <BankSubNav privateClientContext={privateClient} />
        <Outlet />
      </PageShell>
    </BankPageLayoutContext.Provider>
  );
}

function BankChromeLayout({ privateClientContext }: { privateClientContext: AltaPrivateClientContext }) {
  return (
    <AltaPrivateClientProvider value={privateClientContext}>
      <BankChromeLayoutInner />
    </AltaPrivateClientProvider>
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

export function BankRouteLayout({
  privateClientContext,
}: {
  privateClientContext?: AltaPrivateClientContext;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (isChromelessBankPath(pathname)) {
    return <Outlet />;
  }
  return (
    <BankChromeLayout privateClientContext={privateClientContext ?? EMPTY_ALTA_PRIVATE_CLIENT_CONTEXT} />
  );
}
