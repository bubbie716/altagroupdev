import { createServerFn } from "@tanstack/react-start";
import type { UpdateUserBankSettingsInput } from "@/lib/bank/bank-settings-types";

export const fetchUserBankSettings = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAuth } = await import("@/server/auth.service");
  const { getUserBankSettings } = await import("@/server/bank-settings.service");
  const user = await requireAuth();
  return getUserBankSettings(user);
});

export const updateUserBankSettingsRecord = createServerFn({ method: "POST" })
  .inputValidator((input: UpdateUserBankSettingsInput) => input)
  .handler(async ({ data }) => {
    const { requireAuth } = await import("@/server/auth.service");
    const { updateUserBankSettings } = await import("@/server/bank-settings.service");
    const user = await requireAuth();
    return updateUserBankSettings(user, data);
  });
