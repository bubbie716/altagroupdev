"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter, useRouterState } from "@tanstack/react-router";
import {
  mergeBankActionSearch,
  parseBankActionSearch,
  stripBankActionSearch,
} from "@/lib/bank/bank-action-url";
import type { BankActionId } from "@/lib/bank/bank-action-ids";
import type { BankAccountTypeCode } from "@/lib/bank/backend-types";
import { closeAllBankWorkflows } from "@/lib/ui/bank-workflow-registry";
import { closeAllTransientOverlays } from "@/lib/ui/transient-overlay-registry";

export type BankActionLaunchExtras = {
  accountId?: string;
  cardId?: string;
  employeeCardId?: string;
  companyId?: string;
  scope?: "personal" | "all";
  accountType?: BankAccountTypeCode;
  portfolioId?: string;
};

/**
 * Opens / closes Bank action overlays via URL search params.
 * Uses location.searchStr so child-route validateSearch cannot strip `action`.
 */
export function useBankActionLauncher() {
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  const searchObj = useRouterState({
    select: (s) => s.location.search as Record<string, unknown>,
  });
  const parsed = parseBankActionSearch(searchStr || searchObj);
  const launchTargetRef = useRef<HTMLElement | null>(null);

  const openAction = useCallback(
    (
      action: BankActionId,
      extras?: BankActionLaunchExtras,
      options?: { fromElement?: HTMLElement | null },
    ) => {
      closeAllBankWorkflows();
      closeAllTransientOverlays();
      if (options?.fromElement) launchTargetRef.current = options.fromElement;
      else if (typeof document !== "undefined") {
        launchTargetRef.current = document.activeElement as HTMLElement | null;
      }
      const next = mergeBankActionSearch(searchObj ?? {}, {
        action,
        accountId: extras?.accountId,
        cardId: extras?.cardId,
        employeeCardId: extras?.employeeCardId,
        companyId: extras?.companyId,
        scope: extras?.scope,
        accountType: extras?.accountType,
        portfolioId: extras?.portfolioId,
      });
      void router.navigate({
        to: pathname,
        search: next as never,
        replace: false,
      });
    },
    [pathname, router, searchObj],
  );

  const closeAction = useCallback(
    (options?: { replace?: boolean }) => {
      const next = stripBankActionSearch(searchObj ?? {});
      void router.navigate({
        to: pathname,
        search: next as never,
        replace: options?.replace ?? true,
      });
    },
    [pathname, router, searchObj],
  );

  const restoreLaunchFocus = useCallback(() => {
    const el = launchTargetRef.current;
    launchTargetRef.current = null;
    queueMicrotask(() => el?.focus?.());
  }, []);

  return {
    action: parsed.action,
    accountId: parsed.accountId,
    cardId: parsed.cardId,
    employeeCardId: parsed.employeeCardId,
    companyId: parsed.companyId,
    scope: parsed.scope,
    accountType: parsed.accountType,
    portfolioId: parsed.portfolioId,
    openAction,
    closeAction,
    restoreLaunchFocus,
  };
}

/** Close obsolete overlays when leaving Bank chrome paths entirely. */
export function useCloseBankActionOnLeaveBank() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  const router = useRouter();
  const prevPathRef = useRef(pathname);

  useEffect(() => {
    const leftBank =
      prevPathRef.current.startsWith("/bank") && !pathname.startsWith("/bank");
    prevPathRef.current = pathname;
    if (!leftBank) return;
    const parsed = parseBankActionSearch(searchStr);
    if (!parsed.action) return;
    void router.navigate({ to: pathname, search: {} as never, replace: true });
  }, [pathname, searchStr, router]);
}
