import type { CompanyRole } from "@/lib/auth/types";

export type BusinessAccountModule =
  | "overview"
  | "activity"
  | "payments"
  | "invoices"
  | "payroll"
  | "statements"
  | "representatives"
  | "settings";

export type BusinessModuleAccess = "none" | "view" | "manage";

const MODULE_MATRIX: Record<CompanyRole, Record<BusinessAccountModule, BusinessModuleAccess>> = {
  owner: {
    overview: "manage",
    activity: "manage",
    payments: "manage",
    invoices: "manage",
    payroll: "manage",
    statements: "manage",
    representatives: "manage",
    settings: "manage",
  },
  executive: {
    overview: "manage",
    activity: "manage",
    payments: "manage",
    invoices: "manage",
    payroll: "manage",
    statements: "manage",
    representatives: "manage",
    settings: "view",
  },
  finance_manager: {
    overview: "view",
    activity: "view",
    payments: "manage",
    invoices: "manage",
    payroll: "manage",
    statements: "manage",
    representatives: "view",
    settings: "none",
  },
  compliance_contact: {
    overview: "view",
    activity: "view",
    payments: "none",
    invoices: "view",
    payroll: "none",
    statements: "view",
    representatives: "view",
    settings: "none",
  },
  viewer: {
    overview: "view",
    activity: "view",
    payments: "none",
    invoices: "none",
    payroll: "none",
    statements: "none",
    representatives: "none",
    settings: "none",
  },
};

export function getBusinessModuleAccess(
  role: CompanyRole,
  module: BusinessAccountModule,
): BusinessModuleAccess {
  return MODULE_MATRIX[role][module];
}

export function canAccessBusinessModule(role: CompanyRole, module: BusinessAccountModule): boolean {
  return getBusinessModuleAccess(role, module) !== "none";
}

export function canManageBusinessModule(role: CompanyRole, module: BusinessAccountModule): boolean {
  return getBusinessModuleAccess(role, module) === "manage";
}

export const BUSINESS_ACCOUNT_MODULES: BusinessAccountModule[] = [
  "overview",
  "activity",
  "payments",
  "invoices",
  "payroll",
  "statements",
  "representatives",
  "settings",
];

export const PERSONAL_ACCOUNT_MODULES = [
  "overview",
  "activity",
  "deposit",
  "withdraw",
  "statements",
  "settings",
] as const;

export type PersonalAccountModule = (typeof PERSONAL_ACCOUNT_MODULES)[number];
