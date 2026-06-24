import { createServerFn } from "@tanstack/react-start";
import type { AccountStatus, UserTag } from "@/lib/auth/types";
import type { InternalUserListFilters } from "@/lib/internal/user-management.types";

async function actorId() {
  const { requireAuth } = await import("@/server/auth.service");
  return (await requireAuth()).id;
}

export const fetchInternalAccessMetrics = createServerFn({ method: "GET" }).handler(async () => {
  const { queryInternalAccessMetrics } = await import("@/server/internal-user-management.service");
  return queryInternalAccessMetrics();
});

export const fetchInternalUsers = createServerFn({ method: "GET" })
  .inputValidator((filters: InternalUserListFilters | undefined) => filters ?? {})
  .handler(async ({ data }) => {
    const { listInternalUsers } = await import("@/server/internal-user-management.service");
    return listInternalUsers(data);
  });

export const fetchInternalUserDetail = createServerFn({ method: "GET" })
  .inputValidator((userId: string) => userId)
  .handler(async ({ data: userId }) => {
    const { getInternalUserDetail } = await import("@/server/internal-user-management.service");
    return getInternalUserDetail(userId);
  });

export const grantInternalUserTagRecord = createServerFn({ method: "POST" })
  .inputValidator((input: { userId: string; tag: UserTag }) => input)
  .handler(async ({ data }) => {
    const { grantInternalUserTag } = await import("@/server/internal-user-management.service");
    const id = await actorId();
    return grantInternalUserTag(id, data.userId, data.tag);
  });

export const revokeInternalUserTagRecord = createServerFn({ method: "POST" })
  .inputValidator((input: { userId: string; tag: UserTag }) => input)
  .handler(async ({ data }) => {
    const { revokeInternalUserTag } = await import("@/server/internal-user-management.service");
    const id = await actorId();
    return revokeInternalUserTag(id, data.userId, data.tag);
  });

export const updateInternalUserAccountStatusRecord = createServerFn({ method: "POST" })
  .inputValidator((input: { userId: string; accountStatus: AccountStatus }) => input)
  .handler(async ({ data }) => {
    const { updateInternalUserAccountStatus } = await import("@/server/internal-user-management.service");
    const id = await actorId();
    return updateInternalUserAccountStatus(id, data.userId, data.accountStatus);
  });
