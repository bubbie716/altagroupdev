import { writeAuditLog } from "@/server/audit.service";
import { auditSourceMetadata } from "@/lib/internal/audit-metadata";
import { sendStaffAuditMessage } from "@/server/staff-audit-notification.service";

type BrandingAuditInput = {
  actorUserId: string;
  companyId: string;
  action:
    | "COMPANY_BRANDING_UPDATED"
    | "COMPANY_BRANDING_LOGO_UPDATED"
    | "COMPANY_BRANDING_RESET"
    | "COMPANY_BRANDING_REJECTED";
  description: string;
  changedFields?: string[];
  reason?: string | null;
  source?: "website" | "admin";
};

export async function writeCompanyBrandingAudit(input: BrandingAuditInput): Promise<void> {
  await writeAuditLog({
    actorUserId: input.actorUserId,
    targetCompanyId: input.companyId,
    action: input.action,
    entityType: "COMPANY",
    entityId: input.companyId,
    description: input.description,
    metadata: auditSourceMetadata(input.source ?? "website", {
      companyId: input.companyId,
      changedFields: input.changedFields ?? [],
      reason: input.reason ?? null,
    }),
  });
}

export async function notifyBrandingRejectedStaffAudit(input: {
  actorUserId: string;
  companyId: string;
  companyName: string;
  reason: string;
}): Promise<void> {
  await sendStaffAuditMessage({
    product: "Alta Commercial",
    action: "Company branding rejected",
    actorUserId: input.actorUserId,
    details: `${input.companyName}: ${input.reason}`,
    internalUrl: `/internal/companies/${input.companyId}`,
    severity: "WARN",
    dedupeKey: `company-branding-rejected:${input.companyId}:${Date.now()}`,
  });
}

export async function notifyBrandingResetStaffAudit(input: {
  actorUserId: string;
  companyId: string;
  companyName: string;
  reason: string;
}): Promise<void> {
  await sendStaffAuditMessage({
    product: "Alta Commercial",
    action: "Company branding reset",
    actorUserId: input.actorUserId,
    details: `${input.companyName}: ${input.reason}`,
    internalUrl: `/internal/companies/${input.companyId}`,
    severity: "INFO",
    dedupeKey: `company-branding-reset:${input.companyId}:${Date.now()}`,
  });
}
