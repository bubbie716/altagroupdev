import { createServerFn } from "@tanstack/react-start";
import type {
  CreateCompanyInput,
  RemoveMemberInput,
  SendInvitationInput,
  UpdateCompanySettingsInput,
  UpdateMemberRoleInput,
} from "@/lib/company/types";

async function actorId(): Promise<string> {
  const { requireAuth } = await import("@/server/auth.service");
  const user = await requireAuth();
  return user.id;
}

export const fetchUserCompanies = createServerFn({ method: "GET" }).handler(async () => {
  const { listUserCompanies } = await import("@/server/company.service");
  const userId = await actorId();
  return listUserCompanies(userId);
});

export const fetchCompaniesDashboard = createServerFn({ method: "GET" }).handler(async () => {
  const { getCompaniesDashboard } = await import("@/server/company.service");
  const { requireAuth } = await import("@/server/auth.service");
  const user = await requireAuth();
  return getCompaniesDashboard(user.id, user.discordId, user.discordUsername);
});

export const fetchCompanyDetail = createServerFn({ method: "GET" })
  .inputValidator((companyId: string) => companyId)
  .handler(async ({ data: companyId }) => {
    const { getCompanyDetailForUser } = await import("@/server/company.service");
    const userId = await actorId();
    return getCompanyDetailForUser(companyId, userId);
  });

export const createCompanyRecord = createServerFn({ method: "POST" })
  .inputValidator((input: CreateCompanyInput) => input)
  .handler(async ({ data }) => {
    const { createCompany } = await import("@/server/company.service");
    const userId = await actorId();
    return createCompany(userId, data);
  });

export const updateCompanySettingsRecord = createServerFn({ method: "POST" })
  .inputValidator((input: UpdateCompanySettingsInput) => input)
  .handler(async ({ data }) => {
    const { updateCompanySettings } = await import("@/server/company.service");
    const userId = await actorId();
    return updateCompanySettings(userId, data);
  });

export const updateCompanyMemberRole = createServerFn({ method: "POST" })
  .inputValidator((input: UpdateMemberRoleInput) => input)
  .handler(async ({ data }) => {
    const { updateMemberRole } = await import("@/server/company.service");
    const userId = await actorId();
    await updateMemberRole(userId, data);
    return { ok: true as const };
  });

export const removeCompanyMember = createServerFn({ method: "POST" })
  .inputValidator((input: RemoveMemberInput) => input)
  .handler(async ({ data }) => {
    const { removeMember } = await import("@/server/company.service");
    const userId = await actorId();
    await removeMember(userId, data);
    return { ok: true as const };
  });

export const sendCompanyInvitationRecord = createServerFn({ method: "POST" })
  .inputValidator((input: SendInvitationInput) => input)
  .handler(async ({ data }) => {
    const { sendCompanyInvitation } = await import("@/server/company.service");
    const userId = await actorId();
    return sendCompanyInvitation(userId, data);
  });

export const acceptCompanyInvitationRecord = createServerFn({ method: "POST" })
  .inputValidator((invitationId: string) => invitationId)
  .handler(async ({ data: invitationId }) => {
    const { acceptCompanyInvitation } = await import("@/server/company.service");
    const userId = await actorId();
    return acceptCompanyInvitation(userId, invitationId);
  });

export const declineCompanyInvitationRecord = createServerFn({ method: "POST" })
  .inputValidator((invitationId: string) => invitationId)
  .handler(async ({ data: invitationId }) => {
    const { declineCompanyInvitation } = await import("@/server/company.service");
    const userId = await actorId();
    await declineCompanyInvitation(userId, invitationId);
    return { ok: true as const };
  });

export const fetchInternalCompaniesFromDb = createServerFn({ method: "GET" }).handler(async () => {
  const { listInternalCompanies } = await import("@/server/company.service");
  const { requireOperator } = await import("@/server/permissions.service");
  await requireOperator();
  return listInternalCompanies();
});

export const fetchInternalCompanyFromDb = createServerFn({ method: "GET" })
  .inputValidator((companyId: string) => companyId)
  .handler(async ({ data: companyId }) => {
    const { getInternalCompanyDetail } = await import("@/server/company.service");
    const { requireOperator } = await import("@/server/permissions.service");
    const { mapCompanyDetail } = await import("@/server/company-mapper");
    const { fromDbCompanyRole } = await import("@/server/enum-map");
    await requireOperator();
    const company = await getInternalCompanyDetail(companyId);
    if (!company) return null;
    const ownerMembership =
      company.memberships.find((m) => m.role === "OWNER") ?? company.memberships[0];
    const role = ownerMembership ? fromDbCompanyRole(ownerMembership.role) : "viewer";
    return mapCompanyDetail(company, ownerMembership?.userId ?? "", role);
  });

export const verifyCompanyRecord = createServerFn({ method: "POST" })
  .inputValidator((input: { companyId: string; reviewNote?: string }) => input)
  .handler(async ({ data }) => {
    const { verifyCompany } = await import("@/server/company.service");
    const { requireOperator } = await import("@/server/permissions.service");
    const admin = await requireOperator();
    await verifyCompany(admin.id, data.companyId, data.reviewNote);
    return { ok: true as const };
  });

export const rejectCompanyVerificationRecord = createServerFn({ method: "POST" })
  .inputValidator((input: { companyId: string; reviewNote?: string }) => input)
  .handler(async ({ data }) => {
    const { rejectCompanyVerification } = await import("@/server/company.service");
    const { requireOperator } = await import("@/server/permissions.service");
    const admin = await requireOperator();
    await rejectCompanyVerification(admin.id, data.companyId, data.reviewNote);
    return { ok: true as const };
  });

export const revokeCompanyVerificationRecord = createServerFn({ method: "POST" })
  .inputValidator((input: { companyId: string; reviewNote?: string }) => input)
  .handler(async ({ data }) => {
    const { revokeCompanyVerification } = await import("@/server/company.service");
    const { requireOperator } = await import("@/server/permissions.service");
    const admin = await requireOperator();
    await revokeCompanyVerification(admin.id, data.companyId, data.reviewNote);
    return { ok: true as const };
  });
