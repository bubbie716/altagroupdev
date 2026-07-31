"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Outlet, useRouterState } from "@tanstack/react-router";
import { BankTopNav } from "@/components/bank/bank-top-nav";
import { BankMobileBottomNav } from "@/components/bank/bank-mobile-nav";
import { BankSubNav } from "@/components/bank/bank-sub-nav";
import { BankActionHost } from "@/components/bank/actions/bank-action-host";
import { ProductConsentRouteGate } from "@/components/legal/product-consent-route-gate";
import { ProductConsentActionProvider } from "@/components/legal/product-consent-action-controller";
import { useResolvedPathname } from "@/components/navigation/use-resolved-pathname";
import { cn } from "@/lib/utils";

export type BankPageMetaProps = {
  eyebrow?: string;
  title?: string;
  description?: string;
  subtitle?: string;
  action?: ReactNode;
  printDocument?: boolean;
  /** Hide the page title block (dashboard uses its own hierarchy). */
  hideTitle?: boolean;
};

const defaultMeta: BankPageMetaProps = {
  eyebrow: "Alta Bank",
  title: "Banking",
  hideTitle: false,
};

function normalizeBankPath(pathname: string): string {
  return pathname.replace(/\/$/, "") || "/";
}

function defaultMetaForPath(pathname: string): BankPageMetaProps {
  const path = normalizeBankPath(pathname);

  if (path.startsWith("/bank/lending/applications")) {
    return { eyebrow: "Alta Bank · Lending", title: "Applications", hideTitle: false };
  }
  if (path.startsWith("/bank/lending/loans")) {
    return { eyebrow: "Alta Bank · Lending", title: "Loans", hideTitle: false };
  }
  if (path.startsWith("/bank/lending")) {
    return { eyebrow: "Alta Bank · Lending", title: "Lending", hideTitle: false };
  }
  if (path === "/bank/alta-card/business") {
    return { eyebrow: "Alta Bank", title: "Business Alta Cards", hideTitle: false };
  }
  if (path.startsWith("/bank/alta-card")) {
    return { eyebrow: "Alta Bank", title: "Alta Card", hideTitle: false };
  }
  if (path.startsWith("/bank/pay")) {
    return { eyebrow: "Alta Bank", title: "Alta Pay", hideTitle: false };
  }
  if (path.includes("/commercial/payments")) {
    return { eyebrow: "Alta Bank · Commercial", title: "Payments", hideTitle: false };
  }
  if (path.includes("/bank/account/")) {
    return { eyebrow: "Alta Bank", title: "Account", hideTitle: false };
  }

  return defaultMeta;
}

function metaFieldsEqual(a: BankPageMetaProps, b: BankPageMetaProps): boolean {
  return (
    a.eyebrow === b.eyebrow &&
    a.title === b.title &&
    a.description === b.description &&
    a.subtitle === b.subtitle &&
    a.action === b.action &&
    a.printDocument === b.printDocument &&
    a.hideTitle === b.hideTitle
  );
}

type BankPageLayoutContextValue = {
  setMeta: (meta: BankPageMetaProps) => void;
};

const BankPageLayoutContext = createContext<BankPageLayoutContextValue | null>(null);

