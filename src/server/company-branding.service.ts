import type { AltaUser } from "@/lib/auth/types";
import { canManageMerchantInvoices, canAccessInternal, canViewMerchantInvoices } from "@/lib/auth/permissions";
import type { CompanyBrandingInput, CompanyBrandingSettingsView } from "@/lib/bank/company-branding-types";
import {
  DEFAULT_ACCENT_COLOR,
  DEFAULT_BRAND_COLOR,
} from "@/lib/bank/company-branding-types";
import {
  mapCompanyBrandingRow,
  resolveCustomerFacingBranding,
} from "@/lib/bank/company-branding-resolve";
import {
  CompanyBrandingValidationError,
  validateCompanyBrandingInput,
} from "@/lib/bank/company-branding-validation";
import type { CompanyLogoFileInput } from "@/lib/storage/company-logo-upload";
import { uploadCompanyLogo } from "@/lib/storage/company-logo-upload";
import {
  notifyBrandingRejectedStaffAudit,
  notifyBrandingResetStaffAudit,
  writeCompanyBrandingAudit,
} from "@/server/company-branding-audit.service";
import {
  canPublishInvoiceBranding,
  mapCommercialPlanSettings,
} from "@/server/commercial-plan.service";
import { prisma } from "@/server/db";
import { mapDbUserToAltaUser, userWithMembershipsInclude } from "@/server/user-mapper";

function badRequest(message: string): never {
  throw new Error(`BAD_REQUEST:${message}`);
}

function forbidden(): never {
  throw new Error("FORBIDDEN");
}

function notFound(): never {
  throw new Error("NOT_FOUND");
}

function validationMessage(error: unknown): string {
  if (error instanceof CompanyBrandingValidationError) return error.message;
  return "Invalid branding settings.";
}

async function loadCompany(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      name: true,
      commercialPlan: true,
      planStatus: true,
      billingStatus: true,
      commercialMonthlyFee: true,
      commercialEnabledFeatures: true,
    },
  });
  if (!company) notFound();
  return company;
}

async function loadBrandingRecord(companyId: string) {
  return prisma.companyBranding.findUnique({ where: { companyId } });
}

function assertCanViewBranding(user: AltaUser, companyId: string): void {
  if (!canViewMerchantInvoices(user, { companyId })) forbidden();
}

function assertCanManageBranding(user: AltaUser, companyId: string): void {
  if (!canManageMerchantInvoices(user, { companyId })) forbidden();
}

async function getAltaUser(userId: string): Promise<AltaUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: userWithMembershipsInclude,
  });
  if (!user) notFound();
  return mapDbUserToAltaUser(user);
}

export async function getCompanyBrandingSettings(
  userId: string,
  companyId: string,
): Promise<CompanyBrandingSettingsView> {
  const user = await getAltaUser(userId);
  assertCanViewBranding(user, companyId);
  const company = await loadCompany(companyId);
  const plan = mapCommercialPlanSettings(company);
  const record = await loadBrandingRecord(companyId);
  const row =
    mapCompanyBrandingRow(companyId, record) ??
    ({
      companyId,
      logoUrl: null,
      brandColor: DEFAULT_BRAND_COLOR,
      accentColor: DEFAULT_ACCENT_COLOR,
      invoiceFooterText: null,
      paymentLinkFooterText: null,
      supportEmail: null,
      supportDiscord: null,
      websiteUrl: null,
      displayNameOverride: null,
      showPoweredByAlta: true,
      rejectedAt: null,
      rejectedReason: null,
      updatedAt: new Date(0).toISOString(),
    } satisfies CompanyBrandingSettingsView);

  const canPublish = canPublishInvoiceBranding(plan);
  const publicBranding = resolveCustomerFacingBranding({
    companyName: company.name,
    plan,
    branding: row.rejectedAt ? null : row,
  });

  return {
    ...row,
    companyName: company.name,
    canPublish,
    canPreview: true,
    isPro: canPublish,
    isCustomAppliedPublicly: publicBranding.isCustomBrandingApplied,
  };
}

export async function updateCompanyBrandingSettings(
  userId: string,
  companyId: string,
  input: CompanyBrandingInput,
): Promise<CompanyBrandingSettingsView> {
  const user = await getAltaUser(userId);
  assertCanManageBranding(user, companyId);
  const company = await loadCompany(companyId);
  const plan = mapCommercialPlanSettings(company);

  if (!canPublishInvoiceBranding(plan)) {
    badRequest("Custom invoice and payment link branding requires Alta Commercial Pro.");
  }

  let validated;
  try {
    validated = validateCompanyBrandingInput(input);
  } catch (error) {
    badRequest(validationMessage(error));
  }

  const existing = await loadBrandingRecord(companyId);
  const changedFields = Object.entries(validated)
    .filter(([key, value]) => {
      const prev = existing?.[key as keyof typeof validated];
      return (prev ?? null) !== value;
    })
    .map(([key]) => key);

  await prisma.companyBranding.upsert({
    where: { companyId },
    create: {
      companyId,
      ...validated,
      showPoweredByAlta: true,
      rejectedAt: null,
      rejectedReason: null,
    },
    update: {
      ...validated,
      showPoweredByAlta: true,
      rejectedAt: null,
      rejectedReason: null,
    },
  });

  if (changedFields.length > 0) {
    await writeCompanyBrandingAudit({
      actorUserId: userId,
      companyId,
      action: "COMPANY_BRANDING_UPDATED",
      description: "Company checkout branding updated.",
      changedFields,
    });
  }

  return getCompanyBrandingSettings(userId, companyId);
}

