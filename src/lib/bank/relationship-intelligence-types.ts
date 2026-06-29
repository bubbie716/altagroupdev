export type RelationshipTierCode =
  | "NEW"
  | "STANDARD"
  | "PREFERRED"
  | "PREMIER"
  | "PRIVATE_ELIGIBLE"
  | "PRIVATE_CLIENT";

export type RelationshipFactorImpact = "positive" | "negative" | "neutral";

export type RelationshipFactor = {
  key: string;
  label: string;
  value: string;
  impact: number;
  impactType: RelationshipFactorImpact;
};

export type RelationshipProductsHeld = {
  activeBankAccounts: number;
  activeAltaCards: number;
  activeLoans: number;
  paidOffLoans: number;
  businessCompanies: number;
  verifiedCompanies: number;
  isPrivateClient: boolean;
};

export type RelationshipProfileRow = {
  id: string;
  userId: string;
  relationshipSince: string;
  relationshipScore: number;
  relationshipTier: RelationshipTierCode;
  privateBankingEligible: boolean;
  privateBankingClient: boolean;
  totalBankAssets: number;
  totalInvestments: number;
  totalAltaAssets: number;
  lifetimeDeposits: number;
  lifetimeWithdrawals: number;
  lifetimeInterestEarned: number;
  lifetimeInterestPaid: number;
  lifetimeAltaPayVolume: number;
  lifetimeLoanPayments: number;
  lifetimeCardPayments: number;
  activeLoanBalance: number;
  activeCardBalance: number;
  currentCreditExposure: number;
  productsHeld: RelationshipProductsHeld;
  lastCalculatedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type RelationshipProfileSnapshotRow = {
  id: string;
  userId: string;
  profileId: string;
  relationshipScore: number;
  relationshipTier: RelationshipTierCode;
  totalBankAssets: number;
  totalAltaAssets: number;
  currentCreditExposure: number;
  privateBankingEligible: boolean;
  calculatedAt: string;
  metadata: Record<string, unknown> | null;
};

export type RelationshipProfileSummary = Pick<
  RelationshipProfileRow,
  | "userId"
  | "relationshipSince"
  | "relationshipScore"
  | "relationshipTier"
  | "privateBankingEligible"
  | "privateBankingClient"
  | "totalAltaAssets"
  | "productsHeld"
  | "lastCalculatedAt"
>;

export type RelationshipRecommendationTypeCode =
  | "ALTA_CARD_TIER"
  | "ALTA_CARD_LIMIT"
  | "ALTA_CARD_RATE"
  | "LOAN_PRE_APPROVAL"
  | "PRIVATE_BANKING_INVITE"
  | "PRODUCT_OPPORTUNITY";

export type CustomerRelationshipOpportunity = {
  id: string;
  recommendationType: RelationshipRecommendationTypeCode;
  message: string;
};

export type CustomerRelationshipView = {
  relationshipSince: string;
  relationshipTier: RelationshipTierCode;
  relationshipTierLabel: string;
  altaPrivateStatusLabel: string;
  relationshipProgress: {
    currentTierLabel: string;
    nextTierLabel: string | null;
    progressPercent: number;
  };
  totalAltaAssets: number;
  lifetimeDeposits: number;
  lifetimeWithdrawals: number;
  lifetimeInterestEarned: number;
  lifetimeInterestPaid: number;
  lifetimeAltaPayVolume: number;
  productsHeld: RelationshipProductsHeld;
  privateBankingEligible: boolean;
  privateBankingClient: boolean;
  opportunities: CustomerRelationshipOpportunity[];
  timeline: CustomerRelationshipTimelineEntry[];
};

export type RelationshipIntelligenceDashboard = {
  totalProfiles: number;
  privateEligibleCount: number;
  preferredOrPremierCount: number;
  topByAssets: Array<{
    userId: string;
    discordUsername: string;
    relationshipScore: number;
    relationshipTier: RelationshipTierCode;
    totalAltaAssets: number;
  }>;
  recentlyChanged: Array<{
    userId: string;
    discordUsername: string;
    oldScore: number;
    newScore: number;
    oldTier: RelationshipTierCode;
    newTier: RelationshipTierCode;
    calculatedAt: string;
  }>;
};

export type CalculatedRelationshipProfile = Omit<
  RelationshipProfileRow,
  "id" | "userId" | "createdAt" | "updatedAt" | "lastCalculatedAt"
> & {
  factors: RelationshipFactor[];
};

export type RelationshipRecommendationStatusCode =
  | "ACTIVE"
  | "REVIEWED"
  | "DISMISSED"
  | "ACCEPTED"
  | "EXPIRED";

export type RelationshipRecommendationReason = {
  bullets: string[];
  actionPath?: {
    to: string;
    params?: Record<string, string>;
    search?: Record<string, string | number | boolean | undefined>;
  };
};

export type RelationshipRecommendationRow = {
  id: string;
  userId: string;
  profileId: string;
  recommendationType: RelationshipRecommendationTypeCode;
  status: RelationshipRecommendationStatusCode;
  title: string;
  summary: string;
  recommendedProduct: string | null;
  recommendedTier: string | null;
  recommendedLimit: number | null;
  recommendedRate: number | null;
  confidenceScore: number;
  reasons: RelationshipRecommendationReason;
  createdAt: string;
  updatedAt: string;
  dismissedAt: string | null;
  acceptedAt: string | null;
  reviewedByUserId: string | null;
};

export type RelationshipTimelineEventTypeCode =
  | "RELATIONSHIP_STARTED"
  | "BANK_ACCOUNT_OPENED"
  | "BUSINESS_ACCOUNT_OPENED"
  | "DEPOSIT_MILESTONE"
  | "WITHDRAWAL_MILESTONE"
  | "ALTA_PAY_MILESTONE"
  | "ALTA_CARD_OPENED"
  | "ALTA_CARD_TIER_CHANGED"
  | "ALTA_CARD_LIMIT_CHANGED"
  | "ALTA_CARD_RATE_CHANGED"
  | "ALTA_CARD_PAID_ON_TIME"
  | "ALTA_CARD_DELINQUENT"
  | "LOAN_APPLICATION_SUBMITTED"
  | "LOAN_ACCEPTED"
  | "LOAN_DENIED"
  | "LOAN_FUNDED"
  | "LOAN_PAYMENT_MADE"
  | "LOAN_PAID_OFF"
  | "PRIVATE_BANKING_ELIGIBLE"
  | "ALTA_PRIVATE_INVITED"
  | "PRIVATE_BANKING_CLIENT"
  | "RELATIONSHIP_SCORE_CHANGED"
  | "RELATIONSHIP_TIER_CHANGED"
  | "MANUAL_NOTE";

export type RelationshipTimelineEventRow = {
  id: string;
  userId: string;
  profileId: string | null;
  eventType: RelationshipTimelineEventTypeCode;
  title: string;
  description: string | null;
  occurredAt: string;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export type RelationshipTimelineSummary = {
  relationshipSince: string | null;
  latestEvent: RelationshipTimelineEventRow | null;
  majorMilestoneCount: number;
  productHistoryCount: number;
  lastActivityAt: string | null;
};

export type CustomerRelationshipTimelineEntry = Pick<
  RelationshipTimelineEventRow,
  "id" | "eventType" | "title" | "description" | "occurredAt"
>;

export type RelationshipIntegrationContext =
  | "ALTA_CARD"
  | "LENDING"
  | "PRIVATE_BANKING"
  | "CUSTOMER_PROFILE";

export type ProductHoldingsDetail = {
  bankAccountsTotal: number;
  bankAccountsActive: number;
  altaCardStatus: string | null;
  altaCardTier: string | null;
  altaCardCount: number;
  businessCardCount: number;
  activeLoans: number;
  paidOffLoans: number;
  companyMemberships: number;
  verifiedCompanies: number;
  isPrivateClient: boolean;
  exchangePlaceholder: boolean;
  terminalPlaceholder: boolean;
};

export type LendingIntelligenceSignals = {
  delinquentCardCount: number;
  defaultedLoanCount: number;
  overdueInstallmentCount: number;
  altaCardStatus: string | null;
  altaCardTier: string | null;
};

export type RelationshipIntelligencePanelData = {
  userId: string;
  hasPersistedProfile: boolean;
  relationshipSince: string;
  relationshipScore: number;
  relationshipTier: RelationshipTierCode;
  privateBankingEligible: boolean;
  privateBankingClient: boolean;
  totalBankAssets: number;
  totalAltaAssets: number;
  totalInvestments: number;
  lifetimeDeposits: number;
  lifetimeWithdrawals: number;
  lifetimeInterestPaid: number;
  lifetimeAltaPayVolume: number;
  lifetimeLoanPayments: number;
  lifetimeCardPayments: number;
  activeLoanBalance: number;
  activeCardBalance: number;
  currentCreditExposure: number;
  productsHeld: RelationshipProductsHeld;
  productHoldings: ProductHoldingsDetail;
  lendingSignals: LendingIntelligenceSignals;
  lastCalculatedAt: string;
};

export type PreApprovalReadinessStatus = "ELIGIBLE" | "NOT_ELIGIBLE" | "NEEDS_REVIEW";

export type PreApprovalReadiness = {
  eligible: boolean;
  readinessStatus: PreApprovalReadinessStatus;
  reasons: string[];
  blockers: string[];
  suggestedProducts: string[];
};

export type RecommendationPrefill = {
  recommendationId: string;
  recommendationType: RelationshipRecommendationTypeCode;
  suggestedTier?: string;
  suggestedLimit?: number;
  suggestedRate?: number;
  confidenceScore: number;
  reasons: string[];
};
