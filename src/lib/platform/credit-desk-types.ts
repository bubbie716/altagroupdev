export const PLATFORM_SETTING_KEYS = {
  creditDeskStatus: "creditDeskStatus",
  creditDeskClosedAt: "creditDeskClosedAt",
  creditDeskUpdatedById: "creditDeskUpdatedById",
} as const;

export type CreditDeskStatus = "open" | "closed";

export type CreditDeskState = {
  status: CreditDeskStatus;
  closedAt: string | null;
  updatedAt: string | null;
  updatedById: string | null;
  updatedByUsername: string | null;
};

export type CreditDeskSettings = CreditDeskState & {
  canEdit: boolean;
};

export type CreditDeskCustomerNav = {
  creditDeskClosed: boolean;
  showLendingNav: boolean;
  showAltaCardNav: boolean;
  showApplyEntryPoints: boolean;
};
