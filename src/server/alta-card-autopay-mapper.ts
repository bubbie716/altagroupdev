import type { AltaCardAutopayStatus, AltaCardAutopayType } from "@prisma/client";
import type {
  AltaCardAutopayStatusCode,
  AltaCardAutopayTypeCode,
} from "@/lib/bank/alta-card-autopay-types";

export function toAltaCardAutopayTypeCode(type: AltaCardAutopayType): AltaCardAutopayTypeCode {
  switch (type) {
    case "MINIMUM_PAYMENT":
      return "minimum_payment";
    case "STATEMENT_BALANCE":
      return "statement_balance";
    case "FIXED_AMOUNT":
      return "fixed_amount";
  }
}

export function toAltaCardAutopayStatusCode(status: AltaCardAutopayStatus): AltaCardAutopayStatusCode {
  switch (status) {
    case "NOT_RUN":
      return "not_run";
    case "SUCCESS":
      return "success";
    case "FAILED":
      return "failed";
    case "SKIPPED":
      return "skipped";
  }
}

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
      return "Success";
    case "failed":
      return "Failed";
    case "skipped":
      return "Skipped";
  }
}
