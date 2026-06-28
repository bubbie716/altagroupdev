export const OPS_REVIEW_FLAG_REASONS = [
  "SUSPICIOUS_ACTIVITY",
  "IDENTITY_CONCERN",
  "MANUAL_REVIEW",
  "HIGH_RISK",
  "COMPLIANCE_REVIEW",
  "CUSTOM",
] as const;

export type OpsReviewFlagReasonCode = (typeof OPS_REVIEW_FLAG_REASONS)[number];

export const OPS_REVIEW_FLAG_REASON_LABELS: Record<OpsReviewFlagReasonCode, string> = {
  SUSPICIOUS_ACTIVITY: "Suspicious Activity",
  IDENTITY_CONCERN: "Identity Concern",
  MANUAL_REVIEW: "Manual Review",
  HIGH_RISK: "High Risk",
  COMPLIANCE_REVIEW: "Compliance Review",
  CUSTOM: "Custom",
};

export type OpsReviewFlagTargetType =
  | "USER"
  | "COMPANY"
  | "BANK_ACCOUNT"
  | "BANK_TRANSACTION"
  | "LOAN"
  | "ALTA_CARD";

export type OpsReviewFlagRow = {
  id: string;
  targetType: OpsReviewFlagTargetType;
  targetId: string;
  reason: OpsReviewFlagReasonCode;
  reasonLabel: string;
  customReason: string | null;
  status: "ACTIVE" | "RESOLVED";
  createdByUsername: string;
  resolvedByUsername: string | null;
  resolveReason: string | null;
  createdAt: string;
  resolvedAt: string | null;
};
