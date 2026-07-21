import type { NccStaffRole } from "@prisma/client";

/**
 * Dedicated NCC staff permissions — separate from institution participant roles
 * and from broad Alta Group internal platform access.
 */
export type NccStaffPermission =
  | "view_control_plane"
  | "view_health"
  | "view_audit"
  | "manage_staff"
  | "manage_institutions"
  | "emergency_suspend"
  | "emergency_resume"
  | "set_network_mode"
  | "request_network_resume"
  | "approve_network_resume"
  | "review_returns"
  | "approve_return_execution"
  | "manage_exceptions"
  | "initiate_compensation"
  | "manage_liquidity"
  | "approve_liquidity"
  | "review_documents"
  | "manage_reconciliation"
  | "manage_outbox_webhooks"
  | "manage_risk_limits"
  | "override_risk"
  | "manage_alerts"
  | "trigger_workers"
  | "view_readiness";

const ALL: ReadonlySet<NccStaffPermission> = new Set([
  "view_control_plane",
  "view_health",
  "view_audit",
  "manage_staff",
  "manage_institutions",
  "emergency_suspend",
  "emergency_resume",
  "set_network_mode",
  "request_network_resume",
  "approve_network_resume",
  "review_returns",
  "approve_return_execution",
  "manage_exceptions",
  "initiate_compensation",
  "manage_liquidity",
  "approve_liquidity",
  "review_documents",
  "manage_reconciliation",
  "manage_outbox_webhooks",
  "manage_risk_limits",
  "override_risk",
  "manage_alerts",
  "trigger_workers",
  "view_readiness",
]);

const VIEWER: ReadonlySet<NccStaffPermission> = new Set([
  "view_control_plane",
  "view_health",
  "view_readiness",
]);

const AUDITOR: ReadonlySet<NccStaffPermission> = new Set([
  ...VIEWER,
  "view_audit",
]);

const COMPLIANCE: ReadonlySet<NccStaffPermission> = new Set([
  ...AUDITOR,
  "review_documents",
  "manage_alerts",
]);

const SETTLEMENT_OP: ReadonlySet<NccStaffPermission> = new Set([
  ...AUDITOR,
  "manage_exceptions",
  "review_returns",
  "manage_reconciliation",
  "manage_outbox_webhooks",
  "trigger_workers",
]);

const LIQUIDITY_OP: ReadonlySet<NccStaffPermission> = new Set([
  ...AUDITOR,
  "manage_liquidity",
  "manage_alerts",
]);

const SENIOR: ReadonlySet<NccStaffPermission> = new Set([
  ...SETTLEMENT_OP,
  ...LIQUIDITY_OP,
  ...COMPLIANCE,
  "manage_institutions",
  "approve_return_execution",
  "initiate_compensation",
  "approve_liquidity",
  "manage_risk_limits",
  "override_risk",
  "request_network_resume",
  "approve_network_resume",
  "set_network_mode",
]);

const NCC_ADMIN: ReadonlySet<NccStaffPermission> = new Set([
  ...SENIOR,
  "manage_staff",
  "emergency_suspend",
  "emergency_resume",
]);

const EMERGENCY_ADMIN: ReadonlySet<NccStaffPermission> = ALL;

export const NCC_STAFF_ROLE_PERMISSIONS: Record<NccStaffRole, ReadonlySet<NccStaffPermission>> = {
  VIEWER,
  AUDITOR,
  COMPLIANCE_ANALYST: COMPLIANCE,
  SETTLEMENT_OPERATOR: SETTLEMENT_OP,
  LIQUIDITY_OPERATOR: LIQUIDITY_OP,
  SENIOR_APPROVER: SENIOR,
  NCC_ADMINISTRATOR: NCC_ADMIN,
  EMERGENCY_ADMINISTRATOR: EMERGENCY_ADMIN,
};

export function staffRoleHasPermission(
  role: NccStaffRole,
  permission: NccStaffPermission,
): boolean {
  return NCC_STAFF_ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

export const NCC_ADMIN_ROLES: ReadonlySet<NccStaffRole> = new Set([
  "NCC_ADMINISTRATOR",
  "EMERGENCY_ADMINISTRATOR",
]);

export function isNccAdministratorRole(role: NccStaffRole): boolean {
  return NCC_ADMIN_ROLES.has(role);
}

/** Confirmation phrase required for sensitive dual-control / emergency actions. */
export const NCC_SENSITIVE_CONFIRMATION = "CONFIRM NCC ACTION";

export function assertTypedConfirmation(confirmation: string | undefined | null): void {
  if ((confirmation ?? "").trim() !== NCC_SENSITIVE_CONFIRMATION) {
    throw new Error("CONFIRMATION_REQUIRED");
  }
}

/**
 * Step-up / MFA cannot be proven by the current identity system (Discord OAuth session only).
 * Production readiness must treat this as a blocker — do not pretend MFA exists.
 */
export const NCC_STEP_UP_MFA_AVAILABLE = false;
