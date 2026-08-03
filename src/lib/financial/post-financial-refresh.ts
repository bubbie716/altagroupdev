/**
 * Financial-facing aliases for the shared post-mutation refresh layer.
 * Prefer `@/lib/router/post-mutation-refresh` for new non-financial surfaces;
 * existing Bank/Terminal callers may keep importing from here.
 */
export {
  isRefreshFailureSoft,
  matchPathname,
  mutationRefreshCopy as financialRefreshCopy,
  refreshMutationRouteData as refreshFinancialRouteData,
  scopePrefixes,
  shouldClearCachedMatch,
  type MutationRefreshScope as FinancialRefreshScope,
  type MutationRefreshStatus as FinancialRefreshStatus,
  type PostMutationRefreshResult as PostFinancialRefreshResult,
} from "@/lib/router/post-mutation-refresh";
