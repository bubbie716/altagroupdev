/** Default TanStack Router search objects for internal workspace routes. */

export const INTERNAL_USER_WORKSPACE_SEARCH = {
  tab: "overview" as const,
  privateReview: false as const,
};

export const INTERNAL_COMPANY_WORKSPACE_SEARCH = {
  tab: "overview" as const,
};

export const INTERNAL_ACCOUNT_WORKSPACE_SEARCH = {
  tab: "overview" as const,
};

export const INTERNAL_TRANSACTION_WORKSPACE_SEARCH = {
  tab: "overview" as const,
};

export const INTERNAL_ALTA_CARD_WORKSPACE_SEARCH = {
  tab: "overview" as const,
  suggestedTier: undefined,
  suggestedLimit: undefined,
  suggestedRate: undefined,
  recommendationId: undefined,
};

export const INTERNAL_ALTA_CARD_APPLICATION_SEARCH = {
  tab: "overview" as const,
};

export const INTERNAL_ALTA_CARD_REVIEW_SEARCH = {
  tab: "overview" as const,
};

export function internalWorkspaceTabSearch(tab: string) {
  return { tab };
}
