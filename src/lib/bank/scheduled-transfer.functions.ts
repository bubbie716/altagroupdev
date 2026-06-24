import { createServerFn } from "@tanstack/react-start";
import type {
  CreateUserScheduledTransferInput,
  ScheduledTransferScopeCode,
} from "@/lib/bank/business-banking-types";

async function actor() {
  const { requireAuth } = await import("@/server/auth.service");
  return requireAuth();
}

export const fetchUserScheduledTransfers = createServerFn({ method: "GET" })
  .validator((scope: ScheduledTransferScopeCode) => scope)
  .handler(async ({ data: scope }) => {
    const { listUserScheduledTransfers } = await import("@/server/scheduled-transfer.service");
    const user = await actor();
    return listUserScheduledTransfers(user, scope);
  });

export const createUserScheduledTransferRecord = createServerFn({ method: "POST" })
  .validator((input: CreateUserScheduledTransferInput) => input)
  .handler(async ({ data }) => {
    const { createUserScheduledTransfer } = await import("@/server/scheduled-transfer.service");
    const user = await actor();
    return createUserScheduledTransfer(user, data);
  });

export const cancelUserScheduledTransferRecord = createServerFn({ method: "POST" })
  .validator((input: { paymentId: string; transferScope: ScheduledTransferScopeCode }) => input)
  .handler(async ({ data }) => {
    const { cancelUserScheduledTransfer } = await import("@/server/scheduled-transfer.service");
    const user = await actor();
    return cancelUserScheduledTransfer(user, data.paymentId, data.transferScope);
  });