export async function uploadCompanyBrandingLogo(
  userId: string,
  companyId: string,
  file: CompanyLogoFileInput,
): Promise<CompanyBrandingSettingsView> {
  const user = await getAltaUser(userId);
  assertCanManageBranding(user, companyId);
  const company = await loadCompany(companyId);
  const plan = mapCommercialPlanSettings(company);

  if (!canPublishInvoiceBranding(plan)) {
    badRequest("Custom branding logos require Alta Commercial Pro.");
  }

  const uploaded = await uploadCompanyLogo(companyId, file);
  await prisma.companyBranding.upsert({
    where: { companyId },
    create: {
      companyId,
      logoUrl: uploaded.url,
      logoPathname: uploaded.pathname,
      brandColor: DEFAULT_BRAND_COLOR,
      accentColor: DEFAULT_ACCENT_COLOR,
      showPoweredByAlta: true,
    },
    update: {
      logoUrl: uploaded.url,
      logoPathname: uploaded.pathname,
      rejectedAt: null,
      rejectedReason: null,
    },
  });

  await writeCompanyBrandingAudit({
    actorUserId: userId,
    companyId,
    action: "COMPANY_BRANDING_LOGO_UPDATED",
    description: "Company branding logo updated.",
    changedFields: ["logoUrl"],
  });

  return getCompanyBrandingSettings(userId, companyId);
}

export async function resetCompanyBrandingAdmin(
  actorUserId: string,
  companyId: string,
  reason: string,
): Promise<void> {
  const actor = await getAltaUser(actorUserId);
  if (!canAccessInternal(actor)) forbidden();

  const trimmedReason = reason.trim();
  if (!trimmedReason) badRequest("A reason is required to reset company branding.");

  const company = await loadCompany(companyId);
  const existing = await loadBrandingRecord(companyId);
  if (!existing) return;

  await prisma.companyBranding.update({
    where: { companyId },
    data: {
      logoUrl: null,
      logoPathname: null,
      brandColor: null,
      accentColor: null,
      invoiceFooterText: null,
      paymentLinkFooterText: null,
      supportEmail: null,
      supportDiscord: null,
      websiteUrl: null,
      displayNameOverride: null,
      rejectedAt: null,
      rejectedReason: null,
    },
  });

  await writeCompanyBrandingAudit({
    actorUserId,
    companyId,
    action: "COMPANY_BRANDING_RESET",
    description: "Company branding reset by Alta staff.",
    reason: trimmedReason,
    source: "admin",
  });

  await notifyBrandingResetStaffAudit({
    actorUserId,
    companyId,
    companyName: company.name,
    reason: trimmedReason,
  });
}

export async function rejectCompanyBrandingAdmin(
  actorUserId: string,
  companyId: string,
  reason: string,
): Promise<void> {
  const actor = await getAltaUser(actorUserId);
  if (!canAccessInternal(actor)) forbidden();

  const trimmedReason = reason.trim();
  if (!trimmedReason) badRequest("A reason is required to reject company branding.");

  const company = await loadCompany(companyId);
  const existing = await loadBrandingRecord(companyId);
  if (!existing) badRequest("This company has no branding to reject.");

  await prisma.companyBranding.update({
    where: { companyId },
    data: {
      rejectedAt: new Date(),
      rejectedReason: trimmedReason,
    },
  });

  await writeCompanyBrandingAudit({
    actorUserId,
    companyId,
    action: "COMPANY_BRANDING_REJECTED",
    description: "Company branding rejected by Alta staff.",
    reason: trimmedReason,
    source: "admin",
  });

  await notifyBrandingRejectedStaffAudit({
    actorUserId,
    companyId,
    companyName: company.name,
    reason: trimmedReason,
  });
}

export async function resolveBrandingForMerchantCompany(companyId: string) {
  const company = await loadCompany(companyId);
  const plan = mapCommercialPlanSettings(company);
  const record = await loadBrandingRecord(companyId);
  const row = mapCompanyBrandingRow(companyId, record);
  return resolveCustomerFacingBranding({
    companyName: company.name,
    plan,
    branding: row?.rejectedAt ? null : row,
  });
}

export async function getCompanyBrandingForAdmin(companyId: string) {
  const company = await loadCompany(companyId);
  const plan = mapCommercialPlanSettings(company);
  const record = await loadBrandingRecord(companyId);
  const row = mapCompanyBrandingRow(companyId, record);
  return {
    companyName: company.name,
    plan,
    branding: row,
    publicBranding: resolveCustomerFacingBranding({
      companyName: company.name,
      plan,
      branding: row?.rejectedAt ? null : row,
    }),
  };
}