/** Registers page metadata for the persistent /bank layout shell. */
export function BankPageMeta({
  eyebrow,
  title,
  description,
  subtitle,
  action,
  printDocument,
  hideTitle,
}: BankPageMetaProps) {
  const ctx = useContext(BankPageLayoutContext);
  useLayoutEffect(() => {
    ctx?.setMeta({
      eyebrow,
      title,
      description,
      subtitle,
      action,
      printDocument,
      hideTitle,
    });
  }, [
    ctx,
    eyebrow,
    title,
    description,
    subtitle,
    action,
    printDocument,
    hideTitle,
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

export function isFullScreenBankPath(pathname: string): boolean {
  return pathname.includes("/thread");
}

function shouldShowSectionSubNav(pathname: string): boolean {
  if (isChromelessBankPath(pathname)) return false;
  return (
    pathname.startsWith("/bank/lending") ||
    pathname.startsWith("/bank/alta-card") ||
    pathname.startsWith("/bank/pay") ||
    pathname.startsWith("/bank/business") ||
    pathname.startsWith("/bank/commercial")
  );
}

function BankChromeLayout() {
  const resolvedPathname = useResolvedPathname();
  const locationPathname = useRouterState({ select: (s) => s.location.pathname });
  const [meta, setMetaState] = useState<BankPageMetaProps>(() => defaultMetaForPath(resolvedPathname));
  const [metaPathname, setMetaPathname] = useState(resolvedPathname);
  const setMeta = useCallback((next: BankPageMetaProps) => {
    setMetaState((prev) => (metaFieldsEqual(prev, next) ? prev : next));
  }, []);
  const layoutValue = useMemo(() => ({ setMeta }), [setMeta]);
  const lastScrolledPathRef = useRef<string | null>(null);

  // Prefer the destination path while a loader is in flight so the title/tab chrome
  // updates on the first click instead of waiting for resolvedLocation.
  const chromePathname =
    normalizeBankPath(locationPathname) !== normalizeBankPath(resolvedPathname)
      ? locationPathname
      : resolvedPathname;

  // Scroll to top on pathname changes only — not when search params update
  // (e.g. opening an Activity detail sheet via ?transactionId=…).
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    if (lastScrolledPathRef.current === chromePathname) return;
    lastScrolledPathRef.current = chromePathname;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [chromePathname]);

  // Reset default chrome meta during render on navigation so page BankPageMeta
  // layout effects (children) run afterward and can set title/action reliably.
  if (metaPathname !== chromePathname) {
    setMetaPathname(chromePathname);
    setMetaState(defaultMetaForPath(chromePathname));
  }

  const showSubNav = shouldShowSectionSubNav(chromePathname);
  const showTitle = !meta.hideTitle && Boolean(meta.title);
  const isRoutePending =
    normalizeBankPath(locationPathname) !== normalizeBankPath(resolvedPathname);

  return (
    <BankPageLayoutContext.Provider value={layoutValue}>
      <ProductConsentActionProvider sourceSite="bank" theme="bank">
      <div
        className={cn(
          "flex min-h-0 w-full flex-1 flex-col overflow-x-clip bg-background",
          meta.printDocument && "statement-print-page",
        )}
      >
        <div className={cn(meta.printDocument && "print:hidden")}>
          <BankTopNav />
        </div>

        <ProductConsentRouteGate sourceSite="bank" theme="bank">
          <div className="mx-auto flex min-h-0 w-full min-w-0 max-w-[1120px] flex-1 flex-col px-4 sm:px-6">
            {showSubNav ? (
              <div className={cn("pt-3", meta.printDocument && "print:hidden")}>
                <BankSubNav />
              </div>
            ) : null}

            {showTitle ? (
              <div
                className={cn(
                  "shrink-0 border-b border-border/50 pb-4 pt-6 sm:pb-5 sm:pt-8",
                  meta.printDocument && "print:hidden",
                )}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                  <div className="min-w-0 flex-1 overflow-hidden">
                    {meta.eyebrow ? (
                      <div className="truncate text-[12px] font-medium text-muted-foreground">
                        {meta.eyebrow}
                      </div>
                    ) : null}
                    <h1 className="mt-1 truncate text-[1.5rem] font-semibold leading-tight tracking-tight text-foreground sm:text-[1.85rem]">
                      {meta.title}
                    </h1>
                    {meta.description ? (
                      <p className="mt-2 max-w-2xl min-w-0 break-all text-[14px] leading-relaxed text-muted-foreground sm:break-words">
                        {meta.description}
                      </p>
                    ) : null}
                  </div>
                  {meta.action ? (
                    <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
                      {meta.action}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            <main
              className={cn(
                "flex min-h-0 flex-1 flex-col py-6 sm:py-8",
                "pb-[calc(var(--bank-mobile-nav-offset)+1.5rem)] md:pb-10",
                meta.printDocument && "print:py-0",
                isRoutePending && "opacity-60",
              )}
              aria-busy={isRoutePending || undefined}
            >
              <Outlet />
            </main>
          </div>

          <div className={cn(meta.printDocument && "print:hidden")}>
            <BankMobileBottomNav />
          </div>

          <BankActionHost />
        </ProductConsentRouteGate>
      </div>
      </ProductConsentActionProvider>
    </BankPageLayoutContext.Provider>
  );
}

export function BankRouteLayout() {
  const locationPathname = useRouterState({ select: (s) => s.location.pathname });

  if (isFullScreenBankPath(locationPathname)) {
    return <Outlet />;
  }

  return <BankChromeLayout />;
}
