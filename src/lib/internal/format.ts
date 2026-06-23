import type { CompanyRole } from "@/lib/internal/types";

const roleLabels: Record<CompanyRole, string> = {
  owner: "Owner",
  executive: "Executive",
  finance_manager: "Finance Manager",
  compliance_contact: "Compliance Contact",
  viewer: "Viewer",
};

export function formatCompanyRole(role: CompanyRole): string {
  return roleLabels[role];
}
