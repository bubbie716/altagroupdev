export type AltaCardAutopayTypeCode = "minimum_payment" | "statement_balance" | "fixed_amount";

export type AltaCardAutopayStatusCode = "not_run" | "success" | "failed" | "skipped";

export type AltaCardAutopaySettings = {
  enabled: boolean;
  sourceAccountId: string | null;
  sourceAccountLabel: string | null;
  type: AltaCardAutopayTypeCode | null;
  fixedAmount: number | null;
  lastRunAt: string | null;
  lastStatus: AltaCardAutopayStatusCode;
  failureReason: string | null;
  canManage: boolean;
};

export type UpdateAltaCardAutopayInput = {
  enabled?: boolean;
  sourceAccountId?: string;
  type?: AltaCardAutopayTypeCode;
  fixedAmount?: number;
};

export type AltaCardAutopayAuditRow = {
  id: string;
  action: string;
  description: string;
  actorUsername: string;
  createdAt: string;
  metadata: Record<string, unknown> | null;
};

export type AltaCardAutopaySourceAccountOption = {
  id: string;
  accountName: string;
  accountNumber: string;
  availableBalance: number;
};

export type AltaCardAutopayContext = {
  settings: AltaCardAutopaySettings;
  sourceAccounts: AltaCardAutopaySourceAccountOption[];
};

export function altaCardAutopayTypeLabel(type: AltaCardAutopayTypeCode | null): string {
  switch (type) {
    case "minimum_payment":
      return "Minimum payment";
    case "statement_balance":
      return "Statement balance";
    case "fixed_amount":
      return "Fixed amount";
    default:
      return "—";
  }
}

export function altaCardAutopayStatusLabel(status: AltaCardAutopayStatusCode): string {
  switch (status) {
    case "not_run":
      return "Not run";
    case "success":
      return "Payment processed";
    case "failed":
      return "Payment not processed";
    case "skipped":
      return "Skipped";
  }
}
