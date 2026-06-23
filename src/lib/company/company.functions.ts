import { createServerFn } from "@tanstack/react-start";
import type {
  AddMemberInput,
  CreateCompanyInput,
  RemoveMemberInput,
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

export const fetchCompanyDetail = createServerFn({ method: "GET" })
  .validator((companyId: string) => companyId)
  .handler(async ({ data: companyId }) => {
    const { getCompanyDetailForUser } = await import("@/server/company.service");
    const userId = await actorId();
    return getCompanyDetailForUser(companyId, userId);
  });

export const createCompanyRecord = createServerFn({ method: "POST" })
  .validator((input: CreateCompanyInput) => input)
  .handler(async ({ data }) => {
    const { createCompany } = await import("@/server/company.service");
    const userId = await actorId();
    return createCompany(userId, data);
  });

export const updateCompanySettingsRecord = createServerFn({ method: "POST" })
  .validator((input: UpdateCompanySettingsInput) => input)
  .handler(async ({ data }) => {
    const { updateCompanySettings } = await import("@/server/company.service");
    const userId = await actorId();
    return updateCompanySettings(userId, data);
  });

export const updateCompanyMemberRole = createServerFn({ method: "POST" })
  .validator((input: UpdateMemberRoleInput) => input)
  .handler(async ({ data }) => {
    const { updateMemberRole } = await import("@/server/company.service");
    const userId = await actorId();
    await updateMemberRole(userId, data);
    return { ok: true as const };
  });

export const removeCompanyMember = createServerFn({ method: "POST" })
  .validator((input: RemoveMemberInput) => input)
  .handler(async ({ data }) => {
    const { removeMember } = await import("@/server/company.service");
    const userId = await actorId();
    await removeMember(userId, data);
    return { ok: true as const };
  });

export const addCompanyMemberByDiscord = createServerFn({ method: "POST" })
  .validator((input: AddMemberInput) => input)
  .handler(async ({ data }) => {
    const { addMemberByDiscord } = await import("@/server/company.service");
    const userId = await actorId();
    return addMemberByDiscord(userId, data);
  });

export const fetchInternalCompaniesFromDb = createServerFn({ method: "GET" }).handler(async () => {
  const { listInternalCompanies } = await import("@/server/company.service");
  const { requireOperator } = await import("@/server/permissions.service");
  await requireOperator();
  return listInternalCompanies();
});

export const fetchInternalCompanyFromDb = createServerFn({ method: "GET" })
  .validator((companyId: string) => companyId)
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
