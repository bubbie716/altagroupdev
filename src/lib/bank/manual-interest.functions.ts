import { createServerFn } from "@tanstack/react-start";
import type {
  ManualInterestApplicationInput,
  ManualInterestApplyResult,
  ManualInterestPreviewResult,
} from "@/lib/bank/manual-interest-types";
import type {
  ScheduleManualInterestResult,
  ScheduledManualInterestRow,
} from "@/lib/bank/manual-interest-scheduler-types";

function parseServiceError(error: unknown): never {
  if (error instanceof Error && error.message.startsWith("BAD_REQUEST:")) {
    throw new Error(error.message.slice("BAD_REQUEST:".length));
  }
  throw error;
}

export const previewManualInterestApplicationRecord = createServerFn({ method: "POST" })
  .inputValidator((input: ManualInterestApplicationInput) => input)
  .handler(async ({ data }): Promise<ManualInterestPreviewResult> => {
    const { requireOperator } = await import("@/server/permissions.service");
    const {
      previewManualInterestApplication,
      logManualInterestPreviewed,
    } = await import("@/lib/bank/manual-interest-service");
    const actor = await requireOperator();
    try {
      const preview = await previewManualInterestApplication(data);
      await logManualInterestPreviewed(actor.id, data, preview);
      return preview;
    } catch (error) {
      parseServiceError(error);
    }
  });

export const applyManualInterestApplicationRecord = createServerFn({ method: "POST" })
  .inputValidator(
    (input: ManualInterestApplicationInput & { confirmationPhrase: string }) => input,
  )
  .handler(async ({ data }): Promise<ManualInterestApplyResult> => {
    const { requireAdmin } = await import("@/server/permissions.service");
    const { applyManualInterestApplication } = await import("@/lib/bank/manual-interest-service");
    const { MANUAL_INTEREST_CONFIRMATION_PHRASE } = await import("@/lib/bank/manual-interest-types");

    if (data.confirmationPhrase.trim() !== MANUAL_INTEREST_CONFIRMATION_PHRASE) {
      throw new Error("Confirmation phrase does not match");
    }
    if (data.scheduledForDate?.trim()) {
      throw new Error("Use schedule action when a schedule date is set.");
    }

    const admin = await requireAdmin();
    const { confirmationPhrase: _ignored, scheduledForDate: _date, ...input } = data;

    try {
      return await applyManualInterestApplication(input, admin.id);
    } catch (error) {
      parseServiceError(error);
    }
  });

export const scheduleManualInterestApplicationRecord = createServerFn({ method: "POST" })
  .inputValidator(
    (input: ManualInterestApplicationInput & { confirmationPhrase: string }) => input,
  )
  .handler(async ({ data }): Promise<ScheduleManualInterestResult> => {
    const { requireAdmin } = await import("@/server/permissions.service");
    const { scheduleManualInterestApplication } = await import(
      "@/server/manual-interest-scheduler.service"
    );
    const { MANUAL_INTEREST_CONFIRMATION_PHRASE } = await import("@/lib/bank/manual-interest-types");

    if (data.confirmationPhrase.trim() !== MANUAL_INTEREST_CONFIRMATION_PHRASE) {
      throw new Error("Confirmation phrase does not match");
    }
    if (!data.scheduledForDate?.trim()) {
      throw new Error("Schedule date is required.");
    }
    if (!data.idempotencyKey) {
      throw new Error("Idempotency key is required.");
    }

    const admin = await requireAdmin();
    const { confirmationPhrase: _ignored, ...input } = data;

    try {
      return await scheduleManualInterestApplication(input, admin.id);
    } catch (error) {
      parseServiceError(error);
    }
  });

export const fetchScheduledManualInterestApplications = createServerFn({ method: "GET" }).handler(
  async (): Promise<ScheduledManualInterestRow[]> => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { listScheduledManualInterestApplications } = await import(
      "@/server/manual-interest-scheduler.service"
    );
    await requireOperator();
    return listScheduledManualInterestApplications({ status: "PENDING" });
  },
);

export const cancelScheduledManualInterestApplicationRecord = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data }): Promise<{ cancelled: true }> => {
    const { requireAdmin } = await import("@/server/permissions.service");
    const { cancelScheduledManualInterestApplication } = await import(
      "@/server/manual-interest-scheduler.service"
    );
    const admin = await requireAdmin();
    try {
      await cancelScheduledManualInterestApplication(data.id, admin.id);
      return { cancelled: true };
    } catch (error) {
      parseServiceError(error);
    }
  });

export type {
  ManualInterestApplicationInput,
  ManualInterestPreviewResult,
  ManualInterestApplyResult,
  ScheduleManualInterestResult,
  ScheduledManualInterestRow,
};
