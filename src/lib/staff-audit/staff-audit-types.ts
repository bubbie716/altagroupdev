export type StaffAuditSeverity = "INFO" | "ACTION" | "WARNING" | "CRITICAL";

export type StaffAuditSource = "website" | "discord_bot" | "cron" | "system";

export type StaffAuditProduct =
  | "Alta Bank"
  | "Alta Pay"
  | "Alta Private"
  | "Alta Ops"
  | "Alta Card"
  | "Companies";

export type SendStaffAuditMessageInput = {
  product: StaffAuditProduct;
  action: string;
  actorName?: string;
  actorUserId?: string;
  details?: string | string[];
  internalUrl?: string;
  severity?: StaffAuditSeverity;
  requiresAction?: boolean;
  source?: StaffAuditSource;
  dedupeKey?: string;
};

export type BankingStaffAuditContext = {
  source?: StaffAuditSource;
};
