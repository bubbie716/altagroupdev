import { resolvePublicLinkUrl } from "@/lib/discord/notification-dm";
import { sanitizeStaffAuditDetails } from "@/lib/staff-audit/staff-audit-privacy";
import type {
  SendStaffAuditMessageInput,
  StaffAuditSeverity,
  StaffAuditSource,
} from "@/lib/staff-audit/staff-audit-types";

export function buildStaffAuditViewLink(internalUrl?: string): string | null {
  const trimmed = internalUrl?.trim();
  if (!trimmed) return null;
  return resolvePublicLinkUrl(trimmed) ?? trimmed;
}

export function formatStaffAuditAction(action: string, source?: StaffAuditSource): string {
  const trimmed = action.trim();
  if (!trimmed) return "Action recorded";
  if (source === "discord_bot") {
    return trimmed.toLowerCase().includes("via discord") ? trimmed : `${trimmed} via Discord`;
  }
  return trimmed;
}

export function formatStaffAuditMessage(
  input: SendStaffAuditMessageInput & { actorLabel: string },
): string {
  const severity: StaffAuditSeverity = input.severity ?? "INFO";
  const action = formatStaffAuditAction(input.action, input.source);
  const segments = [
    `[${severity}]`,
    `[${input.product}]`,
    `${action} — ${input.actorLabel}`,
  ];

  const details = sanitizeStaffAuditDetails(input.details);
  if (details) {
    segments.push(`— ${details}`);
  }

  const viewLink = buildStaffAuditViewLink(input.internalUrl);
  if (viewLink) {
    segments.push(`— View: ${viewLink}`);
  }

  return segments.join(" ").slice(0, 2000);
}
