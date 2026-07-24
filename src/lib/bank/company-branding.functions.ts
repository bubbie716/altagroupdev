import { createServerFn } from "@tanstack/react-start";
import type { CompanyBrandingInput } from "@/lib/bank/company-branding-types";
import { buildBrandingPreviewInput } from "@/lib/bank/company-branding-validation";
import { resolvePreviewBranding } from "@/lib/bank/company-branding-resolve";

async function actorId(): Promise<string> {
  const { requireAuth } = await import("@/server/auth.service");
  const user = await requireAuth();
  return user.id;
}

export const fetchCompanyBrandingSettings = createServerFn({ method: "GET" })
  .inputValidator((companyId: string) => companyId)
  .handler(async ({ data: companyId }) => {
    const { getCompanyBrandingSettings } = await import("@/server/company-branding.service");
    const userId = await actorId();
    return getCompanyBrandingSettings(userId, companyId);
  });

export const updateCompanyBrandingSettingsRecord = createServerFn({ method: "POST" })
  .inputValidator((input: { companyId: string; branding: CompanyBrandingInput }) => input)
  .handler(async ({ data }) => {
    const { updateCompanyBrandingSettings } = await import("@/server/company-branding.service");
    const userId = await actorId();
    return updateCompanyBrandingSettings(userId, data.companyId, data.branding);
  });

export const previewCompanyBranding = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { companyId: string; companyName: string; branding: CompanyBrandingInput }) => input,
  )
  .handler(async ({ data }) => {
    const userId = await actorId();
    const { getCompanyBrandingSettings } = await import("@/server/company-branding.service");
    await getCompanyBrandingSettings(userId, data.companyId);
    const validated = buildBrandingPreviewInput(data.branding);
    return resolvePreviewBranding({
      companyName: data.companyName,
      branding: null,
      draft: {
        companyId: data.companyId,
        logoUrl: null,
        showPoweredByAlta: true,
        rejectedAt: null,
        rejectedReason: null,
        updatedAt: new Date().toISOString(),
        ...validated,
      },
    });
  });

export const resetCompanyBrandingAdminRecord = createServerFn({ method: "POST" })
  .inputValidator((input: { companyId: string; reason: string }) => input)
  .handler(async ({ data }) => {
    const { resetCompanyBrandingAdmin } = await import("@/server/company-branding.service");
    const userId = await actorId();
    await resetCompanyBrandingAdmin(userId, data.companyId, data.reason);
    return { ok: true as const };
  });

export const rejectCompanyBrandingAdminRecord = createServerFn({ method: "POST" })
  .inputValidator((input: { companyId: string; reason: string }) => input)
  .handler(async ({ data }) => {
    const { rejectCompanyBrandingAdmin } = await import("@/server/company-branding.service");
    const userId = await actorId();
    await rejectCompanyBrandingAdmin(userId, data.companyId, data.reason);
    return { ok: true as const };
  });

export const fetchCompanyBrandingAdminView = createServerFn({ method: "GET" })
  .inputValidator((companyId: string) => companyId)
  .handler(async ({ data: companyId }) => {
    const { getCompanyBrandingForAdmin } = await import("@/server/company-branding.service");
    const { requireAuth } = await import("@/server/auth.service");
    const { canAccessBankInternal } = await import("@/lib/auth/permissions");
    const user = await requireAuth();
    if (!canAccessBankInternal(user)) {
      throw new Error("FORBIDDEN");
    }
    return getCompanyBrandingForAdmin(companyId);
  });
