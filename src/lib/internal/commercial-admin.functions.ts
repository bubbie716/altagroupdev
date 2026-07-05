import { createServerFn } from "@tanstack/react-start";

export const adminGrantCommercialProOps = createServerFn({ method: "POST" })
  .inputValidator((input: { companyId: string; months: number; reason: string }) => input)
  .handler(async ({ data }) => {
    const { requireAuth } = await import("@/server/auth.service");
    const { adminGrantCommercialPro } = await import("@/server/commercial-billing.service");
    const user = await requireAuth();
    return adminGrantCommercialPro(user.id, data);
  });
