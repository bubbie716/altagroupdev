export type CompanyRelationshipTierCode =
  | "NEW"
  | "STANDARD"
  | "PREFERRED"
  | "PREMIER"
  | "COMMERCIAL_ELIGIBLE";

export type CompanyRelationshipRecommendationTypeCode =
  | "BUSINESS_ALTA_CARD_LIMIT"
  | "BUSINESS_ALTA_CARD_RATE"
  | "BUSINESS_LOAN_OPPORTUNITY"
  | "TREASURY_PRODUCT_OPPORTUNITY"
  | "COMMERCIAL_BANKING_ELIGIBILITY";

export type CompanyRelationshipRecommendationStatusCode =
  | "ACTIVE"
  | "REVIEWED"
  | "DISMISSED"
  | "ACCEPTED"
  | "EXPIRED";

export type CompanyRelationshipFactor = {
  key: string;
  label: string;
  value: string;
  impact: number;
  impactType: "positive" | "negative" | "neutral";
};

export type CompanyProductHoldings = {
  activeBusinessAccounts: number;
  activeBusinessLoans: number;
  activeBusinessCards: number;
  paidOffBusinessLoans: number;
  businessCardApplications: number;
  treasuryPlaceholder: boolean;
  exchangePlaceholder: boolean;
};

export type CompanyRelationshipProfileRow = {
  id: string;
  companyId: string;
  relationshipSince: string;
  relationshipScore: number;
  relationshipTier: CompanyRelationshipTierCode;
  commercialBankingEligible: boolean;
  totalBusinessAssets: number;
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
  productHoldings: CompanyProductHoldings;
  lastCalculatedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type CalculatedCompanyRelationshipProfile = Omit<
  CompanyRelationshipProfileRow,
  "id" | "companyId" | "createdAt" | "updatedAt"
> & {
  factors: CompanyRelationshipFactor[];
};

export type CompanyRelationshipProfileSummary = Pick<
  CompanyRelationshipProfileRow,
  | "companyId"
  | "relationshipSince"
  | "relationshipScore"
  | "relationshipTier"
  | "commercialBankingEligible"
  | "totalBusinessAssets"
  | "productHoldings"
  | "lastCalculatedAt"
>;

export type CustomerCompanyRelationshipView = {
  companyId: string;
  companyName: string;
  relationshipSince: string;
  relationshipTier: CompanyRelationshipTierCode;
  relationshipTierLabel: string;
  relationshipProgress: {
    currentTierLabel: string;
    nextTierLabel: string | null;
    progressPercent: number;
  };
  totalBusinessAssets: number;
  lifetimeDeposits: number;
  lifetimeWithdrawals: number;
  lifetimeInterestEarned: number;
  lifetimeInterestPaid: number;
  lifetimeAltaPayVolume: number;
  activeBusinessLoans: number;
  activeBusinessCards: number;
  productHoldings: CompanyProductHoldings;
  commercialBankingEligible: boolean;
  opportunities: CompanyCustomerOpportunity[];
  timeline: CompanyRelationshipTimelineEventRow[];
};

export type CompanyCustomerOpportunity = {
  title: string;
  message: string;
};

export type CompanyRelationshipRecommendationReason = {
  bullets: string[];
  actionPath?: { label: string; href: string };
};

export type CompanyRelationshipRecommendationRow = {
  id: string;
  companyId: string;
  profileId: string;
  recommendationType: CompanyRelationshipRecommendationTypeCode;
  status: CompanyRelationshipRecommendationStatusCode;
  title: string;
  summary: string;
  recommendedProduct: string | null;
  recommendedTier: string | null;
  recommendedLimit: number | null;
  recommendedRate: number | null;
  confidenceScore: number;
  reasons: CompanyRelationshipRecommendationReason;
  createdAt: string;
  updatedAt: string;
  dismissedAt: string | null;
  acceptedAt: string | null;
  reviewedByUserId: string | null;
};

export type CompanyRelationshipTimelineEventRow = {
  id: string;
  companyId: string;
  profileId: string | null;
  eventType: string;
  title: string;
  description: string | null;
  occurredAt: string;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export type AdminCompanyRelationshipDetail = {
  company: { id: string; name: string; verificationStatus: string };
  profile: CompanyRelationshipProfileRow | null;
  calculated: CalculatedCompanyRelationshipProfile;
  timelineSummary: {
    totalEvents: number;
    firstEventAt: string | null;
    latestEventAt: string | null;
  };
};

export type CompanyLendingIntelligenceSignals = {
  delinquentCardCount: number;
  defaultedLoanCount: number;
  overdueInstallmentCount: number;
  altaCardStatus: string | null;
  altaCardTier: string | null;
};

export type CompanyRelationshipIntelligencePanelData = {
  companyId: string;
  companyName: string;
  hasPersistedProfile: boolean;
  relationshipSince: string;
  relationshipScore: number;
  relationshipTier: CompanyRelationshipTierCode;
  commercialBankingEligible: boolean;
  totalBusinessAssets: number;
  lifetimeDeposits: number;
  lifetimeWithdrawals: number;
  lifetimeAltaPayVolume: number;
  lifetimeLoanPayments: number;
  lifetimeCardPayments: number;
  activeLoanBalance: number;
  activeCardBalance: number;
  currentCreditExposure: number;
  productHoldings: CompanyProductHoldings;
  lendingSignals: CompanyLendingIntelligenceSignals;
  lastCalculatedAt: string;
};

export type CompanyRelationshipIntelligenceDashboard = {
  totalProfiles: number;
  commercialEligibleCount: number;
  preferredOrPremierCount: number;
  topByAssets: { companyId: string; companyName: string; totalBusinessAssets: number; relationshipScore: number }[];
};
