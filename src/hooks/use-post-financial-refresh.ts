"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import {
  financialRefreshCopy,
  refreshFinancialRouteData,
  type FinancialRefreshScope,
  type FinancialRefreshStatus,
  type PostFinancialRefreshResult,
} from "@/lib/financial/post-financial-refresh";

export type UsePostFinancialRefresh = {
  status: FinancialRefreshStatus;
  copy: { live: string; visible: string | null };
  /**
   * Call only after the mutation has successfully committed.
   * Never throws — refresh failure stays soft.
   */
  refreshAfterSuccess: (
    scope?: FinancialRefreshScope,
  ) => Promise<PostFinancialRefreshResult>;
  retryRefresh: () => Promise<PostFinancialRefreshResult>;
  reset: () => void;
};

/**
 * Awaitable post-commit refresh for Bank / Terminal financial surfaces.
 * Deduplicates concurrent calls and preserves success when refresh fails.
 */
export function usePostFinancialRefresh(): UsePostFinancialRefresh {
  const router = useRouter();
  const [status, setStatus] = useState<FinancialRefreshStatus>("idle");
  const lastScopeRef = useRef<FinancialRefreshScope>("all");

  const refreshAfterSuccess = useCallback(
    async (scope: FinancialRefreshScope = "all") => {
      lastScopeRef.current = scope;
      setStatus("refreshing");
      const result = await refreshFinancialRouteData(router, scope);
      setStatus(result.status);
      return result;
    },
    [router],
  );

  const retryRefresh = useCallback(async () => {
    return refreshAfterSuccess(lastScopeRef.current);
  }, [refreshAfterSuccess]);

  const reset = useCallback(() => {
    setStatus("idle");
  }, []);

  return {
    status,
    copy: financialRefreshCopy(status),
    refreshAfterSuccess,
    retryRefresh,
    reset,
  };
}
