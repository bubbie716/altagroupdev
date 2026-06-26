import { createServerFn } from "@tanstack/react-start";
import type {
  InternalAltaCardApplicationFilters,
} from "@/lib/bank/alta-card-types";
import type {
  SendAltaCardThreadMessageInput,
  UpdateAltaCardThreadStatusInput,
  AssignAltaCardThreadStaffInput,
} from "@/lib/bank/alta-card-application-thread-types";

export const fetchAltaCardApplicationDetail = createServerFn({ method: "GET" })
  .inputValidator((applicationId: string) => applicationId)
  .handler(async ({ data: applicationId }) => {
    const { requireAuth } = await import("@/server/auth.service");
    const { getAltaCardApplicationDetail } = await import("@/server/alta-card.service");
    const user = await requireAuth();
    return getAltaCardApplicationDetail(user.id, applicationId);
  });

export const fetchUserPendingAltaCardApplication = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAuth } = await import("@/server/auth.service");
  const { getUserPendingAltaCardApplication } = await import("@/server/alta-card-application.service");
  const user = await requireAuth();
  return getUserPendingAltaCardApplication(user.id);
});

export const acceptAltaCardApplicationRecord = createServerFn({ method: "POST" })
  .inputValidator((applicationId: string) => applicationId)
  .handler(async ({ data: applicationId }) => {
    const { requireAuth } = await import("@/server/auth.service");
    const { acceptAltaCardApplication } = await import("@/server/alta-card.service");
    const user = await requireAuth();
    return acceptAltaCardApplication(user.id, applicationId);
  });

export const updateAltaCardApplicationStatusRecord = createServerFn({ method: "POST" })
  .inputValidator((input: { applicationId: string; status: import("@/lib/bank/alta-card-types").AltaCardApplicationStatusCode }) => input)
  .handler(async ({ data }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { updateAltaCardApplicationStatus } = await import("@/server/alta-card.service");
    const staff = await requireOperator();
    return updateAltaCardApplicationStatus(staff.id, data.applicationId, data.status);
  });

export const fetchInternalAltaCardApplicationDetail = createServerFn({ method: "GET" })
  .inputValidator((applicationId: string) => applicationId)
  .handler(async ({ data: applicationId }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    const staff = await requireOperator();
    const { getInternalAltaCardApplicationReviewContext } = await import("@/server/alta-card.service");
    return getInternalAltaCardApplicationReviewContext(staff.id, applicationId);
  });

export const fetchInternalAltaCardApplicationsFiltered = createServerFn({ method: "GET" })
  .inputValidator((filters: InternalAltaCardApplicationFilters) => filters)
  .handler(async ({ data: filters }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    await requireOperator();
    const { listInternalAltaCardApplicationsFiltered } = await import(
      "@/server/alta-card-application.service"
    );
    return listInternalAltaCardApplicationsFiltered(filters);
  });

export const fetchAltaCardApplicationThreadContext = createServerFn({ method: "GET" })
  .inputValidator((input: { applicationId: string; variant: "user" | "internal" }) => input)
  .handler(async ({ data }) => {
    const { ensureThreadExists, getAltaCardThreadContext } = await import(
      "@/server/alta-card-application-thread.service"
    );
    const { requireAuth } = await import("@/server/auth.service");
    const user = await requireAuth();
    await ensureThreadExists(user.id, data.applicationId);
    return getAltaCardThreadContext(user.id, data.applicationId, data.variant);
  });

export const fetchAltaCardApplicationThreadMessages = createServerFn({ method: "GET" })
  .inputValidator((applicationId: string) => applicationId)
  .handler(async ({ data: applicationId }) => {
    const { ensureThreadExists, getAltaCardThreadMessages } = await import(
      "@/server/alta-card-application-thread.service"
    );
    const { requireAuth } = await import("@/server/auth.service");
    const user = await requireAuth();
    await ensureThreadExists(user.id, applicationId);
    return getAltaCardThreadMessages(user.id, applicationId);
  });

export const sendAltaCardApplicationThreadMessage = createServerFn({ method: "POST" })
  .inputValidator((input: SendAltaCardThreadMessageInput) => input)
  .handler(async ({ data }) => {
    const { requireAuth } = await import("@/server/auth.service");
    const { sendAltaCardThreadMessage } = await import("@/server/alta-card-application-thread.service");
    const user = await requireAuth();
    return sendAltaCardThreadMessage(user.id, data, "applicant");
  });

export const sendInternalAltaCardApplicationThreadMessage = createServerFn({ method: "POST" })
  .inputValidator((input: SendAltaCardThreadMessageInput) => input)
  .handler(async ({ data }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { sendAltaCardThreadMessage } = await import("@/server/alta-card-application-thread.service");
    const staff = await requireOperator();
    return sendAltaCardThreadMessage(staff.id, data, "staff");
  });

export const updateAltaCardApplicationThreadStatus = createServerFn({ method: "POST" })
  .inputValidator((input: UpdateAltaCardThreadStatusInput) => input)
  .handler(async ({ data }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { updateAltaCardThreadStatus } = await import("@/server/alta-card-application-thread.service");
    const staff = await requireOperator();
    return updateAltaCardThreadStatus(staff.id, data);
  });

export const assignAltaCardApplicationThreadStaff = createServerFn({ method: "POST" })
  .inputValidator((input: AssignAltaCardThreadStaffInput) => input)
  .handler(async ({ data }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { assignAltaCardThreadStaff } = await import("@/server/alta-card-application-thread.service");
    const staff = await requireOperator();
    return assignAltaCardThreadStaff(staff.id, data);
  });

export const closeAltaCardApplicationThreadRecord = createServerFn({ method: "POST" })
  .inputValidator((applicationId: string) => applicationId)
  .handler(async ({ data: applicationId }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { closeAltaCardApplicationThread } = await import("@/server/alta-card-application-thread.service");
    const staff = await requireOperator();
    await closeAltaCardApplicationThread(staff.id, applicationId);
    return { ok: true };
  });
