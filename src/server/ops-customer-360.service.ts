import { getInternalUserDetail } from "@/server/internal-user-management.service";
import { requireOperator } from "@/server/permissions.service";
import { buildUniversalCustomerTimeline } from "@/server/ops-universal-timeline.service";
import { listInternalNotes } from "@/server/internal-note.service";

export async function getInternalCustomer360(
  userId: string,
  options?: { includeTimeline?: boolean },
) {
  await requireOperator();
  const includeTimeline = options?.includeTimeline ?? true;
  const [user, notes, timeline] = await Promise.all([
    getInternalUserDetail(userId),
    listInternalNotes("USER", userId),
    includeTimeline ? buildUniversalCustomerTimeline(userId, 60) : Promise.resolve([]),
  ]);

  const isPrivateClient = user.tags.includes("private_client");

  return {
    user,
    notes,
    timeline,
    isPrivateClient,
    altaPayActivity: [] as Array<{
      id: string;
      accountId: string;
      direction: "sent" | "received";
      referenceCode: string;
      amount: number;
      accountName: string;
      accountNumber: string;
      description: string;
      createdAt: string;
    }>,
  };
}
