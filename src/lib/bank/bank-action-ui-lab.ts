/**
 * Deterministic UI Lab mock outcomes for Bank action flows.
 * Never mutates production data or calls Discord/payment services.
 */
import { isUiLabMode } from "@/lib/auth/ui-lab";
import type { BankRequestSubmissionResult } from "@/components/bank/bank-request-submission-ui";
import type { PayableRecipient } from "@/lib/bank/alta-pay-types";
import type { MerchantInvoiceRecipientOption } from "@/lib/bank/merchant-invoice-types";
import {
  searchUiLabInvoiceRecipients,
  searchUiLabPayableRecipients,
  UI_LAB_PAYABLE_RECIPIENTS,
} from "@/lib/bank/ui-lab-commercial-fixtures";

export type BankActionUiLabScenario =
  | "success"
  | "pending_review"
  | "validation_error"
  | "server_error"
  | "idempotent_replay";

const SCENARIO_STORAGE_KEY = "alta.bank.action.uiLabScenario";

/** @deprecated Prefer UI_LAB_PAYABLE_RECIPIENTS from ui-lab-commercial-fixtures. */
export const UI_LAB_RECIPIENTS: PayableRecipient[] = UI_LAB_PAYABLE_RECIPIENTS;

export function getBankActionUiLabScenario(): BankActionUiLabScenario {
  if (!isUiLabMode() || typeof window === "undefined") return "success";
  try {
    const raw = window.sessionStorage.getItem(SCENARIO_STORAGE_KEY);
    if (
      raw === "pending_review" ||
      raw === "validation_error" ||
      raw === "server_error" ||
      raw === "idempotent_replay"
    ) {
      return raw;
    }
  } catch {
    /* ignore */
  }
  return "success";
}

export function setBankActionUiLabScenario(scenario: BankActionUiLabScenario): void {
  if (!isUiLabMode() || typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(SCENARIO_STORAGE_KEY, scenario);
  } catch {
    /* ignore */
  }
}

export function shouldUseBankActionUiLabMock(): boolean {
  return isUiLabMode();
}

export function getUiLabPayableRecipients(query: string): PayableRecipient[] {
  return searchUiLabPayableRecipients(query);
}

/** UI Lab invoice recipients (people + verified companies), same catalog as Alta Pay. */
export function getUiLabInvoiceRecipients(query: string): MerchantInvoiceRecipientOption[] {
  return searchUiLabInvoiceRecipients(query);
}

export function mockBankActionSubmission(options: {
  kind: string;
  amount: number;
  accountName?: string;
  accountNumber?: string;
}): BankRequestSubmissionResult {
  const scenario = getBankActionUiLabScenario();
  if (scenario === "validation_error") {
    throw new Error("UI Lab: Please check the amount and try again.");
  }
  if (scenario === "server_error") {
    throw new Error("UI Lab: Temporary server issue. Your entries were preserved.");
  }
  const suffix = scenario === "idempotent_replay" ? "REPLAY" : "LAB";
  return {
    referenceCode: `UI-${options.kind.toUpperCase().slice(0, 3)}-${suffix}`,
    amount: options.amount,
    submittedAt: new Date().toISOString(),
    accountName: options.accountName ?? "UI Lab Checking",
    accountNumber: options.accountNumber ?? "AB-5000-000001",
  };
}
