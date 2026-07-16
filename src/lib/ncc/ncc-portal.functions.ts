import { createServerFn } from "@tanstack/react-start";

export const fetchPortalContext = createServerFn({ method: "GET" })
  .inputValidator((input?: { institutionId?: string }) => input ?? {})
  .handler(async ({ data }) => {
    const { resolvePortalInstitutionId } = await import("@/server/ncc/ncc-portal.service");
    const institutionId = await resolvePortalInstitutionId(data.institutionId);
    return { institutionId };
  });

export const fetchPortalShell = createServerFn({ method: "GET" })
  .inputValidator((input?: { institutionId?: string }) => input ?? {})
  .handler(async ({ data }) => {
    const { resolvePortalInstitutionId, getPortalShell, listPortalInstitutions } = await import(
      "@/server/ncc/ncc-portal.service"
    );
    const institutionId = await resolvePortalInstitutionId(data.institutionId);
    const [shell, institutions] = await Promise.all([
      getPortalShell(institutionId),
      listPortalInstitutions(),
    ]);
    return { ...shell, institutions };
  });

export const switchPortalInstitutionRecord = createServerFn({ method: "POST" })
  .inputValidator((input: { institutionId: string }) => input)
  .handler(async ({ data }) => {
    const { switchPortalInstitution } = await import("@/server/ncc/ncc-portal.service");
    return switchPortalInstitution(data.institutionId);
  });

export const fetchPortalDashboard = createServerFn({ method: "GET" })
  .inputValidator((input?: { institutionId?: string }) => input ?? {})
  .handler(async ({ data }) => {
    const { resolvePortalInstitutionId, getPortalDashboard } = await import(
      "@/server/ncc/ncc-portal.service"
    );
    const institutionId = await resolvePortalInstitutionId(data.institutionId);
    return getPortalDashboard(institutionId);
  });

export const fetchPortalSettlements = createServerFn({ method: "GET" })
  .inputValidator(
    (input: {
      institutionId?: string;
      status?: string | string[];
      q?: string;
      queueOnly?: boolean;
      limit?: number;
      offset?: number;
    }) => input,
  )
  .handler(async ({ data }) => {
    const { resolvePortalInstitutionId, listPortalSettlements } = await import(
      "@/server/ncc/ncc-portal.service"
    );
    const institutionId = await resolvePortalInstitutionId(data.institutionId);
    return listPortalSettlements(institutionId, data);
  });

export const fetchPortalSettlementDetail = createServerFn({ method: "GET" })
  .inputValidator((input: { institutionId?: string; instructionId: string }) => input)
  .handler(async ({ data }) => {
    const { resolvePortalInstitutionId, getPortalSettlementDetail } = await import(
      "@/server/ncc/ncc-portal.service"
    );
    const institutionId = await resolvePortalInstitutionId(data.institutionId);
    return getPortalSettlementDetail(institutionId, data.instructionId);
  });

export const fetchPortalRouting = createServerFn({ method: "GET" })
  .inputValidator((input?: { institutionId?: string }) => input ?? {})
  .handler(async ({ data }) => {
    const { resolvePortalInstitutionId, listPortalRouting } = await import(
      "@/server/ncc/ncc-portal.service"
    );
    const institutionId = await resolvePortalInstitutionId(data.institutionId);
    return listPortalRouting(institutionId);
  });

export const fetchPortalMembers = createServerFn({ method: "GET" })
  .inputValidator((input?: { institutionId?: string }) => input ?? {})
  .handler(async ({ data }) => {
    const { resolvePortalInstitutionId, listPortalMembers } = await import(
      "@/server/ncc/ncc-portal.service"
    );
    const institutionId = await resolvePortalInstitutionId(data.institutionId);
    return listPortalMembers(institutionId);
  });

export const fetchPortalAccount = createServerFn({ method: "GET" })
  .inputValidator((input?: { institutionId?: string }) => input ?? {})
  .handler(async ({ data }) => {
    const { resolvePortalInstitutionId, getPortalAccountSummary } = await import(
      "@/server/ncc/ncc-portal.service"
    );
    const institutionId = await resolvePortalInstitutionId(data.institutionId);
    return getPortalAccountSummary(institutionId);
  });

export const fetchPortalReports = createServerFn({ method: "GET" })
  .inputValidator((input?: { institutionId?: string }) => input ?? {})
  .handler(async ({ data }) => {
    const { resolvePortalInstitutionId, getPortalReports } = await import(
      "@/server/ncc/ncc-portal.service"
    );
    const institutionId = await resolvePortalInstitutionId(data.institutionId);
    return getPortalReports(institutionId);
  });

export const fetchPortalAudit = createServerFn({ method: "GET" })
  .inputValidator((input?: { institutionId?: string; q?: string; limit?: number }) => input ?? {})
  .handler(async ({ data }) => {
    const { resolvePortalInstitutionId, listPortalAudit } = await import(
      "@/server/ncc/ncc-portal.service"
    );
    const institutionId = await resolvePortalInstitutionId(data.institutionId);
    return listPortalAudit(institutionId, data);
  });

export const fetchPortalSearch = createServerFn({ method: "GET" })
  .inputValidator((input: { institutionId?: string; q: string }) => input)
  .handler(async ({ data }) => {
    const { resolvePortalInstitutionId, searchPortal } = await import(
      "@/server/ncc/ncc-portal.service"
    );
    const institutionId = await resolvePortalInstitutionId(data.institutionId);
    return searchPortal(institutionId, data.q);
  });

export const portalCancelSettlement = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { institutionId?: string; instructionId: string; reason: string }) => input,
  )
  .handler(async ({ data }) => {
    const { resolvePortalInstitutionId } = await import("@/server/ncc/ncc-portal.service");
    const { cancelInstitutionInstruction } = await import("@/server/ncc/ncc-institution.service");
    const institutionId = await resolvePortalInstitutionId(data.institutionId);
    return cancelInstitutionInstruction(institutionId, data.instructionId, data.reason);
  });
