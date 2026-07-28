import { createFileRoute, redirect } from "@tanstack/react-router";
import { parseBankActivityCenterSearch } from "@/lib/bank/bank-activity-center-url";

/** Compatibility alias — canonical Activity lives under /bank/account/$accountId/activity. */
export const Route = createFileRoute("/bank/accounts/$accountId/activity")({
  validateSearch: (search: Record<string, unknown>) => parseBankActivityCenterSearch(search),
  beforeLoad: ({ params, search }) => {
    throw redirect({
      to: "/bank/account/$accountId/activity",
      params,
      search: {
        view: search.view,
        ...(search.transactionId ? { transactionId: search.transactionId } : {}),
        ...(search.requestId ? { requestId: search.requestId } : {}),
        ...(search.scheduleId ? { scheduleId: search.scheduleId } : {}),
        ...(search.approvalId ? { approvalId: search.approvalId } : {}),
      },
      replace: true,
    });
  },
});
