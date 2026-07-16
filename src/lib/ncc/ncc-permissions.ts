import type { InstitutionMemberRole } from "@prisma/client";

export type NccInstitutionPermission =
  | "view_institution"
  | "view_routing_numbers"
  | "view_settlement_accounts"
  | "submit_settlement"
  | "cancel_settlement"
  | "request_reversal"
  | "approve_reversal"
  | "manage_members"
  | "view_audit"
  | "manage_api_credentials"
  | "view_api_credentials"
  | "manage_webhooks"
  | "view_webhooks"
  | "view_api_logs";

const ROLE_PERMISSIONS: Record<InstitutionMemberRole, ReadonlySet<NccInstitutionPermission>> = {
  INSTITUTION_OWNER: new Set([
    "view_institution",
    "view_routing_numbers",
    "view_settlement_accounts",
    "submit_settlement",
    "cancel_settlement",
    "request_reversal",
    "approve_reversal",
    "manage_members",
    "view_audit",
    "manage_api_credentials",
    "view_api_credentials",
    "manage_webhooks",
    "view_webhooks",
    "view_api_logs",
  ]),
  INSTITUTION_ADMIN: new Set([
    "view_institution",
    "view_routing_numbers",
    "view_settlement_accounts",
    "submit_settlement",
    "cancel_settlement",
    "request_reversal",
    "approve_reversal",
    "manage_members",
    "view_audit",
    "manage_api_credentials",
    "view_api_credentials",
    "manage_webhooks",
    "view_webhooks",
    "view_api_logs",
  ]),
  SETTLEMENT_MANAGER: new Set([
    "view_institution",
    "view_routing_numbers",
    "view_settlement_accounts",
    "submit_settlement",
    "cancel_settlement",
    "request_reversal",
    "approve_reversal",
    "view_audit",
    "view_api_credentials",
    "view_webhooks",
    "view_api_logs",
  ]),
  SETTLEMENT_OPERATOR: new Set([
    "view_institution",
    "view_routing_numbers",
    "view_settlement_accounts",
    "submit_settlement",
    "cancel_settlement",
    "view_audit",
    "view_webhooks",
    "view_api_logs",
  ]),
  AUDITOR: new Set([
    "view_institution",
    "view_routing_numbers",
    "view_settlement_accounts",
    "view_audit",
    "view_api_logs",
    "view_webhooks",
  ]),
  VIEWER: new Set([
    "view_institution",
    "view_routing_numbers",
    "view_settlement_accounts",
  ]),
};

export function institutionRoleHasPermission(
  role: InstitutionMemberRole,
  permission: NccInstitutionPermission,
): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

/** Institutions that may originate new settlement instructions. */
export function canInstitutionOriginateSettlement(status: string): boolean {
  return status === "ACTIVE";
}

/** Institutions that may receive settlement credits. */
export function canInstitutionReceiveSettlement(status: string): boolean {
  return status === "ACTIVE" || status === "RESTRICTED";
}

export function isRoutingNumberUsable(status: string): boolean {
  return status === "ACTIVE";
}
