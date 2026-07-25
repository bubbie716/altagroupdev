/**
 * Deterministic UI Lab mock outcomes for Bank action flows.
 * Never mutates production data or calls Discord/payment services.
 */
import { isUiLabMode } from "@/lib/auth/ui-lab";
import type { BankRequestSubmissionResult } from "@/components/bank/bank-request-submission-ui";
import type { PayableRecipient } from "@/lib/bank/alta-pay-types";

export type BankActionUiLabScenario =
  | "success"
  | "pending_review"
  | "validation_error"
  | "server_error"
  | "idempotent_replay";

const SCENARIO_STORAGE_KEY = "alta.bank.action.uiLabScenario";

const UI_LAB_RECIPIENTS: PayableRecipient[] = [
  {
    kind: "person",
    id: "ui-lab-person-ava",
    name: "Ava Chen",
    subtitle: "@ava",
    destinationLabel: "Personal · AB-5000-100001",
    canReceive: true,
  },
  {
    kind: "person",
    id: "ui-lab-person-noah",
    name: "Noah Patel",
    subtitle: "@noah",
    destinationLabel: "Personal · AB-5000-100002",
    canReceive: true,
  },
  {
    kind: "company",
    id: "CO-ALTG",
    name: "Alta Group N.V.",
    subtitle: "Verified company · ALTG",
    destinationLabel: "Business Operating · AB-3500-200001",
    canReceive: true,
  },
  {
    kind: "company",
    id: "CO-NPC",
    name: "Newport Petroleum Corp.",
    subtitle: "Verified company · NPC",
    destinationLabel: "Business Operating · AB-3500-200002",
    canReceive: true,
  },
];

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
  const q = query.trim().toLowerCase();
  if (!q) return [];
  if (q === "zzz" || q === "no-match") return [];
  return UI_LAB_RECIPIENTS.filter(
    (recipient) =>
      recipient.name.toLowerCase().includes(q) ||
      recipient.subtitle?.toLowerCase().includes(q) ||
      recipient.id.toLowerCase().includes(q),
  );
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
