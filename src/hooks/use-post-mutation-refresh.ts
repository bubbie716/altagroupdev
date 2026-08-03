"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import {
  mutationRefreshCopy,
  refreshMutationRouteData,
  type MutationRefreshScope,
  type MutationRefreshStatus,
  type PostMutationRefreshResult,
} from "@/lib/router/post-mutation-refresh";

export type UsePostMutationRefresh = {
  status: MutationRefreshStatus;
  copy: { live: string; visible: string | null };
  /**
   * Call only after the mutation has successfully committed.
   * Never throws — refresh failure stays soft.
   */
  refreshAfterSuccess: (
    scope?: MutationRefreshScope,
  ) => Promise<PostMutationRefreshResult>;
  retryRefresh: () => Promise<PostMutationRefreshResult>;
  reset: () => void;
};

/**
 * Awaitable post-commit refresh for any mutation surface.
 * Deduplicates concurrent calls and preserves success when refresh fails.
 */
export function usePostMutationRefresh(): UsePostMutationRefresh {
  const router = useRouter();
  const [status, setStatus] = useState<MutationRefreshStatus>("idle");
  const lastScopeRef = useRef<MutationRefreshScope>("all");

  const refreshAfterSuccess = useCallback(
    async (scope: MutationRefreshScope = "all") => {
      lastScopeRef.current = scope;
      setStatus("refreshing");
      const result = await refreshMutationRouteData(router, scope);
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
    copy: mutationRefreshCopy(status),
    refreshAfterSuccess,
    retryRefresh,
    reset,
  };
}
