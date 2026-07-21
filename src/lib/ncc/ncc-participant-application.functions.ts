import { createServerFn } from "@tanstack/react-start";
import type { FinancialInstitutionType, NccParticipantApplicationStatus } from "@prisma/client";
import type { ApplicationWritableFields } from "@/server/ncc/ncc-participant-application.service";

function asWritable(input: ApplicationWritableFields): ApplicationWritableFields {
  return input;
}

export const createParticipantApplicationDraft = createServerFn({ method: "POST" })
  .inputValidator((input: ApplicationWritableFields) => asWritable(input))
  .handler(async ({ data }) => {
    const { createDraftApplication } = await import(
      "@/server/ncc/ncc-participant-application.service"
    );
    return createDraftApplication(data);
  });

export const saveParticipantApplicationDraft = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string } & ApplicationWritableFields) => input)
  .handler(async ({ data }) => {
    const { saveDraftApplication } = await import(
      "@/server/ncc/ncc-participant-application.service"
    );
    const { id, ...fields } = data;
    return saveDraftApplication(id, fields);
  });

export const submitParticipantApplication = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const { submitApplication } = await import(
      "@/server/ncc/ncc-participant-application.service"
    );
    return submitApplication(data.id);
  });

export const respondParticipantInformationRequest = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { id: string; responseNote: string; fields?: ApplicationWritableFields }) => input,
  )
  .handler(async ({ data }) => {
    const { respondToInformationRequest } = await import(
      "@/server/ncc/ncc-participant-application.service"
    );
    return respondToInformationRequest(data.id, data.responseNote, data.fields);
  });

export const withdrawParticipantApplication = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string; reason?: string }) => input)
  .handler(async ({ data }) => {
    const { withdrawApplication } = await import(
      "@/server/ncc/ncc-participant-application.service"
    );
    return withdrawApplication(data.id, data.reason);
  });

export const listMyParticipantApplications = createServerFn({ method: "GET" }).handler(async () => {
  const { listApplicantApplications } = await import(
    "@/server/ncc/ncc-participant-application.service"
  );
  return listApplicantApplications();
});

export const fetchMyParticipantApplication = createServerFn({ method: "GET" })
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const { getApplicantApplication } = await import(
      "@/server/ncc/ncc-participant-application.service"
    );
    return getApplicantApplication(data.id);
  });

/** Staff gate for portal routes — RPC-safe (do not import server permissions from client routes). */
export const requireNccStaffAccess = createServerFn({ method: "GET" }).handler(async () => {
  const { requireNccStaff } = await import("@/server/ncc/ncc-permissions.service");
  const staff = await requireNccStaff();
  return { id: staff.id };
});

export const listStaffParticipantApplications = createServerFn({ method: "GET" })
  .inputValidator((input?: { status?: NccParticipantApplicationStatus }) => input ?? {})
  .handler(async ({ data }) => {
    const { listStaffApplications } = await import(
      "@/server/ncc/ncc-participant-application.service"
    );
    return listStaffApplications({ status: data.status });
  });

export const fetchStaffParticipantApplication = createServerFn({ method: "GET" })
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const { getStaffApplicationDetail } = await import(
      "@/server/ncc/ncc-participant-application.service"
    );
    return getStaffApplicationDetail(data.id);
  });

export const staffTransitionParticipantApplication = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      id: string;
      toStatus: NccParticipantApplicationStatus;
      reason?: string;
      informationRequestNote?: string;
    }) => input,
  )
  .handler(async ({ data }) => {
    const { staffTransitionApplication } = await import(
      "@/server/ncc/ncc-participant-application.service"
    );
    return staffTransitionApplication(data);
  });

export const staffAddParticipantApplicationNote = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string; body: string }) => input)
  .handler(async ({ data }) => {
    const { addStaffInternalNote } = await import(
      "@/server/ncc/ncc-participant-application.service"
    );
    return addStaffInternalNote(data.id, data.body);
  });

export type { FinancialInstitutionType };
