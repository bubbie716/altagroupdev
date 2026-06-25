import { createServerFn } from "@tanstack/react-start";
import type {
  ManualInterestApplicationInput,
  ManualInterestApplyResult,
  ManualInterestPreviewResult,
} from "@/lib/bank/manual-interest-types";

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

    const admin = await requireAdmin();
    const { confirmationPhrase: _ignored, ...input } = data;

    try {
      return await applyManualInterestApplication(input, admin.id);
    } catch (error) {
      parseServiceError(error);
    }
  });

export type {
  ManualInterestApplicationInput,
  ManualInterestPreviewResult,
  ManualInterestApplyResult,
};
