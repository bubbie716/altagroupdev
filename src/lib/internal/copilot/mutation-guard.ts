/**
 * Detect mutation / financial-change requests. Phase 2 never executes them.
 */
import type { AdminCopilotUnavailableActionIntent } from "@/lib/internal/copilot/types";

const MUTATION_PATTERNS: RegExp[] = [
  /\b(give|grant|send|transfer|wire|credit|debit|fund|top\s*up|deposit\s+into)\b.{0,40}\b(\d|ƒ|florin|k\b|thousand|million)/i,
  /\b(approve|deny|reject|freeze|unfreeze|cancel|void|reverse|adjust|write\s*off)\b.{0,40}\b(loan|transfer|deposit|withdrawal|order|application|card|account)/i,
  /\b(create|open|close|delete|remove|mutate|update|set)\b.{0,30}\b(account|loan|transfer|portfolio|order|card)\b/i,
  /\b(pay\s+off|disburse|liquidate|force\s+fill)\b/i,
];

export function detectMutationRequest(text: string): AdminCopilotUnavailableActionIntent | null {
  const t = text.trim();
  if (!t) return null;
  if (!MUTATION_PATTERNS.some((re) => re.test(t))) return null;
  return {
    kind: "unavailable_action",
    actionCategory: "financial_mutation",
    summary: t.slice(0, 160),
  };
}

export function readOnlyMutationBlockedMessage(): string {
  return "Admin Copilot is read-only in this phase. Financial and administrative changes are not executed. Use the normal internal workspaces with confirmation when you need to mutate records.";
}
